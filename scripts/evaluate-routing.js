"use strict";
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const source=fs.readFileSync(path.join(root,"index.html"),"utf8");
const start=source.indexOf("const ROUTING_DB = {");
const end=source.indexOf("function quickRoute(",start);
if(start<0||end<0)throw new Error("Router source markers missing");
const program=source.slice(start,end)+"\n({ ROUTING_DB, TASK_ROUTE_PROFILES, inferTaskRoute })";
const router=vm.runInNewContext(program,Object.freeze({}),{timeout:3000});
const cases=JSON.parse(fs.readFileSync(path.join(root,"evals/routing-cases.v1.json"),"utf8"));
const canonical=name=>String(name).replace("ChatGPT-4o","ChatGPT").replace("Gemini Ultra","Gemini");
const results=cases.map(c=>{
  try{
    const key=router.inferTaskRoute(c.goal,c.stage);
    const profile=(key&&router.TASK_ROUTE_PROFILES[key])||router.ROUTING_DB[c.stage]||router.ROUTING_DB.idea;
    const selected=profile.platform;
    return {...c,selected,route_type:key?"keyword":"stage",agreement:c.acceptable.some(x=>canonical(x)===canonical(selected)),error:null};
  }catch(e){return {...c,selected:null,route_type:null,agreement:false,error:String(e.message||e)};}
});
const summary={schema_version:1,source:"Current source-code router; no AI or external provider called",evaluation_type:"Curated reference-route agreement (not ground-truth task success)",cases:results.length,agreement_count:results.filter(r=>r.agreement).length,disagreement_count:results.filter(r=>!r.agreement&&!r.error).length,error_count:results.filter(r=>r.error).length,keyword_routes:results.filter(r=>r.route_type==="keyword").length,stage_routes:results.filter(r=>r.route_type==="stage").length,limitations:["Reference answers are editorial judgments, not independently benchmarked tool outcomes.","No real user usability study or end-to-end task execution was performed.","Stage and risk are supplied to the legacy UI, not automatically inferred.","The legacy confidence percentage is derived from risk, not measured reliability."],results};
if(process.argv.includes("--write"))fs.writeFileSync(path.join(root,"evals/baseline-2026-11-11.json"),JSON.stringify(summary,null,2)+"\n");
console.log(JSON.stringify(summary,null,2));
