"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const mod=require("../../lib/mission/wix-connection");
const {settings,sha,encrypt,decrypt,verifySignedInstance,auditReadOnly}=mod._test;
const ID="12345678-1234-4123-8123-123456789abc";
const secret="a-long-test-secret-value";
test("Wix integration is DISABLED until explicitly enabled with complete server-side app settings",()=>{
 assert.equal(settings({}).enabled,false);
 assert.equal(settings({AI4U_WIX_AUDIT_ENABLED:"true"}).enabled,false);
 assert.equal(settings({AI4U_WIX_AUDIT_ENABLED:"false",AI4U_WIX_AUDIT_APP_ID:ID,AI4U_WIX_AUDIT_APP_SECRET:secret,
  AI4U_WIX_AUDIT_SHARE_URL_ID:ID,AI4U_WIX_AUDIT_ENCRYPTION_KEY:"ab".repeat(32)}).enabled,false);
 assert.equal(settings({AI4U_WIX_AUDIT_ENABLED:"true",AI4U_WIX_AUDIT_APP_ID:ID,AI4U_WIX_AUDIT_APP_SECRET:secret,
  AI4U_WIX_AUDIT_SHARE_URL_ID:ID,AI4U_WIX_AUDIT_ENCRYPTION_KEY:"ab".repeat(32)}).enabled,true);
});
test("State hashes do not expose the random state; Wix signed instance must pass constant-time HMAC validation",()=>{
 const state="A".repeat(43);
 assert.equal(sha(state),crypto.createHash("sha256").update(state).digest("hex"));
 const data=Buffer.from(JSON.stringify({instanceId:ID,siteOwnerId:"no-risk"})).toString("base64url");
 const signature=crypto.createHmac("sha256",secret).update(data).digest("base64url");
 assert.equal(verifySignedInstance(signature+"."+data,secret).instanceId,ID);
 assert.equal(verifySignedInstance(signature+"."+data,"wrong-secret"),null);
 assert.equal(verifySignedInstance(signature+"."+data.slice(0,-1)+"B",secret),null);
 assert.equal(verifySignedInstance("bad.sign",secret),null);
 assert.equal(verifySignedInstance(signature+"."+Buffer.from("{}").toString("base64url"),secret),null);
});
test("Stored Wix instance ID is encrypted at rest with authentication tag",()=>{
 const key=crypto.randomBytes(32).toString("hex");
 const value=encrypt(ID,key);
 assert.notEqual(value,ID);
 assert.equal(decrypt(value,key),ID);
 assert.throws(()=>decrypt(value,crypto.randomBytes(32).toString("hex")));
});
test("Read-only inventory requests use fixed official endpoints and return no user/customer data",async()=>{
 const previous=global.fetch,calls=[];
 global.fetch=async(url,opts)=>{
  calls.push({url,method:opts.method,body:opts.body||""});
  return {ok:true,json:async()=>url.includes("apps-installer")
   ?{appInstances:[{appId:"a"},{appId:"b"}]}
   :{products:[{id:"product-id"}],pagingMetadata:{hasNext:true}}};
 };
 try{
  const result=await auditReadOnly("unit-test-token");
  assert.equal(result.installed_apps.status,"returned");
  assert.equal(result.installed_apps.count,2);
  assert.equal(result.catalog.status,"query_succeeded");
  assert.equal(result.catalog.returned_sample_count,1);
  assert.equal(result.payments,"not_verified");
  assert.equal(result.checkout,"not_verified");
  assert.equal(result.shipping,"not_verified");
  assert.deepEqual(calls.map(c=>c.url),[
   "https://www.wixapis.com/apps-installer-service/v1/app-instances",
   "https://www.wixapis.com/stores/v3/products/query"
  ]);
  assert.deepEqual(calls.map(c=>c.method),["GET","POST"]);
  assert.ok(calls.every(c=>!c.body.includes("product-id")));
 }finally{global.fetch=previous;}
});
test("Permission errors are UNKNOWN, not absence of Wix commerce",async()=>{
 const previous=global.fetch;
 global.fetch=async()=>({ok:false,status:403,json:async()=>({message:"Permission denied"})});
 try{
  const r=await auditReadOnly("test");
  assert.equal(r.installed_apps.status,"unavailable");
  assert.equal(r.catalog.status,"unavailable");
  assert.equal(r.catalog.http_status,403);
  assert.equal(r.payments,"not_verified");
 }finally{global.fetch=previous;}
});
test("Wix HTTP 428 with REQUIRED_APP_NOT_INSTALLED is diagnosed as a missing native Store, not a zero-product catalog",async()=>{
 const previous=global.fetch;
 global.fetch=async(url)=>{
  if(url.includes("apps-installer"))return {ok:true,json:async()=>({appInstances:[]})};
  return {ok:false,status:428,json:async()=>({message:"Wix Stores app is not installed for site",
   details:{applicationError:{code:"REQUIRED_APP_NOT_INSTALLED"}}})};
 };
 try{
  const report=await auditReadOnly("stub-access-token");
  assert.equal(report.catalog.status,"wix_stores_not_installed");
  assert.equal(report.catalog.http_status,428);
  assert.equal(report.catalog.error_code,"REQUIRED_APP_NOT_INSTALLED");
  assert.equal(report.catalog.returned_sample_count,undefined);
  assert.equal(report.payments,"not_verified");
 }finally{global.fetch=previous;}
});
test("Wix connection route retains the existing mission API and refuses callback credentials without config",async()=>{
 const fs=require("node:fs"),path=require("node:path");
 const api=fs.readFileSync(path.join(__dirname,"../../api/mission/site-audit.js"),"utf8");
 const ui=fs.readFileSync(path.join(__dirname,"../../guided-mission.js"),"utf8");
 const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
 assert.match(api,/req\.query\.wix_audit==="1"\|\|req\.query\.wix_callback==="1"/);
 assert.match(ui,/beginWixConnection,runWixInventory/);
 assert.match(html,/id="guided-wix-connect-consent"/);
 assert.match(html,/id="guided-wix-audit-consent"/);
 assert.match(html,/This independent connection requires a dedicated Wix Developer app/);
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=v;}};
 await mod({method:"GET",query:{wix_callback:"1",state:"A".repeat(43)}},res);
 assert.equal(res.statusCode,303);
 assert.equal(res.headers.Location,"https://routing.ai4utech.com/?wix_connection=unconfigured");
});

test("V1 catalog uses the published V1 read-only endpoint, bounded query and records visible total",async()=>{
 const previous=global.fetch,calls=[];
 global.fetch=async(url,opts)=>{
  calls.push({url,opts});
  return {ok:true,status:200,json:async()=>url.includes("apps-installer")?{appInstances:[]}:{products:[{id:"sample"}],totalResults:12}};
 };
 try{
  const result=await auditReadOnly("test-token","v1");
  assert.equal(result.catalog_version,"v1");
  assert.equal(result.catalog.status,"query_succeeded");
  assert.equal(result.catalog.returned_sample_count,1);
  assert.equal(result.catalog.visible_total,12);
  assert.equal(result.catalog.has_next,true);
  assert.equal(result.payments,"not_verified");
  const product=calls[1];
  assert.equal(product.url,"https://www.wixapis.com/stores-reader/v1/products/query");
  assert.deepEqual(JSON.parse(product.opts.body),{query:{paging:{limit:1,offset:0}}});
  assert.equal(product.opts.method,"POST");
 }finally{global.fetch=previous;}
});
test("Unknown catalog version is rejected before any external call",async()=>{
 const previous=global.fetch;
 global.fetch=async()=>{throw new Error("Must not make requests");};
 try{await assert.rejects(()=>auditReadOnly("test-token","auto"),/Unsupported Wix catalog version/);}
 finally{global.fetch=previous;}
});

test("Wix app OAuth token must match the actual expected tenant before inspection",async()=>{
 const original=global.fetch,calls=[],devSite="428fe383-e0c7-47a9-9ae9-b714b06f9392";
 const auth={appId:ID,secret};
 const {scopedToken}=mod._test;
 global.fetch=async(url)=>{
  calls.push(url);
  const payload=url.endsWith("/token")?{access_token:"test-wix-token-value"}:
   {active:true,client_id:ID,site_id:devSite,instance_id:ID};
  return {ok:true,json:async()=>payload};
 };
 try{
  assert.equal(await scopedToken(ID,auth,devSite),"test-wix-token-value");
  await assert.rejects(()=>scopedToken(ID,auth,"438bf0a6-4162-4166-9a14-30ccd129ff00"),/site binding/);
  assert.deepEqual(calls,[
   "https://www.wixapis.com/oauth2/token",
   "https://www.wixapis.com/oauth2/token-info",
   "https://www.wixapis.com/oauth2/token",
   "https://www.wixapis.com/oauth2/token-info"
  ]);
 }finally{global.fetch=original;}
});
