(function(global){
"use strict";
const $=id=>document.getElementById(id);
let current=null,busy=false,latestComparison=null;
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
function show(record,comparison=null){
 latestComparison=comparison;
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
 show(response.mission,response.comparison);
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
  show(result.mission,result.comparison);
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
  show(checked.mission,checked.comparison);
 }catch(error){failed(error);}
 finally{busy=false;if(current?.step_index===0)$("guided-confirm").disabled=false;}
}
global.AI4UGuided={startLatest,resume,confirmStep,chooseRoute,confirmSiteInventory};
})(window);
