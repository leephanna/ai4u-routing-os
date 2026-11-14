"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
class Element {
 constructor(){this.value="";this.hidden=false;this.disabled=false;this.textContent="";this.dataset={};this.attributes={};this.events={};}
 setAttribute(key,val){this.attributes[key]=val;}
 scrollIntoView(){this.scrolled=true;}
}
test("Real UI lifecycle: Start saved mission → confirm choices → server readback → Resume",async()=>{
 const ids=["guided-message","guided-panel","guided-id","guided-step-one","guided-step-two","guided-progress","guided-region","guided-shipping","guided-budget","guided-confirm"];
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
 const planId="22222222-2222-4222-8222-222222222222";
 const missionId="33333333-3333-4333-8333-333333333333";
 const record={id:missionId,plan_id:planId,status:"awaiting_user",step_index:0,revision:0,requirements:{}};
 let startCount=0,submitCount=0,readCount=0,panel=null;
 const fetch=async(url,options)=>{
  const body=options.body?JSON.parse(options.body):{};
  if(url.includes("intent=1"))return {ok:true,json:async()=>({saved:{id:planId}})};
  if(options.method==="POST"&&body.action==="start"){
   startCount++;return {ok:true,json:async()=>({mission:{...record}})};
  }
  if(options.method==="POST"&&body.action==="confirm_requirements"){
   submitCount++;
   assert.equal(body.revision,0);
   assert.equal(body.requirements.region,"US");
   assert.equal(body.requirements.shipping,"ship");
   assert.equal(body.requirements.budget,"not_sure");
   assert.equal(typeof body.request_id,"string");
   record.status="awaiting_route_review";record.step_index=1;record.revision=1;
   record.requirements={...body.requirements,verification:"user_confirmed"};
   return {ok:true,json:async()=>({mission:{...record}})};
  }
  if(options.method==="GET"&&url.includes("guided=1")){
   readCount++;return {ok:true,json:async()=>({mission:{...record}})};
  }
  throw Error("Unexpected request: "+options.method+" "+url);
 };
 const ctx={document:{getElementById:id=>elements[id]||null},fetch,window:null,
  AI4UBilling:{getFreshAccessToken:async()=> "mock-token"},
  crypto:{randomUUID:()=>"44444444-4444-4444-8444-444444444444"},
  showPanel:name=>{panel=name;},AbortController,setTimeout,clearTimeout,URL,console};
 ctx.window=ctx;
 const script=fs.readFileSync(path.join(__dirname,"../../guided-mission.js"),"utf8");
 vm.runInNewContext(script,ctx,{filename:"guided-mission.js"});
 await ctx.AI4UGuided.startLatest();
 assert.equal(startCount,1);assert.equal(panel,"mission");
 assert.equal(elements["guided-step-one"].hidden,false);
 assert.equal(elements["guided-step-two"].hidden,true);
 assert.equal(elements["guided-confirm"].disabled,false);
 elements["guided-region"].value="US";elements["guided-shipping"].value="ship";elements["guided-budget"].value="not_sure";
 await ctx.AI4UGuided.confirmStep();
 assert.equal(submitCount,1);assert.equal(readCount,1);
 assert.equal(elements["guided-step-one"].hidden,true);
 assert.equal(elements["guided-step-two"].hidden,false);
 assert.match(elements["guided-message"].textContent,/user-confirmed/);
 await ctx.AI4UGuided.resume();
 assert.equal(readCount,2);
 assert.equal(elements["guided-step-two"].hidden,false);
 assert.equal(submitCount,1);
});
