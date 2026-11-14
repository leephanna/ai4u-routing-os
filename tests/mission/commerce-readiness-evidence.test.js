"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {assess,selectedSite,sampledHtmlFindings,EXISTING_SITE}=require("../../lib/mission/commerce-readiness");
const USER="00000000-0000-4000-8000-000000000001",PROOF="6374615d-80ad-4d1e-aa5f-712ac6cf475a";
const html=Buffer.from('<!doctype html><html><head><meta name="robots" content="noindex, nofollow"></head><body><div class="preview-note">A first-look website preview</div><article class="product-card">Example</article><footer>Not yet accepting orders or payments</footer></body></html>');
const sha=crypto.createHash("sha256").update(html).digest("hex");
const row={user_id:USER,route_choice:{platform:"wix"},setup_context:{site_status:"existing",site_name:"Sparrow Wreath Preview",site_url:null}};
const receipt={id:PROOF,target_url:EXISTING_SITE.url,status:"complete",
 checked_at:"2026-11-14T05:35:32.774Z",checks:Array.from({length:5},()=>({status:"pass"})),
 sample_bytes:html,sample_sha256:sha};
test("Only selected existing Wix preview can be linked to its scoped account proof",()=>{
 assert.ok(selectedSite(row));
 assert.equal(selectedSite({...row,setup_context:{...row.setup_context,site_name:"Other site"}}),null);
 assert.equal(selectedSite({...row,route_choice:{platform:"square"}}),null);
 assert.equal(sampledHtmlFindings(html,sha).valid,true);
 assert.equal(sampledHtmlFindings(html,"bad").valid,false);
});
test("Readiness report separates five homepage checks from every unverified commerce capability",async()=>{
 let argumentsSeen;
 const outcome=await assess(row,async(sql,params)=>{
  assert.match(sql,/m.user_id=\$1/);
  assert.match(sql,/m.target_url=\$2/);
  assert.match(sql,/m.status='complete'/);
  argumentsSeen=params;return {rows:[receipt]};
 });
 assert.deepEqual(argumentsSeen,[USER,EXISTING_SITE.url]);
 assert.equal(outcome.homepage.status,"five_checks_passed");
 assert.equal(outcome.homepage.mission_id,PROOF);
 assert.equal(outcome.homepage.sample_sha256,sha);
 assert.equal(outcome.homepage.html_observations.preview_notice,true);
 assert.equal(outcome.homepage.html_observations.noindex,true);
 assert.equal(outcome.commerce.payments,"not_verified");
 assert.equal(outcome.commerce.shipping,"not_verified");
 assert.equal(outcome.commerce.cart,"not_verified");
 assert.equal(outcome.commerce.orders,"preview_not_accepting_orders");
 assert.match(outcome.next_action,/read-only Wix commerce inspection/);
});
test("Missing owner proof, failed checks or corrupt sample cannot produce verified commerce review",async()=>{
 const missing=await assess(row,async()=>({rows:[]}));
 assert.equal(missing.homepage.status,"not_linked");
 const incomplete=await assess(row,async()=>({rows:[{...receipt,checks:[{status:"pass"}]}]}));
 assert.notEqual(incomplete.homepage.status,"five_checks_passed");
 const corrupt=await assess(row,async()=>({rows:[{...receipt,sample_sha256:"0000"}]}));
 assert.equal(corrupt.homepage.sample_sha256,null);
 const unknown=await assess({...row,setup_context:{site_status:"new",site_name:null}},async()=>{throw Error("Must not query");});
 assert.equal(unknown.mode,"unlinked");
});
