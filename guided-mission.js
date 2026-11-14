(function(global){
"use strict";
const $=id=>document.getElementById(id);
let current=null,busy=false;
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
function show(record){
 current=record;
 const card=$("guided-panel");if(!card)return;
 card.hidden=false;
 $("guided-id").textContent=record.id;
 const active=record.step_index===0;
 $("guided-step-one").hidden=!active;
 $("guided-step-two").hidden=active;
 $("guided-progress").textContent=active?"Step 1 of 2 — Confirm store requirements":"Step 1 confirmed · Step 2 awaiting route comparison";
 if(active){
  const values=record.requirements||{};
  for(const field of ["region","shipping","budget"]){
   const node=$("guided-"+field);if(node)node.value=values[field]||"";
  }
  $("guided-confirm").disabled=false;
  message("Select the three essentials. Choosing Not sure is valid; AI4U will record what is unknown.");
 }else{
  message("✓ Requirements saved to your account as user-confirmed inputs. AI4U has not built or tested a store.");
 }
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
  show(started.mission);
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
  show(result.mission);
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
  show(checked.mission);
 }catch(error){failed(error);}
 finally{busy=false;if(current?.step_index===0)$("guided-confirm").disabled=false;}
}
global.AI4UGuided={startLatest,resume,confirmStep};
})(window);
