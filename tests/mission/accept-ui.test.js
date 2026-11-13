"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const script=fs.readFileSync(path.join(__dirname,"../../mission.js"),"utf8");
const ID="11111111-1111-4111-8111-111111111111";
function harness(failAccept=false){
  const elements=new Map();
  function element(id){
    if(!elements.has(id))elements.set(id,{
      textContent:"",disabled:false,hidden:false,style:{},
      replaceChildren(){this.children=[];},
      append(...children){this.children=(this.children||[]).concat(children);},
      appendChild(child){this.children=(this.children||[]).concat(child);}
    });
    return elements.get(id);
  }
  const stored=new Map([["ai4u_router_last_site_mission",ID]]);
  const verified={id:ID,target_url:"https://example.com/",status:"verified",attempts:1,
    checks:[{status:"pass",label:"HTTPS",detail:"TLS valid"}],checked_at:"2026-11-12T04:00:00Z"};
  const complete={...verified,status:"complete",completed_at:"2026-11-12T04:01:00Z"};
  let saved=verified,tokenRefreshes=0;
  const requests=[];
  const window={AI4UBilling:{
    getAccessToken:()=>"intentionally-stale-token",
    getFreshAccessToken:async()=>{tokenRefreshes++;return "fresh-token";}
  }};
  const context={
    window,document:{getElementById:element,createElement:()=>({
      textContent:"",style:{},append(...items){this.children=items;}
    })},
    localStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)},
    fetch:async(url,options)=>{
      const method=options.method;
      requests.push({method,url,authorization:options.headers.Authorization});
      if(method==="POST"){
        assert.equal(JSON.parse(options.body).action,"accept");
        if(failAccept)return {ok:false,status:401,json:async()=>({error:"Your sign-in session expired. Please sign in again."})};
        saved=complete;
      }
      return {ok:true,status:200,json:async()=>({mission:saved})};
    }
  };
  vm.runInNewContext(script,context,{filename:"mission.js"});
  return {mission:window.AI4UMission,element,requests,getRefreshes:()=>tokenRefreshes};
}

test("Completion confirms POST and persisted GET, then updates the visible progress",async()=>{
  const h=harness();
  await h.mission.resume();
  assert.equal(h.element("mission-step-4").textContent,"○",h.element("mission-message").textContent);
  await h.mission.accept();
  assert.equal(h.element("mission-step-4").textContent,"✓");
  assert.equal(h.element("mission-state").textContent,"complete");
  assert.match(h.element("mission-action-status").textContent,/confirmed in the database/i);
  assert.equal(h.element("mission-accept").disabled,true);
  assert.deepEqual(h.requests.map(r=>r.method),["GET","POST","GET"]);
  assert.ok(h.requests.every(r=>r.authorization==="Bearer fresh-token"));
  assert.equal(h.getRefreshes(),3);
});

test("Failed completion leaves mission verified and displays error beside the button",async()=>{
  const h=harness(true);
  await h.mission.resume();
  await h.mission.accept();
  assert.equal(h.element("mission-step-4").textContent,"○",h.element("mission-message").textContent);
  assert.equal(h.element("mission-state").textContent,"verified");
  assert.match(h.element("mission-action-status").textContent,/session expired/i);
  assert.equal(h.element("mission-accept").disabled,false);
  assert.deepEqual(h.requests.map(r=>r.method),["GET","POST","GET"]);
});
