"use strict";
const db=require("../billing/db");
const {requireUser}=require("../billing/auth");
const {send,readJson}=require("../billing/http");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STOREFRONT=/\b(wreath|online store|storefront|ecommerce|e-commerce|handmade.*shop|sell.*products|checkout)\b/i;
const REGIONS=["US","CA","UK","EU","other","not_sure"];
const SHIPPING=["ship","pickup","both","not_sure"];
const BUDGETS=["under_50","50_to_150","over_150","not_sure"];
function publicRecord(row){
 return {id:row.id,plan_id:row.plan_id,status:row.status,step_index:row.step_index,
  revision:row.revision,requirements:row.requirements,updated_at:row.updated_at};
}
function cleanChoice(value,allowed){return typeof value==="string"&&allowed.includes(value)?value:null;}
function validateRequirements(input){
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const region=cleanChoice(input.region,REGIONS);
 const shipping=cleanChoice(input.shipping,SHIPPING);
 const budget=cleanChoice(input.budget,BUDGETS);
 if(!region||!shipping||!budget)return null;
 // These are user-reported inputs, not measured or independently verified facts.
 return {region,shipping,budget,verification:"user_confirmed",source:"user_submission"};
}
const GET_SQL="SELECT g.* FROM ai4u_private.router_guided_missions g WHERE g.id=$1 AND g.user_id=$2 LIMIT 1";
async function lookup(id,userId,client=db){
 const result=await client.query(GET_SQL,[id,userId]);
 return result.rows[0]||null;
}
module.exports=async function(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET"&&req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 try{
  const user=await requireUser(req);
  if(req.method==="GET"){
   const id=String(req.query?.id||"");
   if(id&&!UUID.test(id))return send(res,400,{error:"Invalid guided mission ID."});
   const rows=await db.query(id?GET_SQL:
    "SELECT * FROM ai4u_private.router_guided_missions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1",
    id?[id,user.id]:[user.id]);
   return send(res,200,{mission:rows.rows.length?publicRecord(rows.rows[0]):null});
  }
  const body=await readJson(req);
  const action=String(body.action||"");
  if(action==="start"){
   const planId=String(body.plan_id||"");
   if(!UUID.test(planId))return send(res,400,{error:"A saved plan is required before guided execution."});
   const saved=await db.query("SELECT id,original_goal,chosen_prompt FROM ai4u_private.router_mission_plans WHERE id=$1 AND user_id=$2 LIMIT 1",[planId,user.id]);
   if(!saved.rows.length)return send(res,404,{error:"Saved plan not found for this account."});
   const plan=saved.rows[0];
   if(!STOREFRONT.test(plan.original_goal)&&!STOREFRONT.test(plan.chosen_prompt))
     return send(res,422,{error:"The first guided pilot supports storefront goals only. Your saved plan remains unchanged."});
   const result=await db.query(
    "INSERT INTO ai4u_private.router_guided_missions(user_id,plan_id) VALUES($1,$2) ON CONFLICT (user_id,plan_id) DO UPDATE SET updated_at=ai4u_private.router_guided_missions.updated_at RETURNING *",
    [user.id,planId]);
   return send(res,200,{mission:publicRecord(result.rows[0]),next_action:"Confirm your essential storefront requirements."});
  }
  if(action!=="confirm_requirements")return send(res,400,{error:"Unknown guided mission action."});
  const id=String(body.mission_id||""),requestId=String(body.request_id||"");
  if(!UUID.test(id)||!UUID.test(requestId))return send(res,400,{error:"Valid mission and request identifiers are required."});
  if(!Number.isSafeInteger(body.revision)||body.revision<0)return send(res,400,{error:"Invalid mission revision."});
  const requirements=validateRequirements(body.requirements);
  if(!requirements)return send(res,400,{error:"Choose a selling region, fulfillment approach and budget. Select Not sure wherever needed."});
  // Concurrent requests are serialized by row lock. Reusing the same request ID cannot repeat the event.
  const outcome=await db.transaction(async client=>{
   const locked=await client.query("SELECT * FROM ai4u_private.router_guided_missions WHERE id=$1 AND user_id=$2 FOR UPDATE",[id,user.id]);
   if(!locked.rows.length)return {http:404,error:"Guided mission not found for this account."};
   const row=locked.rows[0];
   if(row.last_request_id===requestId)return {http:200,mission:publicRecord(row),replayed:true};
   if(row.step_index!==0||row.status!=="awaiting_user")
     return {http:409,error:"This step has already been confirmed. Resume to see the current step."};
   if(row.revision!==body.revision)
     return {http:409,error:"This mission changed in another session. Resume it before submitting again."};
   const updated=await client.query(
    "UPDATE ai4u_private.router_guided_missions SET requirements=$3::jsonb,step_index=1,status='awaiting_route_review',revision=revision+1,last_request_id=$4,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *",
    [id,user.id,JSON.stringify(requirements),requestId]);
   await client.query(
    "INSERT INTO ai4u_private.router_guided_events(user_id,guided_mission_id,request_id,event_type,details) VALUES($1,$2,$3,'requirements_user_confirmed',$4::jsonb)",
    [user.id,id,requestId,JSON.stringify({step:0,verification:"user_confirmed",region:requirements.region,shipping:requirements.shipping,budget:requirements.budget})]);
   return {http:200,mission:publicRecord(updated.rows[0]),replayed:false};
  });
  if(outcome.error)return send(res,outcome.http,{error:outcome.error});
  return send(res,200,{mission:outcome.mission,replayed:outcome.replayed,
   next_action:"Compare storefront options. This requires a reviewed, evidence-supported route before automated execution."});
 }catch(error){
  const status=Number(error.status)||500;
  if(status>=500)console.error("Guided mission request failed",{code:error.code||"UNKNOWN"});
  return send(res,status>=500?503:status,{error:status>=500?"The guided mission could not be verified in account storage. Your previous saved plan is unchanged.":error.message});
 }
};
