"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const auth=require("../../lib/billing/auth"),db=require("../../lib/billing/db");
const OWNER="00000000-0000-4000-8000-000000000001",OTHER="00000000-0000-4000-8000-000000000002";
const ID="14279b8a-fd88-416a-aa38-0750718fae94";
const SITE_ID="438bf0a6-4162-4166-9a14-30ccd129ff00";
test("Disabled Wix integration is account scoped and cannot start a site installation",async()=>{
 const originalAuth=auth.requireUser,originalQuery=db.query,originalEnabled=process.env.AI4U_WIX_AUDIT_ENABLED;
 const ref=require.resolve("../../lib/mission/wix-connection");
 let signedIn=OWNER,writes=0;
 try{
  process.env.AI4U_WIX_AUDIT_ENABLED="false";
  auth.requireUser=async()=>({id:signedIn,email:"test@example.com"});
  db.query=async(sql,args)=>{
   if(sql.startsWith("SELECT * FROM ai4u_private.router_guided_missions WHERE id=$1")){
    return {rows:args[1]===OWNER?[{id:ID,user_id:OWNER,status:"awaiting_site_review",step_index:3,
     route_choice:{platform:"wix"},setup_context:{site_status:"existing",site_name:"Sparrow Wreath Preview",commerce_review:{proof_mission_id:"6374615d-80ad-4d1e-aa5f-712ac6cf475a"}}}]:[]};
   }
   if(sql.includes("FROM ai4u_private.router_wix_connections"))return {rows:[]};
   if(/^INSERT|^UPDATE/.test(sql)){writes++;throw Error("Unexpected write while disabled");}
   throw Error("Unexpected SQL: "+sql.slice(0,100));
  };
  delete require.cache[ref];const handler=require(ref);
  const invoke=async(method,body,query={wix_audit:"1",mission_id:ID})=>{
   const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(text){this.body=text?JSON.parse(text):null;}};
   await handler({method,body,query,headers:{}},res);return res;
  };
  let response=await invoke("GET");
  assert.equal(response.statusCode,200);
  assert.equal(response.body.configuration,"not_configured");
  assert.equal(response.body.connection,null);
  response=await invoke("POST",{action:"begin",mission_id:ID,explicit_consent:false});
  assert.equal(response.statusCode,400);
  response=await invoke("POST",{action:"begin",mission_id:ID,explicit_consent:true});
  assert.equal(response.statusCode,409);
  assert.match(response.body.error,/not configured/);
  signedIn=OTHER;
  response=await invoke("GET");
  assert.equal(response.statusCode,404);
  assert.equal(writes,0);
  assert.equal(SITE_ID,"438bf0a6-4162-4166-9a14-30ccd129ff00");
 }finally{
  auth.requireUser=originalAuth;db.query=originalQuery;
  if(originalEnabled===undefined)delete process.env.AI4U_WIX_AUDIT_ENABLED;
  else process.env.AI4U_WIX_AUDIT_ENABLED=originalEnabled;
  delete require.cache[ref];
 }
});
