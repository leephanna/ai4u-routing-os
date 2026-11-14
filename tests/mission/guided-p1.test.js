"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const auth=require("../../lib/billing/auth"),db=require("../../lib/billing/db");
const OWNER="00000000-0000-4000-8000-000000000001";
const OTHER="00000000-0000-4000-8000-000000000002";
const PLAN="22222222-2222-4222-8222-222222222222";
const ID="33333333-3333-4333-8333-333333333333";
const REQUEST="44444444-4444-4444-8444-444444444444";
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(text){this.body=JSON.parse(text);}};}
test("Guided mission persists owner-scoped steps, uses idempotency and never implies a verified store",async()=>{
 const originalAuth=auth.requireUser,originalQuery=db.query,originalTx=db.transaction;
 const route=require.resolve("../../lib/mission/guided-handler");
 let user=OWNER,record=null,events=[],storedGoal="Build an affordable online store for handmade wreaths with checkout";
 const copy=()=>record?{...record,requirements:{...record.requirements}}:null;
 try{
  auth.requireUser=async()=>({id:user});
  const query=async(sql,args)=>{
   if(sql.includes("FROM ai4u_private.router_mission_plans WHERE id="))
    return {rows:args[1]===OWNER&&args[0]===PLAN?[{id:PLAN,original_goal:storedGoal,chosen_prompt:storedGoal}]:[]};
   if(sql.startsWith("INSERT INTO ai4u_private.router_guided_missions")){
    if(args[0]!==OWNER)throw Error("Owner mismatch");
    if(!record)record={id:ID,user_id:OWNER,plan_id:PLAN,status:"awaiting_user",step_index:0,revision:0,requirements:{},route_choice:{},last_request_id:null,updated_at:"2026-11-13"};
    return {rows:[copy()]};
   }
   if(sql.startsWith("SELECT g.* FROM ai4u_private.router_guided_missions"))
    return {rows:record&&args[1]===record.user_id&&args[0]===record.id?[copy()]:[]};
   if(sql.startsWith("SELECT * FROM ai4u_private.router_guided_missions WHERE user_id="))
    return {rows:record&&args[0]===record.user_id?[copy()]:[]};
   if(sql.startsWith("SELECT * FROM ai4u_private.router_guided_missions WHERE id="))
    return {rows:record&&args[1]===record.user_id&&args[0]===record.id?[copy()]:[]};
   if(sql.startsWith("UPDATE ai4u_private.router_guided_missions")){
    if(sql.includes("route_choice=")){
     record.route_choice=JSON.parse(args[2]);record.step_index=2;record.status="awaiting_setup";
    }else{
     record.requirements=JSON.parse(args[2]);record.step_index=1;record.status="awaiting_route_review";
    }
    record.revision++;record.last_request_id=args[3];
    return {rows:[copy()]};
   }
   if(sql.startsWith("INSERT INTO ai4u_private.router_guided_events")){
    events.push({id:args[2],user:args[0],event:JSON.parse(args[3])});
    return {rows:[]};
   }
   throw Error("Unexpected SQL: "+sql.slice(0,100));
  };
  db.query=query;
  db.transaction=async work=>work({query});
  delete require.cache[route];const handle=require(route);
  const call=async(method,body,query={guided:"1"})=>{
   const r=response();await handle({method,body,query},r);return r;
  };
  assert.equal((await call("POST",{action:"start",plan_id:"invalid"})).statusCode,400);
  let result=await call("POST",{action:"start",plan_id:PLAN});
  assert.equal(result.statusCode,200);
  assert.equal(result.body.mission.step_index,0);
  assert.equal((await call("POST",{action:"start",plan_id:PLAN})).body.mission.id,ID);
  assert.equal((await call("POST",{action:"confirm_requirements",mission_id:ID,request_id:REQUEST,revision:0,requirements:{region:"US",shipping:"bad",budget:"not_sure"}})).statusCode,400);
  const payload={action:"confirm_requirements",mission_id:ID,request_id:REQUEST,revision:0,requirements:{region:"US",shipping:"ship",budget:"not_sure"}};
  result=await call("POST",payload);
  assert.equal(result.statusCode,200);
  assert.equal(result.body.mission.step_index,1);
  assert.equal(result.body.mission.status,"awaiting_route_review");
  assert.equal(result.body.mission.requirements.verification,"user_confirmed");
  assert.equal(events.length,1);
  result=await call("POST",payload);
  assert.equal(result.statusCode,200);
  assert.equal(result.body.replayed,true);
  assert.equal(events.length,1);
  const stale=await call("POST",{...payload,request_id:"55555555-5555-4555-8555-555555555555"});
  assert.equal(stale.statusCode,409);
  const comparison=(await call("GET",null,{id:ID})).body.comparison;
  assert.equal(comparison.mode,"source_snapshot");
  assert.equal(comparison.recommendation,"wix");
  assert.equal(comparison.options.length,3);
  assert.equal((await call("POST",{action:"choose_route",mission_id:ID,request_id:"66666666-6666-4666-8666-666666666666",revision:1,platform:"wix",acknowledge_review:false})).statusCode,400);
  const routePayload={action:"choose_route",mission_id:ID,request_id:"77777777-7777-4777-8777-777777777777",revision:1,platform:"shopify",acknowledge_review:true};
  const routeResult=await call("POST",routePayload);
  assert.equal(routeResult.statusCode,200);
  assert.equal(routeResult.body.mission.step_index,2);
  assert.equal(routeResult.body.mission.route_choice.platform,"shopify");
  assert.equal(routeResult.body.mission.route_choice.verification,"user_selected_unverified");
  assert.equal(events.length,2);
  assert.equal((await call("POST",routePayload)).body.replayed,true);
  assert.equal(events.length,2);
  assert.equal((await call("POST",{...routePayload,request_id:"88888888-8888-4888-8888-888888888888"})).statusCode,409);
  user=OTHER;
  assert.equal((await call("GET",null,{id:ID})).body.mission,null);
  assert.equal((await call("GET")).body.mission,null);
  assert.equal((await call("POST",payload)).statusCode,404);
  assert.equal((await call("POST",{action:"start",plan_id:PLAN})).statusCode,404);
  user=OWNER;
  assert.equal((await call("GET",null,{id:ID})).body.mission.step_index,2);
 }finally{
  auth.requireUser=originalAuth;db.query=originalQuery;db.transaction=originalTx;delete require.cache[route];
 }
});
test("Guided mission interface is distinct from website readiness and never reports execution",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
 const client=fs.readFileSync(path.join(__dirname,"../../guided-mission.js"),"utf8");
 const api=fs.readFileSync(path.join(__dirname,"../../api/mission/site-audit.js"),"utf8");
 assert.match(html,/id="guided-panel" hidden/);
 assert.match(html,/Start Guided Mission/);
 assert.match(html,/id="guided-step-two" hidden/);
 assert.match(html,/not independently checked/);
 assert.match(client,/AI4UGuided=\{startLatest,resume,confirmStep,chooseRoute,confirmSiteInventory,preparePublicAudit\}/);
 assert.match(client,/request_id:requestId/);
 assert.match(client,/step_index!==1/);
 assert.match(api,/req\.query\.guided==="1"/);
 assert.match(client,/async function preparePublicAudit\(/);\n assert.match(client,/await global\.AI4UMission\.start\(\)/);
 assert.doesNotMatch(client,/localStorage/);
});
