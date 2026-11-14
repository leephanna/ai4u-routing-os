(function(global){
"use strict";
const $=id=>document.getElementById(id);
let current=null,busy=false,latestComparison=null,latestCommerce=null;
// Public site reference obtained from an independent, read-only Wix account inspection.
// Not evidence of a live homepage or an authorization granted to Routing OS.
const KNOWN_PUBLIC_PREVIEWS={
 "Sparrow Wreath Preview":"https://headless-etnhqsdtksr-leehanna8-1409.wix-site-host.com/"
};
function message(value,error=false){
 const el=$("guided-message");if(!el)return;
 el.hidden=false;el.textContent=value;el.dataset.state=error?"error":"normal";
 el.setAttribute("role",error?"alert":"status");
}
async function token(){
 if(global.AI4UBilling?.getFreshAccessToken){const value=await global.AI4UBilling.getFreshAccessToken();if(value)return value;}
 if(global.AI4U_SB?.client?.auth?.getSession){
  const response=await global.AI4U_SB.client.auth.getSession();
  return response?.data?.session?.access_token||"";
 }
 return "";
}
async function request(method,body,url="/api/mission/site-audit?guided=1"){
 const auth=await token();
 if(!auth)throw Error("Sign in under Settings to save or resume guided work.");
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(url,{method,cache:"no-store",signal:controller.signal,
   headers:{"Authorization":"Bearer "+auth,"Content-Type":"application/json"},
   ...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"The guided mission could not be completed.");
  return data;
 }catch(error){
  if(controller.signal.aborted)throw Error("The request timed out. Resume this mission before trying again.");
  throw error;
 }finally{clearTimeout(timeout);}
}
function show(record,comparison=null,commerce=null){
 latestComparison=comparison;
 latestCommerce=commerce;
 current=record;
 const card=$("guided-panel");if(!card)return;
 card.hidden=false;
 $("guided-id").textContent=record.id;
 const active=record.step_index===0,comparing=record.step_index===1,selected=record.step_index===2,siteRecorded=record.step_index===3;
 $("guided-step-one").hidden=!active;
 $("guided-step-two").hidden=!comparing;
 $("guided-step-three").hidden=!selected;
 $("guided-step-four").hidden=!siteRecorded;
 $("guided-progress").textContent=active?"Step 1 of 3 — Confirm store requirements":comparing?"Step 1 confirmed · Step 2 — Compare platforms":selected?"Step 2 confirmed · Step 3 — Identify an existing Wix site":"Step 3 confirmed · Step 4 awaiting site verification";
 if(comparing)renderComparison(comparison);
 if(selected){
  const panel=$("guided-step-three");
  const fields=$("guided-existing-fields");
  for(const input of document.querySelectorAll('input[name="guided-site-status"]'))input.checked=false;
  fields.hidden=true;
  $("guided-site-name").value="";
  $("guided-site-url").value="";
  $("guided-save-site").disabled=record.route_choice?.platform!=="wix";
  if(record.route_choice?.platform!=="wix")message("This first site inventory checkpoint supports Wix only. Your saved choice remains unchanged.",true);
 }
 if(siteRecorded){
  const context=record.setup_context||{};
  const type=context.site_status==="existing"?"Existing Wix site":context.site_status==="new"?"No existing site reported":"Site status unknown";
  $("guided-site-review").textContent=type+(context.site_name?" · "+context.site_name:"")+(context.site_url?" · "+context.site_url:"")+". User-reported only; ownership and function are not verified.";
  const known=context.site_name&&KNOWN_PUBLIC_PREVIEWS[context.site_name]||"";
  const suggested=context.site_url||known;
  $("guided-public-url").value=suggested;
  $("guided-public-audit").disabled=context.site_status!=="existing";
  $("guided-site-audit-source").textContent=context.site_status!=="existing"
   ?"No existing site was reported. Do not create a new site until the route is reviewed."
   :known&&!context.site_url
   ?"Suggested public URL from a separate Wix account inspection; confirm it is the right site. Public availability has NOT been verified."
   :"Verify this is the correct public root homepage URL before testing. Routing OS is not connected to Wix administration.";
  renderCommerceReview(record,commerce);

 }
 if(selected)$("guided-selected-route").textContent="Selected: "+(record.route_choice?.platform_name||record.route_choice?.platform||"saved platform")+". Pricing and checkout have not been independently verified.";
 if(active){
  const values=record.requirements||{};
  for(const field of ["region","shipping","budget"]){
   const node=$("guided-"+field);if(node)node.value=values[field]||"";
  }
  $("guided-confirm").disabled=false;
  message("Select the three essentials. Choosing Not sure is valid; AI4U will record what is unknown.");
 }else{
  if(!selected||record.route_choice?.platform==="wix")message(siteRecorded?"✓ Existing-site discovery saved. Verification of access and storefront setup is next.":selected?"✓ Your route choice is saved. Confirm whether a Wix site already exists.":"✓ Requirements saved as user-confirmed inputs to your account. Review the comparison before choosing.");
 }
}
async function refreshWixStatus(record){
 const status=$("guided-wix-connection-status"),connect=$("guided-wix-connect-controls");
 const inspect=$("guided-wix-audit-controls"),results=$("guided-wix-inventory-result");
 if(!status||!connect||!inspect||!results)return;
 connect.hidden=true;inspect.hidden=true;
 if(!record?.setup_context?.commerce_review){
  status.textContent="First save the evidence-backed Commerce Readiness review above; no Wix access is requested yet.";
  results.textContent="";return;
 }
 const stored=record.setup_context?.wix_inspection;
 results.textContent=stored
  ?"Last read-only inspection: "+stored.inspected_at+
   ". Installed-app inventory: "+stored.installed_apps?.status+
   (Number.isInteger(stored.installed_apps?.count)?" ("+stored.installed_apps.count+" entries)":"")+
   ". Product catalog: "+stored.catalog?.status+
   ". Checkout, payments and shipping remain unverified.":"No Routing OS Wix inventory has run yet.";
 try{
  const response=await request("GET",null,"/api/mission/site-audit?wix_audit=1&mission_id="+encodeURIComponent(record.id));
  if(current?.id!==record.id)return;
  if(response.configuration!=="ready"){
   status.textContent="Not configured — the dedicated Wix developer app, app permissions and server-only encryption secret are still required. The existing site and mission are safe.";
  }else if(response.connection?.status==="authorized"){
   status.textContent="Wix app installation verified for this site. A limited, read-only inventory is available. No storefront readiness has been claimed.";
   inspect.hidden=false;
  }else{
   status.textContent="Connection available, but this site has not authorized the dedicated Wix inspection app.";
   connect.hidden=false;
  }
 }catch(error){
  status.textContent="Unable to check the Wix connection state: "+(error.message||"unavailable")+
   ". Your saved Commerce Readiness review is unchanged.";
 }
}
async function beginWixConnection(){
 if(busy||!current?.setup_context?.commerce_review)return;
 if(!$("guided-wix-connect-consent").checked){
  message("Review and acknowledge Wix app installation before opening authorization.",true);return;
 }
 busy=true;$("guided-wix-connect-button").disabled=true;
 try{
  const result=await request("POST",{action:"begin",mission_id:current.id,explicit_consent:true},
   "/api/mission/site-audit?wix_audit=1");
  const url=new URL(result.install_url);
  if(url.origin!=="https://www.wix.com"||url.pathname!=="/app-installer")
   throw Error("Wix authorization returned an unexpected destination.");
  global.location.assign(url.href);
 }catch(error){message(error.message||"The Wix authorization could not be initiated.",true);}
 finally{busy=false;$("guided-wix-connect-button").disabled=false;}
}
async function runWixInventory(){
 if(busy||!current?.setup_context?.commerce_review)return;
 if(!$("guided-wix-audit-consent").checked){
  message("Confirm the limited read-only Wix audit scope first.",true);return;
 }
 const id=global.crypto?.randomUUID?.();
 if(!id){message("Could not create a safe request identifier.",true);return;}
 busy=true;$("guided-wix-audit-button").disabled=true;
 try{
  message("Reading only installed app inventory and product catalog metadata...");
  const result=await request("POST",{action:"inspect",mission_id:current.id,
   revision:current.revision,request_id:id,confirm_readonly:true},"/api/mission/site-audit?wix_audit=1");
  if(!result.inspection)throw Error("No Wix inspection evidence was returned.");
  const updated=await verifiedReadback(current.id);
  if(updated.setup_context?.wix_inspection?.inspected_at!==result.inspection.inspected_at)
   throw Error("The read-only Wix inspection could not be verified in saved account storage.");
  message("✓ Limited Wix inventory saved. Payment, checkout, shipping and pickup still require independent checks.");
 }catch(error){message(error.message||"Wix read-only inspection failed.",true);}
 finally{busy=false;$("guided-wix-audit-button").disabled=false;}
}
function renderCommerceReview(record,assessment){
 const summary=$("guided-commerce-summary");
 if(!summary)return;
 const items=$("guided-commerce-findings"),controls=$("guided-commerce-record-controls");
 const saved=$("guided-commerce-saved"),provenance=$("guided-commerce-provenance");
 items.replaceChildren();controls.hidden=true;saved.hidden=true;
 const review=record.setup_context?.commerce_review;
 const homepageVerified=assessment?.homepage?.status==="five_checks_passed"&&!!assessment?.homepage?.sample_sha256;
 const auditButton=$("guided-public-audit"),heading=$("guided-step4-heading");
 if(auditButton)auditButton.hidden=!!homepageVerified;
 if(heading)heading.textContent=homepageVerified
  ?review?"✓ Commerce evidence review saved · Next: authorize read-only Wix inspection"
   :"DO THIS NEXT · Save your evidence-backed Commerce Readiness Review"
  :"DO THIS NEXT · Check the existing site's public homepage";
 if(homepageVerified&&$("guided-site-audit-source"))
  $("guided-site-audit-source").textContent="Public HTTPS/HTML checks are already verified in your account. No need to rerun this homepage test.";
 if(review){
  saved.hidden=false;
  saved.textContent="✓ Scoped commerce review saved to your account. Proof mission: "+review.proof_mission_id+". Checkout remains unverified.";
 }
 void refreshWixStatus(record);
 if(!assessment){
  summary.textContent="No commerce assessment was returned. Resume this guided mission to check stored homepage evidence.";
  provenance.textContent="No Wix account is connected inside Routing OS.";
  return;
 }
 const homepage=assessment.homepage||{};
 summary.textContent=homepage.status==="five_checks_passed"
  ?"Verified public homepage: five network/HTML checks passed. Commerce functionality remains unverified."
  :"No completed, matching five-check homepage proof was found for this signed-in account and selected Wix site.";
 const facts=[
  ["Public HTTPS homepage",homepage.status==="five_checks_passed"?"5/5 scoped checks passed":"Not linked / needs review"],
  ["HTML preview",homepage.html_observations?.preview_notice?"Explicitly marked as a preview":"Not independently established"],
  ["Product showcase",homepage.html_observations?.showcase_cards?"Example product cards in sampled HTML":"Not established"],
  ["Search indexing",homepage.html_observations?.noindex?"Noindex in sampled HTML":"Not verified"],
  ["Wix Stores","Not listed in previous separate Wix app inventory; installation status not independently confirmed inside Routing OS"],
  ["Live catalog, payments, checkout, shipping, pickup","Not verified"]
 ];
 for(const [label,value] of facts){
  const paragraph=document.createElement("p");
  paragraph.textContent=label+": "+value;items.appendChild(paragraph);
 }
 provenance.textContent="Evidence: "+(homepage.mission_id||"no matching completed mission")
  +(homepage.checked_at?" · Checked "+homepage.checked_at:"")
  +". Separate Wix inspection is not an active Routing OS Wix connection.";
 if(homepage.status==="five_checks_passed"&&homepage.sample_sha256&&!review){
  controls.hidden=false;$("guided-commerce-ack").checked=false;
  $("guided-commerce-save").disabled=false;
 }
}
async function recordCommerceReview(){
 if(busy||!current||current.step_index!==3)return;
 if(!$("guided-commerce-ack")?.checked){message("Confirm the limited verification scope before saving the commerce review.",true);return;}
 const id=global.crypto?.randomUUID?.();
 if(!id){message("Unable to generate a safe request identifier. Update your browser.",true);return;}
 busy=true;$("guided-commerce-save").disabled=true;
 try{
  message("Recording the scoped commerce evidence in your saved mission...");
  const result=await request("POST",{action:"record_commerce_review",mission_id:current.id,
   revision:current.revision,request_id:id,acknowledge_scope:true});
  if(!result.mission?.setup_context?.commerce_review)throw Error("The server did not confirm the commerce review.");
  const verified=await verifiedReadback(current.id);
  if(verified.step_index!==3||verified.setup_context?.commerce_review?.proof_mission_id!==result.mission.setup_context.commerce_review.proof_mission_id)
   throw Error("The review could not be independently read back. Resume before trying again.");
 }catch(error){failed(error);}
 finally{busy=false;if(current?.step_index===3&&!current.setup_context?.commerce_review)$("guided-commerce-save").disabled=false;}
}
function renderComparison(comparison){
 const container=$("guided-route-options"),reasons=$("guided-reasons");
 container.replaceChildren();reasons.replaceChildren();
 if(!comparison||comparison.mode!=="source_snapshot"){
  message("A US price comparison is not available for these requirements. Current local pricing must be verified.",true);
  $("guided-choose-route").disabled=true;return;
 }
 $("guided-choose-route").disabled=false;
 $("guided-review-ack").checked=false;
 $("guided-comparison-date").textContent="Sources reviewed "+comparison.reviewed_at+" · pricing and availability may change; check links before paying.";
 for(const line of comparison.reasons||[]){
  const paragraph=document.createElement("p");paragraph.textContent=line;reasons.appendChild(paragraph);
 }
 for(const option of comparison.options){
  const label=document.createElement("label");label.className="guided-option";
  const input=document.createElement("input");input.type="radio";input.name="guided-platform";input.value=option.id;input.checked=option.id===comparison.recommendation;
  const title=document.createElement("strong");title.textContent=option.name+(input.checked?" — Suggested":"");
  label.appendChild(input);label.appendChild(title);
  for(const line of [option.cost,option.strength,option.caution,option.fit]){
   const small=document.createElement("span");small.textContent=line;label.appendChild(small);
  }
  for(const uri of option.sources){
   const a=document.createElement("a");a.href=uri;a.target="_blank";a.rel="noopener noreferrer";a.textContent=new URL(uri).hostname+" source";label.appendChild(a);
  }
  container.appendChild(label);
 }
}
async function verifiedReadback(id){
 const response=await request("GET",null,"/api/mission/site-audit?guided=1&id="+encodeURIComponent(id));
 if(response.mission?.id!==id)throw Error("The server could not retrieve this mission. Resume before trying again.");
 show(response.mission,response.comparison,response.commerce_readiness);
 return response.mission;
}
async function chooseRoute(){
 if(busy||!current||current.step_index!==1)return;
 const selected=document.querySelector('input[name="guided-platform"]:checked');
 if(!selected){message("Select a platform option first.",true);return;}
 if(!$("guided-review-ack").checked){message("Please acknowledge that current fees, checkout and shipping need verification.",true);return;}
 const requestId=global.crypto?.randomUUID?.();
 if(!requestId){message("Unable to create a safe request ID. Refresh your browser.",true);return;}
 busy=true;$("guided-choose-route").disabled=true;
 try{
  message("Saving your route choice to the account ledger...");
  const result=await request("POST",{action:"choose_route",mission_id:current.id,request_id:requestId,revision:current.revision,
   platform:selected.value,acknowledge_review:true});
  if(!result.mission)throw Error("The route was not confirmed by the server.");
  const checked=await verifiedReadback(current.id);
  if(checked.step_index!==2||checked.route_choice?.platform!==selected.value)
   throw Error("The saved route could not be verified. Resume instead of resubmitting.");
 }catch(error){failed(error);}
 finally{busy=false;if(current?.step_index===1)$("guided-choose-route").disabled=false;}
}
function updateExistingFields(){
 const selected=document.querySelector('input[name="guided-site-status"]:checked');
 $("guided-existing-fields").hidden=selected?.value!=="existing";
 if(selected?.value!=="existing"){$("guided-site-name").value="";$("guided-site-url").value="";}
}
async function confirmSiteInventory(){
 if(busy||!current||current.step_index!==2)return;
 const selected=document.querySelector('input[name="guided-site-status"]:checked');
 if(!selected){message("Choose Existing, New, or Not sure before continuing.",true);return;}
 const requestId=global.crypto?.randomUUID?.();
 if(!requestId){message("Cannot create a safe request identifier. Update your browser.",true);return;}
 const details={action:"confirm_site_inventory",mission_id:current.id,revision:current.revision,request_id:requestId,
  site_status:selected.value,site_name:selected.value==="existing"?$("guided-site-name").value.trim():"",
  site_url:selected.value==="existing"?$("guided-site-url").value.trim():""};
 busy=true;$("guided-save-site").disabled=true;
 try{
  message("Saving your existing-site answer...");
  const saved=await request("POST",details);
  if(!saved.mission)throw Error("The server did not confirm site inventory.");
  const checked=await verifiedReadback(current.id);
  if(checked.step_index!==3||checked.setup_context?.site_status!==selected.value)
   throw Error("The site discovery was not confirmed by readback. Resume before retrying.");
 }catch(error){failed(error);}
 finally{busy=false;if(current?.step_index===2)$("guided-save-site").disabled=false;}
}
const siteStatusControls=document.querySelectorAll('input[name="guided-site-status"]');
for(const input of siteStatusControls)input.addEventListener("change",updateExistingFields);
async function preparePublicAudit(){
 if(busy||!current||current.step_index!==3)return;
 const context=current.setup_context||{};
 if(context.site_status!=="existing"){message("No existing Wix site is selected for this mission.",true);return;}
 const raw=$("guided-public-url").value.trim();
 let url;
 try{
  url=new URL(raw);
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.port||url.pathname!=="/"||!url.hostname.includes("."))
   throw Error("The public audit only accepts an HTTPS root homepage URL (/) without credentials, paths, query parameters or custom ports.");
 }catch(error){message(error.message||"Enter a public HTTPS root homepage URL.",true);return;}
 const target=$("mission-url");
 if(!target||!global.AI4UMission||typeof global.AI4UMission.start!=="function"){
  message("Website Launch Readiness is unavailable. Your site selection is still saved.",true);return;
 }
 target.value=url.href;
 message("URL transferred. Starting the existing read-only homepage checks; review results in Website Launch Readiness below.");
 target.scrollIntoView({behavior:"smooth",block:"center"});
 await global.AI4UMission.start();
 // A public HTTPS audit is separate from the guided account/site identity and
 // must never advance Step 4 or imply Wix commerce readiness.
}
function failed(error){message(error.message||"Action not confirmed.",true);}
async function startLatest(){
 if(busy)return;busy=true;
 try{
  message("Finding your saved goal and preparing one next action...");
  const result=await request("GET",null,"/api/mission/site-audit?intent=1");
  if(!result.saved?.id)throw Error("No saved plan found. Return to Mission Runner, improve and save your goal first.");
  const started=await request("POST",{action:"start",plan_id:result.saved.id});
  if(!started.mission)throw Error("Guided mission creation was not verified.");
  global.showPanel?.("mission");
  await verifiedReadback(started.mission.id);
  $("guided-panel")?.scrollIntoView({behavior:"smooth",block:"start"});
 }catch(error){failed(error);}
 finally{busy=false;}
}
async function resume(){
 if(busy)return;busy=true;
 try{
  message("Restoring your last saved guided step...");
  const result=await request("GET",null);
  if(!result.mission)throw Error("No guided mission exists yet. Select Start Guided Mission first.");
  global.showPanel?.("mission");
  show(result.mission,result.comparison,result.commerce_readiness);
 }catch(error){failed(error);}
 finally{busy=false;}
}
async function confirmStep(){
 if(busy||!current||current.step_index!==0)return;
 const requirements={region:$("guided-region").value,shipping:$("guided-shipping").value,budget:$("guided-budget").value};
 if(Object.values(requirements).some(v=>!v)){message("Select all three choices. You may select Not sure.",true);return;}
 busy=true;$("guided-confirm").disabled=true;
 const requestId=global.crypto?.randomUUID?.();
 if(!requestId){message("Your browser cannot create a safe request identifier. Update your browser.",true);busy=false;$("guided-confirm").disabled=false;return;}
 try{
  message("Recording your confirmed choices...");
  const result=await request("POST",{action:"confirm_requirements",mission_id:current.id,revision:current.revision,request_id:requestId,requirements});
  if(!result.mission)throw Error("The server did not confirm your step.");
  const checked=await request("GET",null,"/api/mission/site-audit?guided=1&id="+encodeURIComponent(current.id));
  if(checked.mission?.id!==current.id||checked.mission.step_index!==1)
   throw Error("The update was not independently read back. Resume before trying again.");
  show(checked.mission,checked.comparison,checked.commerce_readiness);
 }catch(error){failed(error);}
 finally{busy=false;if(current?.step_index===0)$("guided-confirm").disabled=false;}
}
global.AI4UGuided={startLatest,resume,confirmStep,chooseRoute,confirmSiteInventory,preparePublicAudit,recordCommerceReview,beginWixConnection,runWixInventory};
})(window);
