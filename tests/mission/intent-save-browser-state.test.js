"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
class Element {
 constructor(){this.children=[];this.hidden=false;this.disabled=false;this.textContent="";this.dataset={};this.style={};this.value="";this.listeners={};this.attributes={};}
 appendChild(child){this.children.push(child);return child;}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(name,callback){this.listeners[name]=callback;}
 scrollIntoView(){}
 focus(){this.focused=true;}
}
test("Improve → Save is enabled after preview; Save is called and readback verified",async()=>{
 const ids=["intent-status","intent-goal","intent-preview","intent-resume","intent-suggestions","intent-options","intent-clarify","intent-steps","intent-chosen","intent-save","intent-saved","intent-save-status","intent-next","mission-url","r-goal","r-stage","r-risk","intent-route-risk-note"];
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
 elements["intent-goal"].value="I want to build an affordable store for handmade wreaths.";
 const plan={original_goal:elements["intent-goal"].value,status:"ready_for_review",category:"website_project",steps:[{title:"Confirm goal",action:"Agree scope",acceptance_criteria:"User confirms"}],alternatives:[{id:"recommended",label:"Recommended — Most effective",prompt:"Build an affordable shop",tradeoff:"Balanced"}],clarification:null};
 let stored=null,saveCalls=0;
 const fetch=async(url,options)=>{
  const body=options.body?JSON.parse(options.body):{};
  if(options.method==="POST"&&body.action==="preview")return {ok:true,json:async()=>({plan})};
  if(options.method==="POST"&&body.action==="save"){
   saveCalls++;
   stored={id:"11111111-1111-4111-8111-111111111111",original_goal:body.goal,chosen_option:body.option,chosen_prompt:"Build an affordable shop",plan};
   return {ok:true,json:async()=>({saved:stored,plan})};
  }
  if(url.includes("intent=1"))return {ok:true,json:async()=>({saved:stored})};
  throw new Error("Unexpected fetch "+url);
 };
 let shown=null;
 const context={showPanel:name=>{shown=name;},document:{getElementById:id=>elements[id]||null,createElement:()=>new Element(),querySelectorAll:()=>[]},fetch,AbortController,setTimeout,clearTimeout,URL,console,window:null};
 context.window=context;
 context.AI4UBilling={getFreshAccessToken:async()=> "test-fake-token"};
 const script=fs.readFileSync(path.join(__dirname,"../../mission-intent.js"),"utf8");
 vm.runInNewContext(script,context,{filename:"mission-intent.js"});
 await context.AI4UIntent.preview();
 assert.equal(elements["intent-save"].disabled,false,"Save must be enabled when the suggestion is ready");
 await context.AI4UIntent.save();
 assert.equal(saveCalls,1,"A Save click must reach the authenticated POST");
 assert.match(elements["intent-save-status"].textContent,/SAVED AND VERIFIED/);
 assert.equal(elements["intent-save"].disabled,false);
 await context.AI4UIntent.resume();
 assert.equal(elements["intent-save"].disabled,false,"Resume must not leave Save disabled either");
 assert.match(elements["intent-save-status"].textContent,/successfully restored/);
 assert.equal(elements["intent-next"].hidden,false,"Saved plan exposes one next action");
 context.AI4UIntent.next();
 assert.equal(shown,"router");
 assert.equal(elements["r-goal"].value,"Build an affordable shop");
 // A legacy saved plan can contain duplicated AI4U helper text. Clean only the handoff.
 stored.chosen_prompt="I want to build an online store for handmade wreaths that accepts payments. Copy prompt. Identify the most efficient practical route and return a verifiable result. Ask before irreversible actions. Identify the most efficient practical route and return a verifiable result. Ask before irreversible actions.";
 await context.AI4UIntent.resume();
 elements["r-risk"].value="low";
 context.AI4UIntent.next();
 assert.equal(elements["r-goal"].value,"I want to build an online store for handmade wreaths that accepts payments.");
 assert.equal(elements["r-risk"].value,"high");
 assert.equal(elements["r-stage"].value,"idea");
 assert.match(elements["intent-route-risk-note"].textContent,/payments or selling/);
 assert.equal(stored.chosen_prompt.includes("Copy prompt."),true,"saved receipt is unchanged");


});
