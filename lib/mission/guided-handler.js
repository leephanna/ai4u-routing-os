"use strict";
const db=require("../billing/db");
const {requireUser}=require("../billing/auth");
const {send,readJson}=require("../billing/http");
const {compareStorefront}=require("./storefront-comparison");
const {assess:assessCommerce}=require("./commerce-readiness");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STOREFRONT=/\b(wreath|online store|storefront|ecommerce|e-commerce|handmade.*shop|sell.*products|checkout)\b/i;
const REGIONS=["US","CA","UK","EU","other","not_sure"];
const SHIPPING=["ship","pickup","both","not_sure"];
const BUDGETS=["under_50","50_to_150","over_150","not_sure"];
function publicRecord(row){
 return {id:row.id,plan_id:row.plan_id,status:row.status,step_index:row.step_index,
  revision:row.revision,requirements:row.requirements,route_choice:row.route_choice||{},setup_context:row.setup_context||{},updated_at:row.updated_at};
}
function cleanChoice(value,allowed){return typeof value==="string"&&allowed.includes(value)?value:null;}
function validateRequirements(input){
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const region=cleanChoice(input.region,REGIONS);
 const shipping=cleanChoice(input.shipping,SHIPPING);
 const budget=cleanChoice(input.budget,BUDGETS);
 if(!region||!shipping||!budget)return null;
 // These are user-reported inputs, not measured or independently verified facts.
 return {region,shipping,budget,verification:"user_confirmed",source:"user_submission"};
}
function validateSiteInventory(body){
 if(!body||typeof body!=="object"||Array.isArray(body))return {error:"Invalid site inventory."};
 if(!["existing","new","not_sure"].includes(body.site_status))return {error:"Select whether you have an existing Wix site."};
 let siteName=typeof body.site_name==="string"?body.site_name.trim():"";
 if(siteName.length>160)return {error:"Site name must be under 160 characters."};
 let siteUrl=typeof body.site_url==="string"?body.site_url.trim():"";
 if(siteUrl.length>500)return {error:"Site address is too long."};
 if(siteUrl){
  try{
   const u=new URL(siteUrl);
   if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.port||!u.hostname.includes("."))
    return {error:"Use a public HTTPS site address without passwords, query parameters or fragments."};
   siteUrl=u.href;
  }catch{return {error:"Enter a valid HTTPS website address or leave it blank."};}
 }
 if(body.site_status!=="existing"&&(siteName||siteUrl))return {error:"Only enter an existing site name or address when Existing Site is selected."};
 return {value:{site_status:body.site_status,site_name:siteName||null,site_url:siteUrl||null,
  verification:"user_reported_unverified",site_connection:"not_connected",checkout_verified:false,created_site:false}};
}
const GET_SQL="SELECT g.* FROM ai4u_private.router_guided_missions g WHERE g.id=$1 AND g.user_id=$2 LIMIT 1";
async function lookup(id,userId,client=db){
 const result=await client.query(GET_SQL,[id,userId]);
 return result.rows[0]||null;
}
module.exports=async function(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET"&&req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 try{
  const user=await requireUser(req);
  if(req.method==="GET"){
   const id=String(req.query?.id||"");
   if(id&&!UUID.test(id))return send(res,400,{error:"Invalid guided mission ID."});
   const rows=await db.query(id?GET_SQL:
    "SELECT * FROM ai4u_private.router_guided_missions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1",
    id?[id,user.id]:[user.id]);
   const record=rows.rows.length?publicRecord(rows.rows[0]):null;
   return send(res,200,{mission:record,comparison:record&&record.step_index>=1?compareStorefront(record.requirements):null,
    commerce_readiness:record&&record.step_index===3?await assessCommerce(rows.rows[0],(sql,args)=>db.query(sql,args)):null});
  }
  const body=await readJson(req);
  const action=String(body.action||"");
  if(action==="start"){
   const planId=String(body.plan_id||"");
   if(!UUID.test(planId))return send(res,400,{error:"A saved plan is required before guided execution."});
   const saved=await db.query("SELECT id,original_goal,chosen_prompt FROM ai4u_private.router_mission_plans WHERE id=$1 AND user_id=$2 LIMIT 1",[planId,user.id]);
   if(!saved.rows.length)return send(res,404,{error:"Saved plan not found for this account."});
   const plan=saved.rows[0];
   if(!STOREFRONT.test(plan.original_goal)&&!STOREFRONT.test(plan.chosen_prompt))
     return send(res,422,{error:"The first guided pilot supports storefront goals only. Your saved plan remains unchanged."});
   const result=await db.query(
    "INSERT INTO ai4u_private.router_guided_missions(user_id,plan_id) VALUES($1,$2) ON CONFLICT (user_id,plan_id) DO UPDATE SET updated_at=ai4u_private.router_guided_missions.updated_at RETURNING *",
    [user.id,planId]);
   return send(res,200,{mission:publicRecord(result.rows[0]),next_action:"Confirm your essential storefront requirements."});
  }
  if(action!=="confirm_requirements"&&action!=="choose_route"&&action!=="confirm_site_inventory"&&action!=="record_commerce_review")return send(res,400,{error:"Unknown guided mission action."});
  const id=String(body.mission_id||""),requestId=String(body.request_id||"");
  if(!UUID.test(id)||!UUID.test(requestId))return send(res,400,{error:"Valid mission and request identifiers are required."});
  if(!Number.isSafeInteger(body.revision)||body.revision<0)return send(res,400,{error:"Invalid mission revision."});
  let requirements=null;
  if(action==="confirm_requirements"){
   requirements=validateRequirements(body.requirements);
   if(!requirements)return send(res,400,{error:"Choose a selling region, fulfillment approach and budget. Select Not sure wherever needed."});
  }else if(action==="choose_route"){
   if(!["wix","shopify","square"].includes(body.platform))return send(res,400,{error:"Select a comparison option shown on this screen."});
   if(body.acknowledge_review!==true)return send(res,400,{error:"Confirm that plan pricing and shipping must be checked with the provider before any purchase."});
  }else if(action==="record_commerce_review"){
   if(body.acknowledge_scope!==true)return send(res,400,{error:"Acknowledge that this homepage evidence does not verify ecommerce before recording the review."});
  }else{
   const parsed=validateSiteInventory(body);
   if(parsed.error)return send(res,400,{error:parsed.error});
   requirements=parsed.value;
  }
  // Concurrent requests are serialized by row lock. Reusing the same request ID cannot repeat the event.
  const outcome=await db.transaction(async client=>{
   const locked=await client.query("SELECT * FROM ai4u_private.router_guided_missions WHERE id=$1 AND user_id=$2 FOR UPDATE",[id,user.id]);
   if(!locked.rows.length)return {http:404,error:"Guided mission not found for this account."};
   const row=locked.rows[0];
   if(row.last_request_id===requestId)return {http:200,mission:publicRecord(row),replayed:true};
   if(action==="record_commerce_review"){
    if(row.step_index!==3||row.status!=="awaiting_site_review")
     return {http:409,error:"Commerce review is not available at this step. Resume first."};
    if(row.revision!==body.revision)
     return {http:409,error:"The saved mission changed. Resume before recording this review."};
    const assessment=await assessCommerce(row,(sql,args)=>client.query(sql,args));
    if(assessment.homepage.status!=="five_checks_passed"||!assessment.homepage.sample_sha256)
     return {http:422,error:"An owner-scoped, verified five-check homepage receipt and matching HTML sample are required."};
    const review={
     proof_mission_id:assessment.homepage.mission_id,
     sample_sha256:assessment.homepage.sample_sha256,
     reviewed_at:new Date().toISOString(),
     result:"homepage_verified_commerce_not_verified",
     verification:"homepage_evidence_plus_scope_acknowledgement",
     next_action:"read_only_wix_commerce_inspection",
     authorization:"no_wix_access_or_mutation_granted"
    };
    const context={...(row.setup_context||{}),commerce_review:review};
    const updated=await client.query(
     "UPDATE ai4u_private.router_guided_missions SET setup_context=$3::jsonb,revision=revision+1,last_request_id=$4,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *",
     [id,user.id,JSON.stringify(context),requestId]);
    await client.query(
     "INSERT INTO ai4u_private.router_guided_events(user_id,guided_mission_id,request_id,event_type,details) VALUES($1,$2,$3,'commerce_readiness_review_recorded',$4::jsonb)",
     [user.id,id,requestId,JSON.stringify(review)]);
    return {http:200,mission:publicRecord(updated.rows[0]),replayed:false};
   }
   if(action==="confirm_site_inventory"){
    if(row.step_index!==2||row.status!=="awaiting_setup")
     return {http:409,error:"Site discovery is not the active step. Resume your mission."};
    if(row.revision!==body.revision)
     return {http:409,error:"This mission changed in another session. Resume before saving."};
    if(row.route_choice?.platform!=="wix")
     return {http:422,error:"This discovery checkpoint currently supports Wix only. Your previous route remains saved."};
    const context=requirements;
    const updated=await client.query(
     "UPDATE ai4u_private.router_guided_missions SET setup_context=$3::jsonb,step_index=3,status='awaiting_site_review',revision=revision+1,last_request_id=$4,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *",
     [id,user.id,JSON.stringify(context),requestId]);
    await client.query(
     "INSERT INTO ai4u_private.router_guided_events(user_id,guided_mission_id,request_id,event_type,details) VALUES($1,$2,$3,'wix_site_inventory_user_reported',$4::jsonb)",
     [user.id,id,requestId,JSON.stringify({site_status:context.site_status,site_name:context.site_name,site_url:context.site_url,
       verification:"user_reported_unverified",site_connection:"not_connected"})]);
    return {http:200,mission:publicRecord(updated.rows[0]),replayed:false};
   }
   if(action==="choose_route"){
    if(row.step_index!==1||row.status!=="awaiting_route_review")
     return {http:409,error:"Route review is not the active step. Resume the mission."};
    if(row.revision!==body.revision)
     return {http:409,error:"The mission changed in another session. Resume before saving."};
    const comparison=compareStorefront(row.requirements);
    if(comparison.mode!=="source_snapshot")
     return {http:422,error:"This source snapshot only supports a preliminary US comparison. Local pricing must be verified before proceeding."};
    const option=comparison.options.find(x=>x.id===body.platform);
    if(!option)return {http:400,error:"Selected route is not in the verified comparison."};
    const route={platform:option.id,platform_name:option.name,source_reviewed_at:comparison.reviewed_at,
     sources:option.sources,verification:"user_selected_unverified",
     acknowledgement:"Provider pricing, shipping and checkout are unverified; no purchase authorized."};
    const updated=await client.query(
     "UPDATE ai4u_private.router_guided_missions SET route_choice=$3::jsonb,step_index=2,status='awaiting_setup',revision=revision+1,last_request_id=$4,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *",
     [id,user.id,JSON.stringify(route),requestId]);
    await client.query(
     "INSERT INTO ai4u_private.router_guided_events(user_id,guided_mission_id,request_id,event_type,details) VALUES($1,$2,$3,'route_user_selected',$4::jsonb)",
     [user.id,id,requestId,JSON.stringify({platform:option.id,source_reviewed_at:comparison.reviewed_at,
       sources:option.sources,verification:"user_selected_unverified"})]);
    return {http:200,mission:publicRecord(updated.rows[0]),replayed:false};
   }
   if(row.step_index!==0||row.status!=="awaiting_user")
     return {http:409,error:"This step has already been confirmed. Resume to see the current step."};
   if(row.revision!==body.revision)
     return {http:409,error:"This mission changed in another session. Resume it before submitting again."};
   const updated=await client.query(
    "UPDATE ai4u_private.router_guided_missions SET requirements=$3::jsonb,step_index=1,status='awaiting_route_review',revision=revision+1,last_request_id=$4,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING *",
    [id,user.id,JSON.stringify(requirements),requestId]);
   await client.query(
    "INSERT INTO ai4u_private.router_guided_events(user_id,guided_mission_id,request_id,event_type,details) VALUES($1,$2,$3,'requirements_user_confirmed',$4::jsonb)",
    [user.id,id,requestId,JSON.stringify({step:0,verification:"user_confirmed",region:requirements.region,shipping:requirements.shipping,budget:requirements.budget})]);
   return {http:200,mission:publicRecord(updated.rows[0]),replayed:false};
  });
  if(outcome.error)return send(res,outcome.http,{error:outcome.error});
  return send(res,200,{mission:outcome.mission,replayed:outcome.replayed,
   next_action:action==="record_commerce_review"?"Commerce evidence review saved. Next: authorized read-only Wix capabilities inspection; no changes or charges have occurred.":action==="confirm_site_inventory"?"Site inventory saved. Next: verify access to the selected site or plan a new one with explicit authorization.":action==="choose_route"?"Route saved. Next: identify existing Wix assets before creating anything.":"Review the dated storefront comparison and choose a route."});
 }catch(error){
  const status=Number(error.status)||500;
  if(status>=500)console.error("Guided mission request failed",{code:error.code||"UNKNOWN"});
  return send(res,status>=500?503:status,{error:status>=500?"The guided mission could not be verified in account storage. Your previous saved plan is unchanged.":error.message});
 }
};
