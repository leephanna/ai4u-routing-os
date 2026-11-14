"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {compareStorefront}=require("../../lib/mission/storefront-comparison");
test("US shipping+pickup budget route stays a candidate and links official sources",()=>{
 const c=compareStorefront({region:"US",shipping:"both",budget:"under_50"});
 assert.equal(c.recommendation,"wix");assert.equal(c.mode,"source_snapshot");
 assert.equal(c.options.length,3);
 assert.ok(c.options.every(x=>x.sources.length>=2&&x.sources.every(uri=>uri.startsWith("https://"))));
 assert.match(c.disclaimer,/not measured probability/);
 assert.match(c.reasons.join(" "),/annual prepayment/);
});
test("Pickup-only low budget can favor Square; non-US requires local verification",()=>{
 assert.equal(compareStorefront({region:"US",shipping:"pickup",budget:"under_50"}).recommendation,"square");
 const nonUS=compareStorefront({region:"CA",shipping:"both",budget:"under_50"});
 assert.equal(nonUS.recommendation,null);assert.equal(nonUS.mode,"needs_local_verification");
});
test("Step 2 is explicitly human-selected with acknowledgement and no billing execution",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const server=fs.readFileSync(path.join(__dirname,"../../lib/mission/guided-handler.js"),"utf8");
 const ui=fs.readFileSync(path.join(__dirname,"../../guided-mission.js"),"utf8");
 const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
 assert.match(server,/action==="choose_route"/);
 assert.match(server,/acknowledge_review!==true/);
 assert.match(server,/user_selected_unverified/);
 assert.match(server,/FOR UPDATE/);
 assert.match(server,/revision=revision\+1/);
 assert.match(server,/route_user_selected/);
 assert.match(ui,/verifiedReadback\(current\.id\)/);
 assert.match(html,/id="guided-step-three" hidden/);
 assert.match(html,/id="guided-route-options"/);
 assert.doesNotMatch(server,/stripe\.checkout|charge\.create|publishSite/);
});
