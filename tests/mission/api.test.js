"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const auth=require("../../lib/billing/auth");
const db=require("../../lib/billing/db");
const helper=require("../../lib/mission/site-audit");
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(x){this.body=JSON.parse(x);}};}
test("Mission API persists owner-scoped start/run/retry/accept and blocks other users",async()=>{
  const oldAuth=auth.requireUser,oldQuery=db.query,oldTransaction=db.transaction,oldAudit=helper.auditSite;
  const path=require.resolve("../../api/mission/site-audit");
  const owner="00000000-0000-4000-8000-000000000001",outsider="00000000-0000-4000-8000-000000000002";
  const id="11111111-1111-4111-8111-111111111111";
  let current=owner,row=null,scans=0,evidenceRows=0;
  try{
    auth.requireUser=async()=>({id:current,email:"test@example.com"});
    db.query=async(sql,params)=>{
      if(sql.startsWith("SELECT count(*)"))return {rows:[{n:0}]};
      if(sql.startsWith("INSERT INTO ai4u_private.router_missions")){
        row={id,user_id:params[0],target_url:params[1],status:"draft",attempts:0,checks:[],evidence:{},created_at:"2026-11-11T00:00:00Z",checked_at:null,completed_at:null,last_error:null};
        return {rows:[{...row}]};
      }
      if(sql.startsWith("SELECT * FROM ai4u_private.router_missions"))return {rows:row&&row.id===params[0]&&row.user_id===params[1]?[{...row}]:[]};
      if(sql.includes("SET status='running'")){row.status="running";row.attempts++;return {rows:[{attempts:row.attempts}]};}
      if(sql.includes("SET status=$3")){row.status=params[2];row.checks=JSON.parse(params[3]);row.evidence=JSON.parse(params[4]);row.checked_at="2026-11-11T00:01:00Z";return {rows:[{...row}]};}
      if(sql.includes("SET status='complete'")){row.status="complete";row.completed_at="2026-11-11T00:02:00Z";return {rows:[{...row}]};}
      throw new Error("Unexpected SQL "+sql.slice(0,60));
    };
    db.transaction=async work=>work({query:async(sql,params)=>{
      if(sql.startsWith("INSERT INTO ai4u_private.router_mission_evidence")){evidenceRows++;return {rows:[{attempt:params[2]}]};}
      return db.query(sql,params);
    }});
    helper.auditSite=async()=>{scans++;return {status:"verified",sample_buffer:Buffer.from("<html>test</html>"),checks:[{id:"https_tls",status:"pass",label:"HTTPS",detail:"TLS validated"}],evidence:{scope:"scoped proof",checked_at:"2026-11-11T00:01:00Z",sample_sha256:"test"}};};
    delete require.cache[path];const handler=require(path);
    async function call(method,body,query){const res=response();await handler({method,headers:{},body,query},res);return res;}
    const created=await call("POST",{action:"start",target_url:"https://example.com/"});
    assert.equal(created.statusCode,201);assert.equal(created.body.mission.status,"draft");
    const run=await call("POST",{action:"run",mission_id:id});
    assert.equal(run.statusCode,200);assert.equal(run.body.mission.status,"verified");
    assert.equal(run.body.mission.attempts,1);assert.equal(scans,1);assert.equal(evidenceRows,1);
    const get=await call("GET",null,{mission_id:id});
    assert.equal(get.body.mission.evidence.scope,"scoped proof");
    current=outsider;
    const blocked=await call("GET",null,{mission_id:id});
    assert.equal(blocked.statusCode,404);
    current=owner;
    const accepted=await call("POST",{action:"accept",mission_id:id});
    assert.equal(accepted.statusCode,200);assert.equal(accepted.body.mission.status,"complete");
  }finally{
    auth.requireUser=oldAuth;db.query=oldQuery;db.transaction=oldTransaction;helper.auditSite=oldAudit;delete require.cache[path];
  }
});
