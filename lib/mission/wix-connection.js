"use strict";
// Wix's separately authenticated ChatGPT connection is NEVER a Routing OS credential.
// This server-only Wix app install flow is intentionally disabled until its own
// least-privilege developer app and secret settings are configured.
const crypto=require("node:crypto");
const db=require("../billing/db");
const {requireUser}=require("../billing/auth");
const {send,readJson}=require("../billing/http");
const {selectedSite}=require("./commerce-readiness");
const SITE_ID="438bf0a6-4162-4166-9a14-30ccd129ff00";
const BASE="https://routing.ai4utech.com";
const CALLBACK=BASE+"/api/mission/site-audit?wix_callback=1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const APP_ID=/^[0-9a-f-]{36}$/i;
function settings(env=process.env){
 const appId=env.AI4U_WIX_AUDIT_APP_ID||"",secret=env.AI4U_WIX_AUDIT_APP_SECRET||"",
  shareUrlId=env.AI4U_WIX_AUDIT_SHARE_URL_ID||"",key=env.AI4U_WIX_AUDIT_ENCRYPTION_KEY||"";
 const enabled=env.AI4U_WIX_AUDIT_ENABLED==="true"&&APP_ID.test(appId)&&secret.length>=16&&
  APP_ID.test(shareUrlId)&&/^[0-9a-f]{64}$/i.test(key);
 return {enabled,appId,secret,shareUrlId,key};
}
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
function encrypt(instanceId,keyHex){
 const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",Buffer.from(keyHex,"hex"),nonce);
 const ciphertext=Buffer.concat([cipher.update(instanceId,"utf8"),cipher.final()]);
 return Buffer.concat([nonce,cipher.getAuthTag(),ciphertext]).toString("base64url");
}
function decrypt(ciphertext,keyHex){
 const data=Buffer.from(ciphertext,"base64url");
 if(data.length<29)throw Error("Corrupt stored Wix authorization");
 const dec=crypto.createDecipheriv("aes-256-gcm",Buffer.from(keyHex,"hex"),data.subarray(0,12));
 dec.setAuthTag(data.subarray(12,28));
 return Buffer.concat([dec.update(data.subarray(28)),dec.final()]).toString("utf8");
}
function verifySignedInstance(encoded,secret){
 if(typeof encoded!=="string"||encoded.length>8192)return null;
 const pair=encoded.split(".");
 if(pair.length!==2||!pair[0]||!pair[1])return null;
 const signature=Buffer.from(pair[0],"base64url"),expected=crypto.createHmac("sha256",secret).update(pair[1]).digest();
 if(signature.length!==expected.length||!crypto.timingSafeEqual(signature,expected))return null;
 try{
  const payload=JSON.parse(Buffer.from(pair[1],"base64url").toString("utf8"));
  if(!payload||typeof payload.instanceId!=="string"||!UUID.test(payload.instanceId))return null;
  return payload;
 }catch{return null;}
}
async function wixJson(url,options={}){
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),10000);
 try{
  const r=await fetch(url,{...options,signal:ctrl.signal,cache:"no-store"});
  const body=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error("Wix API did not permit the read-only inspection.");e.wixStatus=r.status;throw e;}
  return body;
 }finally{clearTimeout(timeout);}
}
async function token(instanceId,config){
 const payload=await wixJson("https://www.wixapis.com/oauth2/token",{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
   grant_type:"client_credentials",client_id:config.appId,client_secret:config.secret,instance_id:instanceId
  })
 });
 if(typeof payload.access_token!=="string"||!payload.access_token)throw Error("Wix did not issue an app access token.");
 return payload.access_token;
}
async function auditReadOnly(accessToken){
 // These are fixed service URLs, never constructed from user input.
 const headers={Authorization:accessToken,"Content-Type":"application/json"};
 const checks=await Promise.allSettled([
  wixJson("https://www.wixapis.com/apps-installer-service/v1/app-instances",{method:"GET",headers}),
  wixJson("https://www.wixapis.com/stores/v3/products/query",{method:"POST",headers,body:JSON.stringify({fields:[],query:{cursorPaging:{limit:1}}})})
 ]);
 const [apps,products]=checks;
 return {
  inspected_at:new Date().toISOString(),
  site_id:SITE_ID,
  scope:"Wix app read-only: installed app inventory and V3 product query only; no orders, customers or payments requested",
  installed_apps:apps.status==="fulfilled"
   ?{status:"returned",count:Array.isArray(apps.value.appInstances)?apps.value.appInstances.length:null}
   :{status:"unavailable",http_status:apps.reason?.wixStatus||null},
  catalog:products.status==="fulfilled"
   ?{status:"query_succeeded",returned_sample_count:Array.isArray(products.value.products)?products.value.products.length:null,
     has_next:products.value.pagingMetadata?.hasNext??null}
   :{status:"unavailable",http_status:products.reason?.wixStatus||null},
  payments:"not_verified",checkout:"not_verified",shipping:"not_verified",pickup:"not_verified",
  confidence:"No claim of complete commerce readiness. App inventory counts cannot identify Wix Stores without ID mapping."
 };
}
function publicConnection(row){
 return row?{status:row.status,site_id:row.site_id,connected_at:row.connected_at,
  last_inspection:row.summary||null}:null;
}
async function findMission(client,id,userId){
 const r=await client.query("SELECT * FROM ai4u_private.router_guided_missions WHERE id=$1 AND user_id=$2 LIMIT 1",[id,userId]);
 return r.rows[0]||null;
}
async function connectionStatus(user,id,config){
 const mission=await findMission(db,id,user.id);
 if(!mission)return {statusCode:404,error:"This guided mission is not in your account."};
 const target=selectedSite(mission);
 if(!target||target.wix_site_id!==SITE_ID)return {statusCode:422,error:"This pilot supports the saved Sparrow Wreath Preview site only."};
 const result=await db.query("SELECT status,site_id,connected_at,summary FROM ai4u_private.router_wix_connections WHERE user_id=$1 AND guided_mission_id=$2 LIMIT 1",[user.id,id]);
 return {statusCode:200,configuration:config.enabled?"ready":"not_configured",
  required_setup:config.enabled?null:"A dedicated Wix Developer app with only read permissions and secure server configuration is required before connecting.",
  connection:publicConnection(result.rows[0])};
}
async function begin(user,id,config){
 if(!config.enabled)return {statusCode:409,error:"Read-only Wix connection is not configured. No site access or installation was attempted."};
 const mission=await findMission(db,id,user.id);
 if(!mission)return {statusCode:404,error:"Guided mission not found for this account."};
 if(mission.step_index!==3||mission.status!=="awaiting_site_review"||!selectedSite(mission)||!mission.setup_context?.commerce_review)
  return {statusCode:409,error:"Complete the saved Commerce Readiness review before authorizing Wix access."};
 const state=crypto.randomBytes(32).toString("base64url");
 await db.query("INSERT INTO ai4u_private.router_wix_connect_states(state_hash,user_id,guided_mission_id,expected_site_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '15 minutes')",
  [sha(state),user.id,id,SITE_ID]);
 const callback=new URL(CALLBACK);
 callback.searchParams.set("state",state);
 const install=new URL("https://www.wix.com/app-installer");
 install.searchParams.set("appId",config.appId);
 install.searchParams.set("shareUrlId",config.shareUrlId);
 install.searchParams.set("postInstallationUrl",callback.href);
 return {statusCode:200,install_url:install.href,scope:"Site authorization through Wix. User must review requested permissions before installing; no purchase is authorized."};
}
function redirect(res,result){
 // Never reflect untrusted Wix query values, OAuth tokens or state to the browser.
 res.statusCode=303;res.setHeader("Location",BASE+"/?wix_connection="+result);
 res.setHeader("Cache-Control","no-store");res.end();
}
async function callback(req,res,config){
 if(req.method!=="GET")return send(res,405,{error:"Method not allowed"});
 if(!config.enabled)return redirect(res,"unconfigured");
 const query=req.query||{},state=String(query.state||"");
 if(!/^[A-Za-z0-9_-]{43}$/.test(state))return redirect(res,"invalid");
 const result=await db.query(
  "SELECT * FROM ai4u_private.router_wix_connect_states WHERE state_hash=$1 AND consumed_at IS NULL AND expires_at>now() LIMIT 1",
  [sha(state)]);
 if(!result.rows.length)return redirect(res,"expired");
 const pending=result.rows[0];
 const signed=verifySignedInstance(String(query.signedInstance||""),config.secret);
 if(!signed||String(query.appId||"")!==config.appId||
   String(query.tenantId||"")!==pending.expected_site_id||
   String(query.instanceId||"")!==signed.instanceId||
   pending.expected_site_id!==SITE_ID)return redirect(res,"invalid");
 // The signed instance plus a successful OAuth token response proves an installation,
 // but not a permission to modify the site or a functional store.
 try{await token(signed.instanceId,config);}catch{return redirect(res,"unverified");}
 const resultCode=await db.transaction(async client=>{
  const claimed=await client.query(
   "UPDATE ai4u_private.router_wix_connect_states SET consumed_at=now() WHERE state_hash=$1 AND consumed_at IS NULL AND expires_at>now() RETURNING *",
   [sha(state)]);
  if(!claimed.rows.length)return "expired";
  const m=await findMission(client,pending.guided_mission_id,pending.user_id);
  if(!m||m.step_index!==3||m.status!=="awaiting_site_review"||!selectedSite(m))return "invalid";
  await client.query(
   "INSERT INTO ai4u_private.router_wix_connections(user_id,guided_mission_id,site_id,encrypted_instance,status,connected_at) VALUES($1,$2,$3,$4,'authorized',now()) ON CONFLICT (user_id,guided_mission_id) DO UPDATE SET encrypted_instance=EXCLUDED.encrypted_instance,status='authorized',connected_at=now(),summary='{}'::jsonb",
   [pending.user_id,pending.guided_mission_id,SITE_ID,encrypt(signed.instanceId,config.key)]);
  return "authorized";
 });
 return redirect(res,resultCode);
}
async function inspect(user,body,config){
 if(!config.enabled)return {statusCode:409,error:"The Wix audit connection has not been configured."};
 const id=String(body.mission_id||""),requestId=String(body.request_id||"");
 if(!UUID.test(id)||!UUID.test(requestId)||!Number.isSafeInteger(body.revision))
  return {statusCode:400,error:"A valid mission, request ID and revision are required."};
 if(body.confirm_readonly!==true)
  return {statusCode:400,error:"Confirm this action requests only read-only site inventory and product metadata."};
 const mission=await findMission(db,id,user.id);
 if(!mission)return {statusCode:404,error:"Guided mission not found for this account."};
 if(mission.step_index!==3||!selectedSite(mission))return {statusCode:409,error:"Site review is not the active mission step."};
 const found=await db.query("SELECT * FROM ai4u_private.router_wix_connections WHERE user_id=$1 AND guided_mission_id=$2 AND site_id=$3 AND status='authorized' LIMIT 1",[user.id,id,SITE_ID]);
 if(!found.rows.length)return {statusCode:409,error:"A verified Wix site connection is required."};
 let outcome;
 try{
  const authToken=await token(decrypt(found.rows[0].encrypted_instance,config.key),config);
  outcome=await auditReadOnly(authToken);
 }catch{return {statusCode:502,error:"Wix did not confirm the authorized read-only session. Reconnect before retrying."};}
 return db.transaction(async client=>{
  const lock=await client.query("SELECT * FROM ai4u_private.router_guided_missions WHERE user_id=$1 AND id=$2 FOR UPDATE",[user.id,id]);
  if(!lock.rows.length)return {statusCode:404,error:"Guided mission not found."};
  const latest=lock.rows[0];
  if(latest.last_request_id===requestId)return {statusCode:200,replayed:true,inspection:latest.setup_context?.wix_inspection||null};
  if(latest.revision!==body.revision||latest.step_index!==3)
   return {statusCode:409,error:"Mission changed in another session. Resume before saving inspection."};
  const context={...latest.setup_context,wix_inspection:outcome};
  await client.query("UPDATE ai4u_private.router_guided_missions SET setup_context=$3::jsonb,revision=revision+1,last_request_id=$4,updated_at=now() WHERE id=$1 AND user_id=$2",[id,user.id,JSON.stringify(context),requestId]);
  await client.query("UPDATE ai4u_private.router_wix_connections SET summary=$3::jsonb WHERE user_id=$1 AND guided_mission_id=$2",[user.id,id,JSON.stringify(outcome)]);
  await client.query("INSERT INTO ai4u_private.router_guided_events(user_id,guided_mission_id,request_id,event_type,details) VALUES($1,$2,$3,'wix_readonly_inventory_recorded',$4::jsonb)",[user.id,id,requestId,JSON.stringify(outcome)]);
  return {statusCode:200,inspection:outcome};
 });
}
async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 const config=settings();
 try{
  if(req.query?.wix_callback==="1")return callback(req,res,config);
  if(req.method!=="GET"&&req.method!=="POST")return send(res,405,{error:"Method not allowed"});
  const user=await requireUser(req);
  if(req.method==="GET"){
   const id=String(req.query?.mission_id||"");
   if(!UUID.test(id))return send(res,400,{error:"Valid mission ID required."});
   const state=await connectionStatus(user,id,config);
   return send(res,state.statusCode,state);
  }
  const body=await readJson(req);
  const id=String(body.mission_id||"");
  if(!UUID.test(id))return send(res,400,{error:"Valid mission ID required."});
  if(body.action==="begin"){
   if(body.explicit_consent!==true)return send(res,400,{error:"Explicit permission to open Wix installation and review requested scopes is required."});
   const result=await begin(user,id,config);
   return send(res,result.statusCode,result);
  }
  if(body.action==="inspect"){
   const result=await inspect(user,body,config);
   return send(res,result.statusCode,result);
  }
  return send(res,400,{error:"Unknown Wix connection action."});
 }catch(error){
  const status=Number(error.status)||500;
  if(status>=500)console.error("Wix authorization gate failed",{code:error.code||"UNKNOWN"});
  return send(res,status>=500?503:status,{error:status>=500?"Wix connection could not be verified. Nothing was changed on your Wix site.":error.message});
 }
}
module.exports=handler;
module.exports._test={settings,sha,encrypt,decrypt,verifySignedInstance,auditReadOnly,connectionStatus};
