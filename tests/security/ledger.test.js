"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
function between(start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,"Expected source markers: "+start);
  return html.slice(a,b);
}
const helpers=between("function escapeHTML(value){","const RISK_NOTES = {");
const ledger=between("function refreshLedger(filter='all'){","function filterLedger(");
function render(entries){
  const element={innerHTML:""};
  const context={URL,state:{ledger:entries},document:{getElementById(id){return id==="ledger-list"?element:null;}}};
  vm.runInNewContext(helpers+ledger+"\nrefreshLedger();",context,{timeout:1000});
  return element.innerHTML;
}
test("Ledger escapes every user-supplied field and rejects script URLs",()=>{
  const payload='\"><img src=x onerror=alert(1)>';
  const rendered=render([{id:'1\" onclick=\"alert(1)',task:payload,platform:payload,date:payload,outcome:"worked",why:payload,framework:payload,proof:payload,artifact:"javascript:alert(1)",sync_status:"local_only"}]);
  assert.ok(rendered.includes("&lt;img"));
  assert.equal(rendered.includes("<img"),false);
  assert.equal(rendered.includes('href="javascript:'),false);
  assert.equal(rendered.includes('onclick="alert(1)"'),false);
  assert.equal(rendered.includes('onerror=alert(1)>'),false);
});
test("Ledger retains safe HTTPS artifact links and escapes attributes",()=>{
  const rendered=render([{id:3,task:"safe",platform:"Vercel",date:"today",outcome:"worked",artifact:"https://example.com/path?x=%22test%22"}]);
  assert.ok(rendered.includes('href="https://example.com/path?x=%22test%22"'));
  assert.ok(rendered.includes('rel="noopener noreferrer"'));
});
test("Unmeasured success claims are not displayed as proof",()=>{
  assert.equal(html.includes('class="check-pass">✓ PASS'),false);
  assert.equal(html.includes("Routing guidance indicator: ${confidence}%"),false);
  assert.equal(html.includes("data:[96,94,91,88,99,92,98,78]"),false);
  assert.ok(html.includes("Routing Evaluation · V2"));
});
