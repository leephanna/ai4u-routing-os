"use strict";
const db=require("../billing/db");
const {requireUser}=require("../billing/auth");
const {send,readJson}=require("../billing/http");
const {planMission}=require("./intent-planner");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function result(row){return {id:row.id,original_goal:row.original_goal,chosen_prompt:row.chosen_prompt,chosen_option:row.chosen_option,plan:row.plan,created_at:row.created_at,updated_at:row.updated_at};}
module.exports=async function(req,res){
 let stage="authenticate";
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET"&&req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 try{
  const user=await requireUser(req);
  if(req.method==="GET"){
   stage="read";
   const id=String(req.query?.id||"");
   if(id&&!UUID.test(id))return send(res,400,{error:"Invalid saved plan ID."});
   const rows=await db.query(id?
     "SELECT * FROM ai4u_private.router_mission_plans WHERE id=$1 AND user_id=$2 LIMIT 1":
     "SELECT * FROM ai4u_private.router_mission_plans WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1",
     id?[id,user.id]:[user.id]);
   return send(res,200,{saved:rows.rows[0]?result(rows.rows[0]):null});
  }
  stage="interpret";
  const body=await readJson(req);
  const goal=body.goal;
  if(typeof goal!=="string"||goal.trim().length<1||goal.length>4000)return send(res,400,{error:"Describe your goal in 1–4000 characters."});
  const request={goal,constraints:body.constraints,budget:body.budget,acceptance_criteria:body.acceptance_criteria};
  const plan=planMission(request);
  if(body.action==="preview")return send(res,200,{plan,saved:null});
  if(body.action!=="save")return send(res,400,{error:"Unknown planning action."});
  if(plan.status==="needs_clarification")return send(res,409,{error:"Clarify the goal with one of the suggested wordings before saving."});
  const option=String(body.option||"");
  const alternative=plan.alternatives.find(a=>a.id===option);
  if(option!=="original"&&!alternative)return send(res,400,{error:"Select a valid wording before saving."});
  const choice=alternative?alternative.prompt:plan.original_goal;
  stage="quota";
  const quota=await db.query("SELECT count(*)::int AS n FROM ai4u_private.router_mission_plans WHERE user_id=$1 AND created_at>now()-interval '1 hour'",[user.id]);
  if(Number(quota.rows[0].n)>=20)return send(res,429,{error:"Planning save limit reached. Resume your last saved plan or try later."});
  stage="insert";
  const rows=await db.query("INSERT INTO ai4u_private.router_mission_plans(user_id,original_goal,chosen_prompt,chosen_option,plan) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING *",
    [user.id,plan.original_goal,choice,option,JSON.stringify(plan)]);
  return send(res,201,{saved:result(rows.rows[0]),plan});
 }catch(error){
  const status=Number(error.status)||500;
  if(status>=500){
   const code=String(error.code||"");
   console.error("Mission plan storage failed",{stage,code:code||"UNKNOWN"});
   let message="Your plan was NOT saved. Account storage could not confirm this request.";
   let publicCode="PLAN_STORAGE_ERROR";
   if(code==="42P01"){message="Your plan was NOT saved because the mission-plan database table is missing.";publicCode="PLAN_TABLE_MISSING";}
   else if(code==="42501"){message="Your plan was NOT saved because the database refused permission.";publicCode="PLAN_STORAGE_PERMISSION";}
   else if(code.startsWith("08")||/^(ETIMEDOUT|ECONNREFUSED)$/i.test(code)){message="Your plan was NOT saved because account storage is temporarily unreachable.";publicCode="PLAN_DB_UNREACHABLE";}
   return send(res,503,{error:message+" Your wording is still in the editor; do not assume it was saved.",code:publicCode});
  }
  return send(res,status,{error:error.message,code:status===401?"SIGN_IN_REQUIRED":"PLAN_REQUEST_REJECTED"});
 }
};
