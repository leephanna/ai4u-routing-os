"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
test("Step 4 replaces redundant public-audit prompt with scoped commerce review once owner proof is verified",()=>{
 const script=fs.readFileSync(path.join(__dirname,"../../guided-mission.js"),"utf8");
 const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
 assert.match(html,/id="guided-step4-heading"/);
 assert.match(script,/const homepageVerified=assessment\?\.homepage\?\.status==="five_checks_passed"/);
 assert.match(script,/auditButton\.hidden=!!homepageVerified/);
 assert.match(script,/Save your evidence-backed Commerce Readiness Review/);
 assert.match(script,/No need to rerun this homepage test/);
 assert.match(script,/if\(homepage\.status==="five_checks_passed"&&homepage\.sample_sha256&&!review\)/);
});
