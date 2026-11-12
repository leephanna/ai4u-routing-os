"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"../..");
const source=fs.readFileSync(path.join(root,"index.html"),"utf8");
const a=source.indexOf("const ROUTING_DB = {"),b=source.indexOf("function quickRoute(",a);
assert.ok(a>=0&&b>a,"Router source markers must remain stable");
const router=vm.runInNewContext(source.slice(a,b)+"\n({ ROUTING_DB, TASK_ROUTE_PROFILES, inferTaskRoute })",{},{timeout:3000});
function select(goal,stage){
 const key=router.inferTaskRoute(goal,stage);
 return ((key&&router.TASK_ROUTE_PROFILES[key])||router.ROUTING_DB[stage]||router.ROUTING_DB.idea).platform;
}
const fixtures=[
 ["baseline","routing-cases.v1.json",30],
 ["holdout","routing-holdout.v1.json",40],
 ["stress","routing-stress.v1.json",20],
 ["challenge","routing-challenge.v1.json",17]
];
for(const [name,file,minimum] of fixtures){
 test(name+" editorial reference regression floor",()=>{
  const cases=JSON.parse(fs.readFileSync(path.join(root,"evals",file),"utf8"));
  let matched=0;
  for(const c of cases){
   const got=select(c.goal,c.stage);
   if(c.acceptable.some(x=>x.replace("ChatGPT-4o","ChatGPT")===got))matched++;
  }
  assert.ok(matched>=minimum,`${name}: ${matched}/${cases.length} matches, expected >=${minimum}`);
 });
}
test("Explicit user intent overrides unrelated website/platform words",()=>{
 assert.equal(select("Design a website logo for my restaurant","idea"),"ChatGPT");
 assert.equal(select("Create a content calendar for my website","idea"),"ChatGPT");
 assert.equal(select("Compare Wix and Squarespace for a new website","idea"),"Perplexity Pro");
 assert.equal(select("Make a Shopify store with payments","idea"),"Shopify");
 assert.equal(select("Launch a small store with product listings and payments","idea"),"Wix");
 assert.equal(select("Build a tool-using agent with independent verification","agent"),"Vercel AI SDK");
 assert.equal(select("Automate a weekly email summary without coding","automation"),"Zapier");
 assert.equal(select("Fact-check a disputed political claim with an auditable evidence trail","idea"),"AI4U Truth Task Force");
});
test("Critical route note makes no zero-failure guarantee",()=>{
 assert.ok(!source.includes("zero tolerance for failure"));
 assert.ok(source.includes("No toolchain guarantees zero failures"));
});
