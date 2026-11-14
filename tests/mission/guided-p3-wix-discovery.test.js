"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const db=require("../../lib/billing/db"),auth=require("../../lib/billing/auth");
const ID="33333333-3333-4333-8333-333333333333",OWNER="00000000-0000-4000-8000-000000000001",OTHER="00000000-0000-4000-8000-000000000002";
const REQUEST="44444444-4444-4444-8444-444444444444";
test("Step 3: owner-only, idempotent existing Wix discovery; no site is created",async()=>{
 const origQuery=db.query,origTx=db.transaction,origAuth=auth.requireUser;
 const route=require.resolve("../../lib/mission/guided-handler");
 let owner=OWNER,writes=0,events=0;
 let row={id:ID,user_id:OWNER,plan_id:"22222222-2222-4222-8222-222222222222",
   revision:2,step_index:2,status:"awaiting_setup",route_choice:{platform:"wix",platform_name:"Wix Core"},
   requirements:{region:"US",budget:"under_50",shipping:"both"},setup_context:{},last_request_id:null};
 const query=async(sql,args)=>{
  if(sql.includes("FOR UPDATE"))return {rows:args[1]===owner&&owner===OWNER?[{...row}]:[]};
  if(sql.startsWith("UPDATE ai4u_private.router_guided_missions")){
   writes++;row={...row,setup_context:JSON.parse(args[2]),revision:3,step_index:3,
    status:"awaiting_site_review",last_request_id:args[3]};return {rows:[{...row}]};
  }
  if(sql.startsWith("INSERT INTO ai4u_private.router_guided_events")){events++;return {rows:[]};}
  if(sql.startsWith("SELECT g.* FROM ai4u_private.router_guided_missions"))
    return {rows:owner===OWNER&&args[1]===OWNER?[{...row}]:[]};
  throw Error("Unexpected SQL: "+sql.slice(0,70));
 };
 try{
  db.query=query;db.transaction=async fn=>fn({query});auth.requireUser=async()=>({id:owner});
  delete require.cache[route];const handler=require(route);
  const invoke=async(body,method="POST",id=ID)=>{
   const res={statusCode:200,setHeader(){},end(str){this.body=JSON.parse(str);}};
   await handler({method,body,query:{guided:"1",id}},res);return res;
  };
  const payload={action:"confirm_site_inventory",mission_id:ID,request_id:REQUEST,revision:2,
   site_status:"existing",site_name:"Sparrow Wreath Preview",site_url:""};
  assert.equal((await invoke({...payload,site_status:"invalid"})).statusCode,400);
  assert.equal((await invoke({...payload,site_url:"https://user:password@example.com"})).statusCode,400);
  assert.equal((await invoke({...payload,site_status:"new",site_name:"Not permitted"})).statusCode,400);
  const saved=await invoke(payload);
  assert.equal(saved.statusCode,200);assert.equal(saved.body.mission.step_index,3);
  assert.equal(saved.body.mission.setup_context.verification,"user_reported_unverified");
  assert.equal(saved.body.mission.setup_context.site_connection,"not_connected");
  assert.equal(saved.body.mission.setup_context.checkout_verified,false);
  assert.equal(saved.body.mission.setup_context.created_site,false);
  assert.equal(writes,1);assert.equal(events,1);
  const replay=await invoke(payload);
  assert.equal(replay.body.replayed,true);assert.equal(writes,1);assert.equal(events,1);
  owner=OTHER;
  assert.equal((await invoke(payload)).statusCode,404);
  assert.equal((await invoke(null,"GET")).body.mission,null);
  owner=OWNER;
  assert.equal((await invoke(null,"GET")).body.mission.setup_context.site_name,"Sparrow Wreath Preview");
 }finally{db.query=origQuery;db.transaction=origTx;auth.requireUser=origAuth;delete require.cache[route];}
});
test("Step 3 is visibly opt-in and retains an unverified next step",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
 const client=fs.readFileSync(path.join(__dirname,"../../guided-mission.js"),"utf8");
 assert.match(html,/Do you already have a Wix website/);
 assert.match(html,/id="guided-step-four" hidden/);
 assert.match(client,/confirmSiteInventory/);
 assert.match(client,/verifiedReadback\(current\.id\)/);
 assert.doesNotMatch(client,/createSite|publishSite|checkoutSession/);
});
