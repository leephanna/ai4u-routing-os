"use strict";
// Deliberately separate from the saved Sparrow Wreath guided mission.
// Owner-triggered, non-persistent smoke test against one allowlisted Wix dev site.
// This route never returns tokens, app instances or product details.
const crypto=require("node:crypto");
const {send,readJson}=require("../billing/http");
const DEV_SITE_ID="428fe383-e0c7-47a9-9ae9-b714b06f9392";
const APP_ID_RE=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const INSTANCE_RE=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function configuration(env=process.env){
 const appId=env.AI4U_WIX_AUDIT_APP_ID||"",secret=env.AI4U_WIX_AUDIT_APP_SECRET||"";
 return {appId,secret,enabled:env.AI4U_WIX_DEV_PROBE_ENABLED==="true"&&APP_ID_RE.test(appId)&&secret.length>=16};
}
function verifySignedInstance(instance,secret){
 if(typeof instance!=="string"||instance.length>8192)return null;
 const parts=instance.split(".");
 if(parts.length!==2||!parts[0]||!parts[1]||!(/^[A-Za-z0-9_-]+$/.test(parts[0]))||!(/^[A-Za-z0-9_-]+$/.test(parts[1])))return null;
 const provided=Buffer.from(parts[0],"base64url");
 const expected=crypto.createHmac("sha256",secret).update(parts[1]).digest();
 if(provided.length!==expected.length||!crypto.timingSafeEqual(provided,expected))return null;
 try{
  const data=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
  if(!data||!INSTANCE_RE.test(String(data.instanceId||"")))return null;
  // A contributor or an anonymous Wix visitor must not run an elevated app test.
  if(!INSTANCE_RE.test(String(data.uid||""))||data.uid!==data.siteOwnerId||data.aid)return null;
  return {instanceId:data.instanceId};
 }catch{return null;}
}
async function wixRequest(url,options){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
 try{
  const res=await fetch(url,{...options,signal:ctrl.signal,cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Object.assign(new Error("Wix connection unavailable"),{status:res.status});
  return data;
 }finally{clearTimeout(timer);}
}
async function probe(instance,config){
 const verified=verifySignedInstance(instance,config.secret);
 if(!verified)return {statusCode:403,error:"Wix site-owner authorization could not be verified."};
 const info=await wixRequest("https://www.wixapis.com/oauth2/token-info",{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:instance})
 });
 const valid=(info.active===true||info.active==="true")&&
  String(info.clientId||"").toLowerCase()===config.appId.toLowerCase()&&
  String(info.siteId||"").toLowerCase()===DEV_SITE_ID&&
  String(info.instanceId||"")===verified.instanceId;
 if(!valid)return {statusCode:403,error:"This Wix installation is not the authorized AI4U development site."};
 const access=await wixRequest("https://www.wixapis.com/oauth2/token",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({grant_type:"client_credentials",client_id:config.appId,client_secret:config.secret,instance_id:verified.instanceId})
 });
 if(typeof access.access_token!=="string"||access.access_token.length<10)
  return {statusCode:502,error:"Wix did not issue an app token for this installation."};
 const products=await wixRequest("https://www.wixapis.com/stores-reader/v1/products/query",{
  method:"POST",headers:{"Content-Type":"application/json",Authorization:access.access_token},
  body:JSON.stringify({query:{paging:{limit:1,offset:0}}})
 });
 // Never return product contents or raw Wix security claims.
 return {statusCode:200,status:"verified_dev_read",site:"AI4U Inspector Test Site",
  catalog_version:"v1",sample_count:Array.isArray(products.products)?products.products.length:null,
  visible_total:Number.isInteger(products.totalResults)?products.totalResults:null,
  scope:"One product metadata query; no writes, checkout, payments or customer data",
  tested_at:new Date().toISOString()};
}
async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 if(req.method!=="POST")return send(res,405,{error:"Method not allowed."});
 const config=configuration();
 if(!config.enabled)return send(res,409,{error:"Development-site Wix OAuth smoke test is not enabled."});
 try{
  const body=await readJson(req);
  if(body?.confirm_readonly!==true)return send(res,400,{error:"Explicit read-only confirmation required."});
  const instance=body?.instance;
  if(typeof instance!=="string"||instance.length>8192)return send(res,400,{error:"A signed Wix app instance is required."});
  const result=await probe(instance,config);
  const {statusCode,...publicResult}=result;
  return send(res,statusCode,publicResult);
 }catch(e){
  // Do not disclose tokens, signed app instances, Wix error bodies or identities.
  return send(res,502,{error:"Wix did not verify this read-only development-site inspection."});
 }
}
module.exports=handler;
module.exports._test={configuration,verifySignedInstance,probe,DEV_SITE_ID};
