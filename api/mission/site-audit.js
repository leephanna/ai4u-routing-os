"use strict";
const db=require("../../lib/billing/db");
const {requireUser}=require("../../lib/billing/auth");
const {send,readJson}=require("../../lib/billing/http");
const {validateTarget,auditSite}=require("../../lib/mission/site-audit");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function publicMission(row){
  return {id:row.id,target_url:row.target_url,status:row.status,attempts:row.attempts,checks:row.checks,evidence:row.evidence,last_error:row.last_error,created_at:row.created_at,checked_at:row.checked_at,completed_at:row.completed_at};
}
module.exports=async function(req,res){
  if(req.method!=="POST"&&req.method!=="GET")return send(res,405,{error:"Method not allowed"});
  let action=null,id=null,user;
  try{
    user=await requireUser(req);
    const body=req.method==="POST"?await readJson(req):{};
    action=req.method==="GET"?"get":String(body.action||"start");
    id=req.method==="GET"?req.query&&req.query.mission_id:body.mission_id;
    if(action==="start"){
      const target=validateTarget(body.target_url).href;
      const quota=await db.query("SELECT count(*)::int AS n FROM ai4u_private.router_missions WHERE user_id=$1 AND created_at>now()-interval '1 hour'",[user.id]);
      if(Number(quota.rows[0].n)>=20)return send(res,429,{error:"Hourly mission limit reached. Please try again later."});
      const result=await db.query("INSERT INTO ai4u_private.router_missions(user_id,target_url,status) VALUES($1,$2,'draft') RETURNING *",[user.id,target]);
      return send(res,201,{mission:publicMission(result.rows[0])});
    }
    if(!UUID.test(String(id||"")))return send(res,400,{error:"A valid mission ID is required."});
    const found=await db.query("SELECT * FROM ai4u_private.router_missions WHERE id=$1 AND user_id=$2 LIMIT 1",[id,user.id]);
    if(!found.rows.length)return send(res,404,{error:"Mission not found for this account."});
    const mission=found.rows[0];
    if(action==="get")return send(res,200,{mission:publicMission(mission)});
    if(action==="accept"){
      if(mission.status!=="verified"&&mission.status!=="complete")return send(res,409,{error:"Resolve failed checks and rerun the audit before confirming completion."});
      const result=await db.query("UPDATE ai4u_private.router_missions SET status='complete',completed_at=coalesce(completed_at,now()),updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *",[id,user.id]);
      return send(res,200,{mission:publicMission(result.rows[0])});
    }
    if(action!=="run")return send(res,400,{error:"Unknown mission action."});
    if(mission.attempts>=10)return send(res,429,{error:"This mission has reached its ten-attempt limit. Start a new mission."});
    await db.query("UPDATE ai4u_private.router_missions SET status='running',attempts=attempts+1,last_error=NULL,updated_at=now() WHERE id=$1 AND user_id=$2",[id,user.id]);
    const report=await auditSite(mission.target_url);
    const saved=await db.query("UPDATE ai4u_private.router_missions SET status=$3,checks=$4::jsonb,evidence=$5::jsonb,checked_at=now(),updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *",[id,user.id,report.status,JSON.stringify(report.checks),JSON.stringify(report.evidence)]);
    return send(res,200,{mission:publicMission(saved.rows[0])});
  }catch(error){
    if(action==="run"&&id&&UUID.test(String(id))&&user){
      try{await db.query("UPDATE ai4u_private.router_missions SET status='failed',last_error=$3,checked_at=now(),updated_at=now() WHERE id=$1 AND user_id=$2",[id,user.id,String(error.message||"Audit failed").slice(0,240)]);}catch(_){}
    }
    const status=Number(error.status)||500;
    if(status>=500)console.error("Website mission failed",{code:error.code||"UNKNOWN"});
    return send(res,status,{error:status>=500?"The website check could not complete. Retry later.":error.message});
  }
};
