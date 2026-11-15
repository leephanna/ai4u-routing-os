"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {configuration,verifySignedInstance,inspectSignedInstance,probe,DEV_SITE_ID}=require("../../lib/mission/wix-dev-probe")._test;
const appId="bda78d68-1ef8-4c6b-9baa-cfdac21e03b8",inst="22222222-2222-4222-8222-222222222222";
const owner="33333333-3333-4333-8333-333333333333",secret="example-only-test-secret-with-length";
const signed=payload=>{
 const data=Buffer.from(JSON.stringify(payload)).toString("base64url");
 return crypto.createHmac("sha256",secret).update(data).digest("base64url")+"."+data;
};
const instance=overrides=>signed({instanceId:inst,uid:owner,siteOwnerId:owner,permissions:"OWNER",...overrides});
const config={enabled:true,appId,secret};
test("Development probe defaults off even with Wix OAuth credentials",()=>{
 assert.equal(configuration({}).enabled,false);
 assert.equal(configuration({AI4U_WIX_DEV_PROBE_ENABLED:"true",AI4U_WIX_AUDIT_APP_ID:appId}).enabled,false);
 assert.equal(configuration({AI4U_WIX_DEV_PROBE_ENABLED:"false",AI4U_WIX_AUDIT_APP_ID:appId,AI4U_WIX_AUDIT_APP_SECRET:secret}).enabled,false);
 assert.equal(configuration({AI4U_WIX_DEV_PROBE_ENABLED:"true",AI4U_WIX_AUDIT_APP_ID:appId,AI4U_WIX_AUDIT_APP_SECRET:secret}).enabled,true);
});
test("Rejects fabricated, collaborator and anonymous instance before Wix API",async()=>{
 let calls=0;const old=global.fetch;
 global.fetch=async()=>{calls++;throw Error("Should not reach Wix")};
 try{
  assert.equal(verifySignedInstance(instance({uid:"44444444-4444-4444-8444-444444444444"}),secret),null);
  assert.equal(verifySignedInstance(instance({aid:"anon"}),secret),null);
  assert.equal(verifySignedInstance("fake."+instance().split(".")[1],secret),null);
  const result=await probe(instance({uid:"44444444-4444-4444-8444-444444444444"}),config);
  assert.equal(result.statusCode,403);assert.equal(calls,0);
 }finally{global.fetch=old;}
});
test("Rejects different Wix tenant ID or app ID before minting app token",async()=>{
 const original=global.fetch,calls=[];
 global.fetch=async(url,opts)=>{
  calls.push(url);
  return {ok:true,json:async()=>({active:true,client_id:appId,site_id:"438bf0a6-4162-4166-9a14-30ccd129ff00",instance_id:inst})};
 };
 try{
  const result=await probe(instance(),config);
  assert.equal(result.statusCode,403);
  assert.equal(calls.length,1);
  assert.equal(calls[0],"https://www.wixapis.com/oauth2/token-info");
 }finally{global.fetch=original;}
});
test("Valid dev-site Wix owner app reads only one V1 product, returns count not details",async()=>{
 const original=global.fetch,calls=[];
 global.fetch=async(url,opts)=>{
  calls.push({url,method:opts.method,body:opts.body||""});
  const value=url.endsWith("/token-info")?
    {active:true,site_id:DEV_SITE_ID,client_id:appId,instance_id:inst}:
    url.endsWith("/token")?{access_token:"test-wix-app-access-token"}:
    {products:[{id:"secret-sample-id",name:"must-not-return"}],totalResults:12};
  return {ok:true,json:async()=>value};
 };
 try{
  const result=await probe(instance(),config);
  assert.equal(result.statusCode,200);
  assert.equal(result.status,"verified_dev_read");
  assert.equal(result.sample_count,1);
  assert.equal(result.visible_total,12);
  assert.doesNotMatch(JSON.stringify(result),/secret-sample-id|must-not-return|test-wix-app-access-token|33333333/);
  assert.deepEqual(calls.map(c=>c.url),[
   "https://www.wixapis.com/oauth2/token-info",
   "https://www.wixapis.com/oauth2/token",
   "https://www.wixapis.com/stores-reader/v1/products/query"
  ]);
  assert.equal(JSON.parse(calls[1].body).instanceId,inst);
  assert.deepEqual(JSON.parse(calls[2].body),{query:{paging:{limit:1,offset:0}}});
  assert.ok(calls.every(c=>c.method==="POST"));
 }finally{global.fetch=original;}
});
test("Non-Wix, unenabled or wrong request method cannot initiate product reads",async()=>{
 const handler=require("../../lib/mission/wix-dev-probe");
 const old=process.env.AI4U_WIX_DEV_PROBE_ENABLED;
 process.env.AI4U_WIX_DEV_PROBE_ENABLED="false";
 const response=()=>({statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=v}});
 try{
  const denied=response();
  await handler({method:"POST"},denied);
  assert.equal(denied.statusCode,409);
  const wrong=response();
  await handler({method:"GET"},wrong);
  assert.equal(wrong.statusCode,405);
 }finally{if(old===undefined)delete process.env.AI4U_WIX_DEV_PROBE_ENABLED;else process.env.AI4U_WIX_DEV_PROBE_ENABLED=old;}
});

test("Wix signed OWNER instance accepts non-UUID member IDs but rejects contributors",()=>{
 const ownerToken=instance({uid:"wix_owner_identifier",siteOwnerId:"wix_owner_identifier"});
 assert.equal(verifySignedInstance(ownerToken,secret).instanceId,inst);
 assert.equal(verifySignedInstance(instance({uid:"contributor",siteOwnerId:"owner",permissions:"OWNER"}),secret),null);
 assert.equal(verifySignedInstance(instance({uid:"contributor",siteOwnerId:"owner",permissions:"CONTRIBUTOR"}),secret),null);
 assert.equal(verifySignedInstance(instance({uid:"",siteOwnerId:"",permissions:"OWNER"}),secret).instanceId,inst);
});

test("Authorization diagnostics distinguish signature mismatch from owner restriction without leaking claims",async()=>{
 assert.equal(inspectSignedInstance("fake."+instance().split(".")[1],secret).reason,"WIX_AUTH_SIGNATURE_MISMATCH");
 assert.equal(inspectSignedInstance(instance({uid:"contributor",siteOwnerId:"owner"}),secret).reason,"WIX_AUTH_OWNER_MISMATCH");
 assert.equal(inspectSignedInstance(instance({permissions:"CONTRIBUTOR",uid:"",siteOwnerId:""}),secret).reason,"WIX_AUTH_OWNER_PERMISSION_MISSING");
 const wrong=await probe(instance({uid:"contributor",siteOwnerId:"owner"}),config);
 assert.equal(wrong.statusCode,403);
 assert.equal(wrong.diagnostic_code,"WIX_AUTH_OWNER_MISMATCH");
 assert.doesNotMatch(JSON.stringify(wrong),/contributor|33333333/);
});
