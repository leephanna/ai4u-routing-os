"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../../lib/billing/db");
const health=require("../../api/billing/health");
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=JSON.parse(v);}};}
test("Evaluation endpoint uses a fixed allowlist and parameterized SQL",async()=>{
 const original=db.query;const ids=[];
 try{
  db.query=async(sql,args)=>{assert.match(sql,/WHERE baseline_id=\$1/);ids.push(args[0]);return {rows:[{baseline_id:args[0],report:{cases:30},created_at:"2026-11-12"}]};};
  for(const [version,id] of Object.entries({legacy:"legacy-2026-11-11",baseline:"router-v2-baseline-2026-11-12",holdout:"router-v2-holdout-2026-11-12",stress:"router-v2-stress-2026-11-12",challenge:"router-v2-challenge-2026-11-12"})){
   const res=response();await health({method:"GET",query:{baseline:"1",version}},res);
   assert.equal(res.statusCode,200);assert.equal(res.body.baseline_id,id);
  }
  const bad=response();await health({method:"GET",query:{baseline:"1",version:"' OR 1=1 --"}},bad);
  assert.equal(bad.statusCode,400);
  assert.equal(ids.length,5);
 }finally{db.query=original;}
});
