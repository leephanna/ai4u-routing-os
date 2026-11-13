(function(global){
"use strict";
const $=id=>document.getElementById(id);
let plan=null,selected="recommended",busy=false;
function status(message,error){const el=$("intent-status");if(!el)return;el.textContent=message;el.style.color=error?"#ffb4b4":"var(--white2)";}
function clear(node){node.replaceChildren();}
async function token(){
 const billing=global.AI4UBilling;
 if(billing&&typeof billing.getFreshAccessToken==="function")return await billing.getFreshAccessToken()||"";
 return "";
}
async function api(method,payload){
 const auth=await token();
 if(!auth)throw Error("Sign in under Settings, then return here to optimize and save your mission.");
 const response=await fetch("/api/mission/site-audit?intent=1",{method,cache:"no-store",headers:{"Content-Type":"application/json","Authorization":"Bearer "+auth},body:JSON.stringify(payload)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||"Mission plan request failed.");
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
 if(plan.status==="needs_clarification"){status("Select a clearer goal above, then choose Improve My Goal before saving.",true);return;}
 busy=true;$("intent-save").disabled=true;
 try{
  const result=await api("POST",{action:"save",goal:plan.original_goal,option:selected});
  const saved=result.saved;
  $("intent-saved").hidden=false;
  $("intent-saved").textContent="✓ Saved to your account · "+(saved.chosen_option==="original"?"Original wording":saved.chosen_option)+" · "+saved.id;
  status("✓ Mission plan recorded in Supabase-backed storage. If this goal includes a homepage check, enter its public URL below to run the existing scoped test.");
  if(result.plan.category==="website_readiness"){
    const matched=saved.original_goal.match(/https:\/\/[^\s<>\"']+/i);
    if(matched){try{const u=new URL(matched[0].replace(/[.,;!?]+$/,""));if(u.pathname==="/"&&!u.search)$("mission-url").value=u.origin+"/";}catch(_){}}
  }
 }catch(e){status("Save NOT confirmed: "+e.message,true);}
 finally{busy=false;$("intent-save").disabled=false;}
}
async function resume(){
 if(busy)return;busy=true;$("intent-resume").disabled=true;
 try{
  const auth=await token();if(!auth)throw Error("Sign in under Settings to restore your last plan.");
  const response=await fetch("/api/mission/site-audit?intent=1",{cache:"no-store",headers:{"Authorization":"Bearer "+auth}});
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(json.error||"Could not retrieve saved plan.");
  if(!json.saved){status("No saved plan on this account yet.");return;}
  $("intent-goal").value=json.saved.original_goal;
  render(json.saved.plan);
  selected=json.saved.chosen_option;
  for(const input of document.querySelectorAll("input[name=intent-choice]"))input.checked=input.value===selected;
  showChoice();$("intent-saved").hidden=false;
  $("intent-saved").textContent="✓ Restored saved decision · "+json.saved.id;
  status("Saved plan restored. You can change the wording or continue with the website check below.");
 }catch(e){status(e.message,true);}
 finally{busy=false;$("intent-resume").disabled=false;}
}
const goalEditor=$("intent-goal");
if(goalEditor)goalEditor.addEventListener("input",()=>{
 if(!plan)return;
 plan=null;
 $("intent-suggestions").hidden=true;
 $("intent-saved").hidden=true;
 status("Goal changed. Select Improve My Goal to review up-to-date choices before saving.");
});
global.AI4UIntent={preview,save,resume};
})(window);
