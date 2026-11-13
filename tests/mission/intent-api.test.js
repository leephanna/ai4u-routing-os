"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const auth=require("../../lib/billing/auth"),db=require("../../lib/billing/db");
function res(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.body=JSON.parse(s);}};}
test("Intent planning API saves decisions and enforces account ownership",async()=>{
 const oldAuth=auth.requireUser,oldQuery=db.query,path=require.resolve("../../lib/mission/intent-handler");
 const owner="00000000-0000-4000-8000-000000000001",other="00000000-0000-4000-8000-000000000002";
 const id="11111111-1111-4111-8111-111111111111";
 let user=owner,saved=null;
 try{
  auth.requireUser=async()=>({id:user,email:"test@example.com"});
  db.query=async(sql,args)=>{
   if(sql.startsWith("SELECT count(*)"))return {rows:[{n:0}]};
   if(sql.startsWith("INSERT INTO ai4u_private.router_mission_plans")){
    saved={id,user_id:args[0],original_goal:args[1],chosen_prompt:args[2],chosen_option:args[3],plan:JSON.parse(args[4]),created_at:"2026-11-13T00:00:00Z",updated_at:"2026-11-13T00:00:00Z"};
    return {rows:[saved]};
   }
   if(sql.startsWith("SELECT * FROM ai4u_private.router_mission_plans"))return {rows:saved&&saved.user_id===user&&(!sql.includes("WHERE id=")||args[0]===id)?[saved]:[]};
   throw Error("Unexpected SQL: "+sql.slice(0,90));
  };
  delete require.cache[path];const handler=require(path);
  async function call(method,body,query={intent:"1"}){const response=res();await handler({method,headers:{},body,query},response);return response;}
  const proposal=await call("POST",{action:"preview",goal:"Audit my website https://example.com/ for launch readiness"});
  assert.equal(proposal.statusCode,200);
  assert.equal(proposal.body.plan.execution_allowed,false);
  const created=await call("POST",{action:"save",goal:"Audit my website https://example.com/ for launch readiness",option:"fast"});
  assert.equal(created.statusCode,201);assert.equal(created.body.saved.chosen_option,"fast");
  assert.equal(saved.user_id,owner);assert.match(saved.chosen_prompt,/smallest safe next action/);
  const loaded=await call("GET",null,{id});
  assert.equal(loaded.body.saved.original_goal,saved.original_goal);
  user=other;
  assert.equal((await call("GET",null,{id})).body.saved,null);
  assert.equal((await call("GET")).body.saved,null);
  user=owner;
  assert.equal((await call("POST",{action:"save",goal:"A useful project plan",option:"arbitrary"})).statusCode,400);
  assert.equal((await call("POST",{action:"save",goal:"",option:"fast"})).statusCode,400);
 }finally{auth.requireUser=oldAuth;db.query=oldQuery;delete require.cache[path];}
});
test("Mission Runner exposes opt-in improvement and never silently runs a check",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
 const ui=fs.readFileSync(path.join(__dirname,"../../mission-intent.js"),"utf8");
 assert.match(html,/id="intent-goal"/);
 assert.match(html,/id="intent-suggestions" hidden/);
 assert.match(html,/id="intent-save"/);
 assert.match(html,/mission-intent\.js/);
 assert.match(ui,/chosen_option/);
 assert.doesNotMatch(ui,/AI4UMission\.start\(/);
 assert.doesNotMatch(ui,/localStorage/);
});
