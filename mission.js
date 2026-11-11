(function(global){
  "use strict";
  const KEY="ai4u_router_last_site_mission";
  let current=null,busy=false;
  const byId=id=>document.getElementById(id);
  function setMessage(value){const el=byId("mission-message");if(el)el.textContent=value;}
  async function accessToken(){
    const billing=global.AI4UBilling;
    if(billing&&typeof billing.getAccessToken==="function"){
      const t=billing.getAccessToken();if(t)return t;
    }
    const sb=global.AI4U_SB;
    if(sb&&sb.client){const r=await sb.client.auth.getSession();return r.data&&r.data.session?r.data.session.access_token:"";}
    return "";
  }
  async function request(method,body,id){
    const token=await accessToken();
    if(!token)throw new Error("Sign in under Settings (or Billing), then return here to start or resume a mission.");
    const url="/api/mission/site-audit"+(id?"?mission_id="+encodeURIComponent(id):"");
    const response=await fetch(url,{method,cache:"no-store",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:body?JSON.stringify(body):undefined});
    let data={};try{data=await response.json();}catch(_){}
    if(!response.ok)throw new Error(data.error||"The mission request failed.");
    return data.mission;
  }
  function markStep(id,done){const el=byId(id);if(el)el.textContent=done?"✓":"○";}
  function render(mission){
    current=mission;
    try{localStorage.setItem(KEY,mission.id);}catch(_){}
    byId("mission-id").textContent=mission.id;
    byId("mission-state").textContent=mission.status.replaceAll("_"," ");
    byId("mission-target").textContent=mission.target_url;
    const checks=Array.isArray(mission.checks)?mission.checks:[];
    const container=byId("mission-checks");container.replaceChildren();
    for(const c of checks){
      const line=document.createElement("div");
      line.style.cssText="padding:10px 12px;margin-top:8px;border:1px solid var(--border);border-radius:8px";
      const title=document.createElement("strong");
      title.textContent=(c.status==="pass"?"✓ PASS — ":"✕ FAIL — ")+c.label;
      const detail=document.createElement("div");detail.style.cssText="font-size:12px;color:var(--white3);margin-top:4px";
      detail.textContent=c.detail||"";
      line.append(title,detail);container.appendChild(line);
    }
    const verified=checks.length>0&&checks.every(c=>c.status==="pass")&&["verified","complete"].includes(mission.status);
    markStep("mission-step-1",true);
    markStep("mission-step-2",checks.length>0);
    markStep("mission-step-3",checks.length>0);
    markStep("mission-step-4",mission.status==="complete");
    byId("mission-retry").disabled=busy||mission.attempts>=5;
    byId("mission-accept").disabled=busy||!verified||mission.status==="complete";
    byId("mission-download").disabled=checks.length===0;
    byId("mission-attempts").textContent=String(mission.attempts);
    byId("mission-checked").textContent=mission.checked_at||"Not yet run";
    byId("mission-result").hidden=false;
    if(mission.status==="complete")setMessage("Completed and preserved. The Proof Pack covers HTTPS homepage checks only.");
    else if(verified)setMessage("All five scoped checks passed. Review the evidence, download the Proof Pack, then confirm satisfaction.");
    else if(mission.status==="needs_attention")setMessage("Some checks failed. Correct the website and select Retry; no false VERIFIED status was issued.");
    else if(mission.status==="failed")setMessage("Execution failed: "+(mission.last_error||"Try again later.")+" You can retry without losing the mission.");
    else setMessage("Mission saved. Execute the network checks to collect evidence.");
  }
  async function start(){
    if(busy)return;
    busy=true;byId("mission-start").disabled=true;
    try{
      setMessage("Saving the mission to the project database...");
      const mission=await request("POST",{action:"start",target_url:byId("mission-url").value.trim()});
      render(mission);
      await run();
    }catch(e){setMessage(e.message);}
    finally{busy=false;byId("mission-start").disabled=false;}
  }
  async function run(){
    if(!current)return;
    byId("mission-retry").disabled=true;
    setMessage("Executing HTTPS, response, title, and viewport checks. Please wait...");
    try{const mission=await request("POST",{action:"run",mission_id:current.id});render(mission);}
    catch(e){setMessage(e.message+" The mission is preserved; select Resume then Retry.");}
    finally{byId("mission-retry").disabled=false;}
  }
  async function resume(){
    let id;try{id=localStorage.getItem(KEY);}catch(_){}
    if(!id){setMessage("No saved mission on this device. Enter a URL to begin.");return;}
    try{setMessage("Restoring the last mission from persistent storage...");render(await request("GET",null,id));}
    catch(e){setMessage(e.message);}
  }
  async function accept(){
    if(!current)return;
    try{render(await request("POST",{action:"accept",mission_id:current.id}));}
    catch(e){setMessage(e.message);}
  }
  function download(){
    if(!current||!Array.isArray(current.checks)||!current.checks.length)return;
    const verified=current.checks.every(c=>c.status==="pass")&&["verified","complete"].includes(current.status);
    const pack={format:"AI4U Router Website Readiness Proof Pack v1",mission_id:current.id,target_url:current.target_url,mission_status:current.status,scoped_verification:verified?"PASS":"NOT VERIFIED",method:"Server-side HTTPS request and sampled HTML checks",scope_limitations:"Not a browser, payment, accessibility, performance, security, or full asset test",attempts:current.attempts,checks:current.checks,evidence:current.evidence,checked_at:current.checked_at,completed_at:current.completed_at,persistence:"Owner-scoped mission record in Router's Supabase-backed Postgres"};
    const blob=new Blob([JSON.stringify(pack,null,2)],{type:"application/json"});
    const href=URL.createObjectURL(blob);const a=document.createElement("a");
    a.href=href;a.download="AI4U_Proof_Pack_"+current.id+".json";
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
  }
  global.AI4UMission={start,run,resume,accept,download};
})(window);
