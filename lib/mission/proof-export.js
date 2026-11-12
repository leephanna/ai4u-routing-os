"use strict";
const db=require("../billing/db");
const {send}=require("../billing/http");
const {createReceipt,completePack}=require("./proof-v2");
// Invoked only AFTER /api/mission/site-audit has authenticated the owner and loaded
// the mission using WHERE id=$1 AND user_id=$2. Reuses the existing Vercel function
// to stay within the Hobby plan's 12-function limit.
module.exports=async function exportProof(req,res,user,mission){
  const id=mission.id;
  const rawAttempt=req.query&&req.query.attempt;
  const attempt=rawAttempt===undefined?Number(mission.attempts):Number(rawAttempt);
  if(!Number.isSafeInteger(attempt)||attempt<1||attempt>Number(mission.attempts))return send(res,400,{error:"Invalid mission attempt"});
  const found=await db.query("SELECT mission_id,user_id,attempt,sample_bytes,report FROM ai4u_private.router_mission_evidence WHERE mission_id=$1 AND user_id=$2 AND attempt=$3 LIMIT 1",[id,user.id,attempt]);
  if(!found.rows.length)return send(res,409,{error:"This attempt has no V2 evidence artifact. Earlier V1 missions cannot be retroactively certified; start a new mission."});
  const evidence=found.rows[0];
  const state=Number(mission.attempts)===attempt&&mission.status==="complete"?"complete":String(evidence.report.status);
  let receiptResult=await db.query("SELECT receipt FROM ai4u_private.router_mission_receipts WHERE mission_id=$1 AND user_id=$2 AND attempt=$3 AND mission_state=$4 LIMIT 1",[id,user.id,attempt,state]);
  if(!receiptResult.rows.length){
    const receipt=createReceipt(mission,evidence);
    await db.query("INSERT INTO ai4u_private.router_mission_receipts(mission_id,user_id,attempt,mission_state,receipt) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT (mission_id,attempt,mission_state) DO NOTHING",[id,user.id,attempt,state,JSON.stringify(receipt)]);
    receiptResult=await db.query("SELECT receipt FROM ai4u_private.router_mission_receipts WHERE mission_id=$1 AND user_id=$2 AND attempt=$3 AND mission_state=$4 LIMIT 1",[id,user.id,attempt,state]);
  }
  if(!receiptResult.rows.length)throw new Error("Signed receipt could not be persisted");
  const pack=completePack(receiptResult.rows[0].receipt,evidence.sample_bytes);
  res.setHeader("Content-Disposition",'attachment; filename="AI4U_Signed_Proof_Pack_'+id+'_attempt_'+attempt+'.json"');
  res.setHeader("X-Content-Type-Options","nosniff");
  return send(res,200,pack);
};
