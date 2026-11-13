(function(global){
"use strict";
const $=id=>document.getElementById(id);
let plan=null,selected="recommended",busy=false;
function status(message,error){const el=$("intent-status");if(!el)return;el.textContent=message;el.style.color=error?"#ffb4b4":"var(--white2)";}
function clear(node){node.replaceChildren();}
async function token(){
 const billing=global.AI4UBilling;
 if(billing&&typeof billing.getFreshAccessToken==="function"){
  const candidate=await billing.getFreshAccessToken();
  if(candidate)return candidate;
 }
 const sb=global.AI4U_SB;
 if(sb&&sb.client&&sb.client.auth&&typeof sb.client.auth.getSession==="function"){
  const response=await sb.client.auth.getSession();
  if(response.error)throw Error("Your sign-in session needs refreshing. Sign in under Settings, then retry.");
  return response.data?.session?.access_token||"";
 }
 return "";
}
function saveStatus(message,isError){
 const el=$("intent-save-status");
 if(el){
  el.textContent=message;
  el.hidden=false;
  el.dataset.state=isError?"error":"success";
  el.setAttribute("role",isError?"alert":"status");
  if(isError)el.scrollIntoView({block:"nearest",behavior:"smooth"});
 }
 status(message,isError);
}
async function boundedFetch(url,options,ms=20000){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),ms);
 try{return await fetch(url,{...options,signal:controller.signal});}
 catch(error){
  if(controller.signal.aborted){const e=new Error("The server did not respond within "+Math.ceil(ms/1000)+" seconds.");e.code="REQUEST_TIMEOUT";throw e;}
  throw error;
 }finally{clearTimeout(timeout);}
}
async function api(method,payload){
 const auth=await token();
 if(!auth)throw Error("Sign in under Settings, then return here to optimize and save your mission.");
 const response=await boundedFetch("/api/mission/site-audit?intent=1",{method,cache:"no-store",headers:{"Content-Type":"application/json","Authorization":"Bearer "+auth},body:JSON.stringify(payload)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok){const e=new Error(result.error||"Mission plan request failed.");e.status=response.status;e.code=result.code||"";throw e;}
 return result;
}
function text(parent,type,value,css){const el=document.createElement(type);el.textContent=value;if(css)el.className=css;parent.appendChild(el);return el;}
function optionRow(a){
 const label=document.createElement("label");label.className="intent-option";
 const input=document.createElement("input");input.type="radio";input.name="intent-choice";input.value=a.id;input.checked=selected===a.id;
 input.addEventListener("change",()=>{selected=a.id;showChoice();});
 label.appendChild(input);const wrap=document.createElement("span");
 text(wrap,"strong",a.label);text(wrap,"small",a.tradeoff||"");label.appendChild(wrap);
 return label;
}
function chosen(){
 return selected==="original"?plan.original_goal:plan.alternatives.find(a=>a.id===selected)?.prompt||plan.original_goal;
}
function showChoice(){
 if(!plan)return;
 $("intent-chosen").textContent=chosen();
 const save=$("intent-save");save.disabled=busy;
}
function render(value){
 plan=value;selected="recommended";
 const box=$("intent-suggestions"),options=$("intent-options"),clarify=$("intent-clarify");
 clear(options);clear(clarify);
 box.hidden=false;
 const steps=$("intent-steps");clear(steps);
 plan.steps.forEach(step=>{
  const item=document.createElement("li");
  text(item,"strong",step.title);
  text(item,"span",step.action+" Success: "+step.acceptance_criteria);
  steps.appendChild(item);
 });
 text(options,"p","Choose your preferred route. Nothing changes without your approval.","intent-help");
 plan.alternatives.forEach(a=>options.appendChild(optionRow(a)));
 options.appendChild(optionRow({id:"original",label:"Keep my wording",tradeoff:"Preserve exactly what I meant."}));
 if(plan.clarification){
  const heading=text(clarify,"p",plan.clarification.question,"intent-help");
  plan.clarification.options.forEach(value=>{
   const b=document.createElement("button");b.type="button";b.className="btn btn-ghost";b.textContent=value;
   b.addEventListener("click",()=>{$("intent-goal").value=value;status("Updated your draft. Select Improve My Goal to review again.");});
   clarify.appendChild(b);
  });
 }
 showChoice();
 status(plan.clarification?"Choose the wording closest to your intent, then improve the goal again.":"Review the options. Save your choice to your account.");
}
async function preview(){
 if(busy)return;
 const goal=$("intent-goal").value.trim();
 if(!goal){status("Enter a goal in your own words first.",true);return;}
 busy=true;$("intent-preview").disabled=true;
 try{
  const result=await api("POST",{action:"preview",goal});
  render(result.plan);
 }catch(e){status(e.message,true);}
 finally{busy=false;$("intent-preview").disabled=false;}
}
async function save(){
 if(busy||!plan)return;
 if(plan.status==="needs_clarification"){saveStatus("Please clarify your goal and select Improve My Goal again before saving.",true);return;}
 busy=true;$("intent-save").disabled=true;
 $("intent-save").textContent="Saving and verifying...";
 saveStatus("Saving your decision to your account, then checking that it can be retrieved...",false);
 try{
  const result=await api("POST",{action:"save",goal:plan.original_goal,option:selected});
  const saved=result.saved;
  if(!saved?.id)throw Error("The server did not return a saved plan identifier.");
  const auth=await token();
  if(!auth)throw Error("Your session expired during verification. Sign in and select Resume Saved Plan to check whether the save completed.");
  const response=await boundedFetch("/api/mission/site-audit?intent=1&id="+encodeURIComponent(saved.id),{
   cache:"no-store",headers:{"Authorization":"Bearer "+auth}
  });
  const checked=await response.json().catch(()=>({}));
  if(!response.ok||checked.saved?.id!==saved.id||checked.saved?.chosen_option!==selected||
     checked.saved?.original_goal!==plan.original_goal){
   throw Error("A save was requested, but a matching saved plan could not be read back. Select Resume Saved Plan to check before retrying.");
  }
  $("intent-saved").hidden=false;
  $("intent-saved").textContent="✓ Saved and independently read back from your account · "+(saved.chosen_option==="original"?"Original wording":saved.chosen_option)+" · "+saved.id;
  saveStatus("✓ SAVED AND VERIFIED — Your plan can be restored with Resume Saved Plan.",false);
  if(result.plan.category==="website_readiness"){
    const matched=saved.original_goal.match(/https:\/\/[^\s<>\"']+/i);
    if(matched){try{const u=new URL(matched[0].replace(/[.,;!?]+$/,""));if(u.pathname==="/"&&!u.search)$("mission-url").value=u.origin+"/";}catch(_){}}
  }
 }catch(e){
  // The server may have committed before a timeout disconnected the client.
  // Read once, without creating another write, before deciding whether it persisted.
  if(e.code==="REQUEST_TIMEOUT"){
   saveStatus("The save request timed out. Checking whether your plan was recorded...",false);
   try{
    const auth=await token();
    if(auth){
     const response=await boundedFetch("/api/mission/site-audit?intent=1",{cache:"no-store",headers:{"Authorization":"Bearer "+auth}},10000);
     const check=await response.json().catch(()=>({}));
     if(response.ok&&check.saved?.original_goal===plan.original_goal&&check.saved?.chosen_option===selected){
      $("intent-saved").hidden=false;
      $("intent-saved").textContent="✓ Verified saved plan · "+check.saved.id;
      saveStatus("✓ SAVED AND VERIFIED — The plan was found in your account after the delayed response.",false);
      return;
     }
    }
   }catch(_){}
   saveStatus("✕ NOT CONFIRMED — The server did not answer and no matching saved plan could be verified. Your goal remains here. Please use Resume Saved Plan before attempting Save again.",true);
  }else saveStatus("✕ NOT CONFIRMED — "+e.message+(e.status===401?" Sign in under Settings, then try again.":""),true);
 }finally{busy=false;$("intent-save").disabled=false;$("intent-save").textContent="Save This Plan to My Account";}
}
async function resume(){
 if(busy)return;busy=true;$("intent-resume").disabled=true;
 try{
  const auth=await token();if(!auth)throw Error("Sign in under Settings to restore your last plan.");
  const response=await boundedFetch("/api/mission/site-audit?intent=1",{cache:"no-store",headers:{"Authorization":"Bearer "+auth}});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(json.error||"Could not retrieve saved plan.");
  if(!json.saved){saveStatus("No saved plan found for the currently signed-in account. If your earlier save failed, review and save the goal again.",true);return;}
  $("intent-goal").value=json.saved.original_goal;
  render(json.saved.plan);
  selected=json.saved.chosen_option;
  for(const input of document.querySelectorAll("input[name=intent-choice]"))input.checked=input.value===selected;
  showChoice();$("intent-saved").hidden=false;
  $("intent-saved").textContent="✓ Restored saved decision · "+json.saved.id;
  saveStatus("✓ Saved plan successfully restored from your account.",false);
 }catch(e){saveStatus("Resume failed: "+e.message,true);}
 finally{busy=false;$("intent-resume").disabled=false;}
}
const goalEditor=$("intent-goal");
if(goalEditor)goalEditor.addEventListener("input",()=>{
 if(!plan)return;
 plan=null;
 $("intent-suggestions").hidden=true;
 $("intent-saved").hidden=true;
 $("intent-save-status").hidden=true;
 status("Goal changed. Select Improve My Goal to review up-to-date choices before saving.");
});
global.AI4UIntent={preview,save,resume};
})(window);
