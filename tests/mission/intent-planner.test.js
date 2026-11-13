"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {planMission}=require("../../lib/mission/intent-planner");
test("Empty goals request meaningful selectable clarification",()=>{
 const p=planMission({goal:" "});
 assert.equal(p.status,"needs_clarification");
 assert.equal(p.clarification.options.length,3);
 assert.equal(p.execution_allowed,false);
});
test("Ambiguous requests offer alternative wording without claiming intent is confirmed",()=>{
 const p=planMission({goal:"Build it"});
 assert.equal(p.status,"needs_clarification");
 assert.equal(p.alternatives.length,3);
 assert.equal(p.inferred_intent.is_assumption,true);
 assert.equal(p.steps.every(s=>s.status==="not_started"),true);
});
test("Complete website task produces scoped step and review status",()=>{
 const p=planMission({goal:"Audit my website https://example.com/ for launch readiness",acceptance_criteria:["Five scoped checks recorded"]});
 assert.equal(p.status,"ready_for_review");
 assert.equal(p.category,"website_readiness");
 assert.ok(p.steps.some(s=>s.id==="website-check"&&s.mode==="website_readiness"));
 assert.equal(p.acceptance_criteria.length,1);
 assert.equal(p.execution_allowed,false);
 assert.ok(p.steps.find(s=>s.id==="approve").requires_approval);
});
test("Missing URL asks for target rather than guessing",()=>{
 const p=planMission({goal:"Audit my website before launch"});
 assert.equal(p.status,"needs_clarification");
 assert.match(p.clarification.question,/homepage/i);
 assert.ok(!p.steps.some(s=>s.id==="website-check"));
});
test("User constraints are preserved; optimization includes a faster and deeper route",()=>{
 const p=planMission({goal:"Create a website for a small wreath shop",constraints:["mobile friendly","low cost"],budget:"$100",acceptanceCriteria:["working checkout"]});
 assert.equal(p.alternatives[1].id,"fast");
 assert.equal(p.alternatives[2].id,"thorough");
 assert.match(p.suggested_prompt,/mobile friendly/);
 assert.match(p.suggested_prompt,/\$100/);
 assert.deepEqual(p.acceptance_criteria,["working checkout"]);
});
test("Risky requests require explicit approval; planner cannot execute",()=>{
 const p=planMission({goal:"Publish my new website and send emails to clients"});
 assert.ok(p.risks_detected.includes("publish"));
 assert.ok(p.risks_detected.includes("send"));
 assert.equal(p.execution_allowed,false);
});
test("No fabricated numeric confidence and no auto-completion",()=>{
 const p=planMission({goal:"Find a practical solution for organizing customer requests"});
 assert.equal(typeof p.inferred_intent.confidence_label,"string");
 assert.equal(p.steps.at(-1).mode,"human");
 assert.equal(p.steps.at(-1).status,"not_started");
 assert.throws(()=>planMission(null),TypeError);
});

test("Natural first-person requests are not duplicated in improvements",()=>{
 const p=planMission({goal:"I want to sell handmade wreaths online"});
 assert.match(p.suggested_prompt,/^I want to sell/);
 assert.doesNotMatch(p.suggested_prompt,/I want to I want to/);
});
