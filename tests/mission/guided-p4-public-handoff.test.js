"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
class Element{
 constructor(){this.value="";this.textContent="";this.hidden=false;this.disabled=false;this.dataset={};this.attributes={};this.checked=false;this.scrolled=false;}
 setAttribute(k,v){this.attributes[k]=v;}
 scrollIntoView(){this.scrolled=true;}
 addEventListener(){}
}
test("Step 4 uses verified public URL hint, requires explicit click and cannot claim store readiness",async()=>{
 const ids=["guided-message","guided-panel","guided-id","guided-step-one","guided-step-two","guided-step-three","guided-step-four","guided-progress","guided-site-review","guided-public-url","guided-site-audit-source","guided-public-audit","mission-url"];
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
 const mission={id:"33333333-3333-4333-8333-333333333333",step_index:3,status:"awaiting_site_review",
  setup_context:{site_status:"existing",site_name:"Sparrow Wreath Preview",site_url:null},route_choice:{platform:"wix"}};
 let runs=0;
 const ctx={window:null,document:{
  getElementById:id=>elements[id]||null,
  querySelectorAll:()=>[]
 },AI4UBilling:{getFreshAccessToken:async()=>"fake-test-token"},
 AI4UMission:{start:async()=>{runs++;}},
 showPanel:()=>{},fetch:async()=>({ok:true,json:async()=>({mission})}),
 AbortController,setTimeout,clearTimeout,URL,console};
 ctx.window=ctx;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../../guided-mission.js"),"utf8"),ctx);
 await ctx.AI4UGuided.resume();
 assert.equal(elements["guided-step-four"].hidden,false);
 assert.equal(elements["guided-public-url"].value,"https://headless-etnhqsdtksr-leehanna8-1409.wix-site-host.com/");
 assert.equal(runs,0,"Resume cannot launch an audit automatically");
 await ctx.AI4UGuided.preparePublicAudit();
 assert.equal(runs,1);
 assert.equal(elements["mission-url"].value,elements["guided-public-url"].value);
 assert.equal(elements["mission-url"].scrolled,true);
 assert.match(elements["guided-site-audit-source"].textContent,/NOT been verified/);
 assert.match(elements["guided-message"].textContent,/existing read-only homepage checks/);
 assert.equal(mission.step_index,3,"Public pilot handoff must not advance guided checkpoint");
});
test("Step 4 blocks unsafe or unsupported URLs without sending any request",async()=>{
 const ids=["guided-message","guided-panel","guided-id","guided-step-one","guided-step-two","guided-step-three","guided-step-four","guided-progress","guided-site-review","guided-public-url","guided-site-audit-source","guided-public-audit","mission-url"];
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
 const mission={id:"33333333-3333-4333-8333-333333333333",step_index:3,setup_context:{site_status:"existing",site_name:"Other site",site_url:null},route_choice:{platform:"wix"}};
 let runs=0;
 const ctx={window:null,document:{getElementById:id=>elements[id]||null,querySelectorAll:()=>[]},
 AI4UBilling:{getFreshAccessToken:async()=>"mock"},AI4UMission:{start:async()=>{runs++;}},
 fetch:async()=>({ok:true,json:async()=>({mission})}),AbortController,setTimeout,clearTimeout,URL,console,showPanel:()=>{}};
 ctx.window=ctx;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../../guided-mission.js"),"utf8"),ctx);
 await ctx.AI4UGuided.resume();
 for(const value of ["http://example.com/","https://example.com/private","https://user:pw@example.com/","https://example.com/?secret=abc"]){
  elements["guided-public-url"].value=value;
  await ctx.AI4UGuided.preparePublicAudit();
 }
 assert.equal(runs,0);
 assert.match(elements["guided-message"].textContent,/root homepage URL/);
});
