"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm");
const fs=require("node:fs"),path=require("node:path");
class Element{
 constructor(tag="div"){this.tag=tag;this.value="";this.textContent="";this.hidden=false;this.disabled=false;this.checked=false;this.dataset={};this.children=[];this.attributes={};}
 setAttribute(k,v){this.attributes[k]=v;}
 appendChild(c){this.children.push(c);return c;}
 replaceChildren(){this.children=[];}
 scrollIntoView(){}
}
test("Step 2 click is actionable, verifies readback and resumes without duplicate writes",async()=>{
 const ids=["guided-message","guided-panel","guided-id","guided-step-one","guided-step-two","guided-step-three","guided-progress","guided-region","guided-shipping","guided-budget","guided-confirm","guided-route-options","guided-reasons","guided-review-ack","guided-comparison-date","guided-choose-route","guided-selected-route"];
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
 const id="33333333-3333-4333-8333-333333333333";
 const record={id,plan_id:"22222222-2222-4222-8222-222222222222",step_index:1,status:"awaiting_route_review",revision:1,
  requirements:{region:"US",shipping:"both",budget:"under_50",verification:"user_confirmed"},route_choice:{}};
 const comparison={mode:"source_snapshot",reviewed_at:"2026-11-13",recommendation:"wix",reasons:["Compare fees"],options:[
  {id:"wix",name:"Wix Core",cost:"Annual commitment",strength:"Simple editor",caution:"Verify rates",fit:"Suggested",sources:["https://www.wix.com/plans"]},
  {id:"shopify",name:"Shopify Basic",cost:"Annual commitment",strength:"Retail",caution:"Verify rates",fit:"Alternative",sources:["https://www.shopify.com/pricing"]}
 ]};
 let writes=0,reads=0,radios=[];
 const doc={
  getElementById:key=>elements[key]||null,
  createElement:tag=>{const node=new Element(tag);if(tag==="input")radios.push(node);return node;},
  querySelector:()=>radios.find(node=>node.checked)||null
 };
 const fetch=async(url,opts)=>{
  const body=opts.body?JSON.parse(opts.body):{};
  if(opts.method==="GET"){reads++;return {ok:true,json:async()=>({mission:{...record},comparison})};}
  if(body.action==="choose_route"){
   writes++;assert.equal(body.revision,1);assert.equal(body.platform,"wix");assert.equal(body.acknowledge_review,true);
   record.step_index=2;record.revision=2;record.status="awaiting_setup";record.route_choice={platform:"wix",platform_name:"Wix Core",verification:"user_selected_unverified"};
   return {ok:true,json:async()=>({mission:{...record}})};
  }
  throw Error("Unexpected request");
 };
 const ctx={window:null,document:doc,fetch,AI4UBilling:{getFreshAccessToken:async()=> "mock"},
  crypto:{randomUUID:()=> "44444444-4444-4444-8444-444444444444"},showPanel:()=>{},
  AbortController,setTimeout,clearTimeout,URL,console};
 ctx.window=ctx;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../../guided-mission.js"),"utf8"),ctx);
 await ctx.AI4UGuided.resume();
 assert.equal(elements["guided-step-two"].hidden,false);
 assert.equal(radios.find(node=>node.checked)?.value,"wix");
 assert.equal(elements["guided-choose-route"].disabled,false);
 elements["guided-review-ack"].checked=true;
 await ctx.AI4UGuided.chooseRoute();
 assert.equal(writes,1);
 assert.equal(elements["guided-step-three"].hidden,false);
 assert.match(elements["guided-selected-route"].textContent,/Wix Core/);
 await ctx.AI4UGuided.resume();
 assert.equal(writes,1);
 assert.equal(elements["guided-step-three"].hidden,false);
 assert.ok(reads>=3);
});
