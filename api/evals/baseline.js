"use strict";
const db=require("../../lib/billing/db");
const {send}=require("../../lib/billing/http");
module.exports=async function(req,res){
  if(req.method!=="GET")return send(res,405,{error:"Method not allowed"});
  try{
    const rows=await db.query("SELECT baseline_id,report,created_at FROM ai4u_private.router_eval_baselines WHERE baseline_id=$1",["legacy-2026-11-11"]);
    if(!rows.rows.length)return send(res,404,{error:"Baseline not available"});
    const row=rows.rows[0];
    return send(res,200,{baseline_id:row.baseline_id,recorded_at:row.created_at,report:row.report});
  }catch(error){
    console.error("Router baseline read failed",{code:error.code||"UNKNOWN"});
    return send(res,503,{error:"Baseline storage is temporarily unavailable"});
  }
};
