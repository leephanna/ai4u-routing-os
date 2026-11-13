(function(global){
  "use strict";
  const KEY="ai4u_router_last_site_mission";
  let current=null,busy=false;
  const byId=id=>document.getElementById(id);
  function setMessage(value){const el=byId("mission-message");if(el)el.textContent=value;}
  function setActionStatus(value,isError=false){
    const el=byId("mission-action-status");
    if(!el)return;
    el.textContent=value;
    el.style.color=isError?"#ffb4b4":"var(--white2)";
  }
  async function accessToken(){
    const billing=global.AI4UBilling;
    // The cached billing token may expire while a user reviews mission evidence.
    // Ask Supabase for the current (auto-refreshed) session before each request.
    if(billing&&typeof billing.getFreshAccessToken==="function"){
      return (await billing.getFreshAccessToken())||"";
    }
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
    if(!response.ok){
      const error=new Error(data.error||("The mission request failed (HTTP "+response.status+")."));
      error.status=response.status;
      throw error;
    }
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
    byId("mission-download-v2").disabled=checks.length===0;
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
    busy=true;byId("mission-start").disabled=true;setActionStatus("");
    try{
      setMessage("Saving the mission to the project database...");
      const mission=await request("POST",{action:"start",target_url:byId("mission-url").value.trim()});
      render(mission);
      await run();
    }catch(e){setMessage(e.message);}
    finally{busy=false;byId("mission-start").disabled=false; if(current){const checks=Array.isArray(current.checks)?current.checks:[];byId("mission-accept").disabled=!(checks.length&&checks.every(c=>c.status==="pass")&&current.status==="verified");}}
  }
  async function run(){
    if(!current)return;
    byId("mission-retry").disabled=true;setActionStatus("");
    setMessage("Executing HTTPS, response, title, and viewport checks. Please wait...");
    try{const mission=await request("POST",{action:"run",mission_id:current.id});render(mission);}
    catch(e){setMessage(e.message+" The mission is preserved; select Resume then Retry.");}
    finally{byId("mission-retry").disabled=!!(current&&current.attempts>=5);}
  }
  async function resume(){
    let id;try{id=localStorage.getItem(KEY);}catch(_){}
    if(!id){setMessage("No saved mission on this device. Enter a URL to begin.");return;}
    try{
      setMessage("Restoring the last mission from persistent storage...");
      const mission=await request("GET",null,id);
      render(mission);
      setActionStatus(mission.status==="complete"?"✓ Mission completion is confirmed in the database.":"");
    }
    catch(e){setMessage(e.message);}
  }
  async function accept(){
    if(!current||busy)return;
    const id=current.id,button=byId("mission-accept");
    busy=true;
    button.disabled=true;
    button.textContent="Completing...";
    setActionStatus("Saving your satisfaction and confirming the database record...");
    try{
      const accepted=await request("POST",{action:"accept",mission_id:id});
      if(!accepted||accepted.id!==id||accepted.status!=="complete"){
        throw new Error("The completion response did not confirm the mission status.");
      }
      // A fresh read distinguishes a persisted completion from a successful-looking POST.
      const confirmed=await request("GET",null,id);
      if(!confirmed||confirmed.id!==id||confirmed.status!=="complete"){
        throw new Error("The saved mission did not return a completed status.");
      }
      render(confirmed);
      setActionStatus("✓ Mission completed and confirmed in the database. You can now download Signed Proof Pack V2.");
    }catch(error){
      // A network error may occur after the server committed the update.
      // Read before offering a retry to avoid misleading the user.
      let recovered=false;
      try{
        const latest=await request("GET",null,id);
        if(latest&&latest.id===id){
          render(latest);
          recovered=latest.status==="complete";
        }
      }catch(_){}
      if(recovered){
        setActionStatus("✓ Mission completion is confirmed in the database. You can now download Signed Proof Pack V2.");
      }else{
        const message="Completion NOT confirmed: "+(error.message||"Request failed")+
          ". Your mission remains saved. If asked, sign in again under Settings, then retry.";
        setActionStatus(message,true);
        setMessage(message);
      }
    }finally{
      busy=false;
      button.textContent="I'm Satisfied — Complete";
      const checks=current&&Array.isArray(current.checks)?current.checks:[];
      const verified=checks.length>0&&checks.every(c=>c.status==="pass")&&current.status==="verified";
      button.disabled=!verified;
    }
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
  async function downloadSigned(){
    if(!current||busy||!Array.isArray(current.checks)||!current.checks.length)return;
    const button=byId("mission-download-v2");button.disabled=true;
    try{
      setMessage("Retrieving owner-authorized, server-signed Proof Pack V2...");
      const token=await accessToken();
      if(!token)throw new Error("Sign in to download a signed Proof Pack.");
      const response=await fetch("/api/mission/site-audit?proof=1&mission_id="+encodeURIComponent(current.id),{
        method:"GET",cache:"no-store",headers:{"Authorization":"Bearer "+token}
      });
      if(!response.ok){
        let error={};try{error=await response.json();}catch(_){}
        throw new Error(error.error||"Signed Proof Pack could not be issued.");
      }
      const pack=await response.json();
      if(pack.format!=="AI4U Router Signed Proof Pack V2"||!pack.signature||!pack.artifacts)throw new Error("The server did not return a signed V2 proof pack.");
      const blob=new Blob([JSON.stringify(pack,null,2)],{type:"application/json"});
      const href=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=href;a.download="AI4U_Signed_Proof_Pack_"+current.id+".json";
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
      setMessage("Signed Proof Pack V2 downloaded. Verify it offline using the published verifier and independently pinned public key.");
    }catch(e){setMessage(e.message);}
    finally{button.disabled=false;}
  }
  global.AI4UMission={start,run,resume,accept,download,downloadSigned};
})(window);
