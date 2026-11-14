"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const db=require("../../lib/billing/db"),auth=require("../../lib/billing/auth");
const OWNER="00000000-0000-4000-8000-000000000001",OTHER="00000000-0000-4000-8000-000000000002";
const ID="14279b8a-fd88-416a-aa38-0750718fae94",REQ="77777777-7777-4777-8777-777777777777";
const PROOF="6374615d-80ad-4d1e-aa5f-712ac6cf475a";
const SITE="https://headless-etnhqsdtksr-leehanna8-1409.wix-site-host.com/";
test("Record evidence-scoped commerce review with account ownership, revision, idempotency and no false advancement",async()=>{
 const oldQuery=db.query,oldTx=db.transaction,oldAuth=auth.requireUser;
 const handlerRef=require.resolve("../../lib/mission/guided-handler");
 let account=OWNER,writes=0,events=0;
 const html=Buffer.from('<html><meta name="robots" content="noindex, nofollow"><div class="product-card">A first-look website preview</div></html>');
 const sha=crypto.createHash("sha256").update(html).digest("hex");
 let row={id:ID,user_id:OWNER,revision:3,step_index:3,status:"awaiting_site_review",
  plan_id:"22222222-2222-4222-8222-222222222222",
  route_choice:{platform:"wix"},
  setup_context:{site_status:"existing",site_name:"Sparrow Wreath Preview",site_url:null},last_request_id:null};
 const query=async(sql,args)=>{
  if(sql.includes("FOR UPDATE"))return {rows:args[1]===account&&account===OWNER?[{...row}]:[]};
  if(sql.includes("FROM ai4u_private.router_missions m LEFT JOIN LATERAL")){
   assert.deepEqual(args,[OWNER,SITE]);
   return {rows:[{id:PROOF,target_url:SITE,status:"complete",checked_at:"2026-11-14T05:35:32Z",
     checks:Array.from({length:5},()=>({status:"pass"})),sample_bytes:html,sample_sha256:sha}]};
  }
  if(sql.startsWith("UPDATE ai4u_private.router_guided_missions")){
   writes++;row={...row,setup_context:JSON.parse(args[2]),revision:4,last_request_id:args[3]};
   return {rows:[{...row}]};
  }
  if(sql.startsWith("INSERT INTO ai4u_private.router_guided_events")){events++;return {rows:[]};}
  if(sql.startsWith("SELECT g.* FROM ai4u_private.router_guided_missions"))
   return {rows:account===OWNER?[{...row}]:[]};
  throw Error("Unexpected SQL: "+sql.slice(0,100));
 };
 const res=()=>({statusCode:200,setHeader(){},end(text){this.body=JSON.parse(text);}});
 try{
  auth.requireUser=async()=>({id:account});db.query=query;db.transaction=async work=>work({query});
  delete require.cache[handlerRef];const handler=require(handlerRef);
  const call=async(body,method="POST")=>{const r=res();await handler({method,body,query:{id:ID}},r);return r;};
  const payload={action:"record_commerce_review",mission_id:ID,revision:3,request_id:REQ,acknowledge_scope:true};
  assert.equal((await call({...payload,acknowledge_scope:false})).statusCode,400);
  const saved=await call(payload);
  assert.equal(saved.statusCode,200);
  assert.equal(saved.body.mission.step_index,3);
  assert.equal(saved.body.mission.status,"awaiting_site_review");
  assert.equal(saved.body.mission.setup_context.commerce_review.proof_mission_id,PROOF);
  assert.equal(saved.body.mission.setup_context.commerce_review.result,"homepage_verified_commerce_not_verified");
  assert.equal(writes,1);assert.equal(events,1);
  assert.equal((await call(payload)).body.replayed,true);
  assert.equal(writes,1);assert.equal(events,1);
  assert.equal((await call({...payload,request_id:"88888888-8888-4888-8888-888888888888"})).statusCode,409);
  account=OTHER;
  assert.equal((await call(payload)).statusCode,404);
  assert.equal((await call(null,"GET")).body.mission,null);
  account=OWNER;
  const restored=await call(null,"GET");
  assert.equal(restored.body.mission.setup_context.commerce_review.proof_mission_id,PROOF);
 }finally{db.query=oldQuery;db.transaction=oldTx;auth.requireUser=oldAuth;delete require.cache[handlerRef];}
});
