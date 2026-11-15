"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const doc=fs.readFileSync(path.join(__dirname,"../../wix-inspector.html"),"utf8");
test("Wix dashboard shell is a non-sensitive placeholder, not a fake connected audit",()=>{
 assert.match(doc,/<!doctype html>/i);
 assert.match(doc,/name="robots" content="noindex,nofollow,noarchive"/);
 assert.match(doc,/NO WIX DATA ACCESSED/);
 assert.match(doc,/not yet enabled/);
 assert.match(doc,/not verified/);
 assert.match(doc,/rel="noopener noreferrer"/);
 assert.match(doc,/<script\b/i);
 assert.match(doc,/id="run-dev-check"/);
 assert.match(doc,/confirm_readonly:true/);
 assert.match(doc,/dev-check-result/);
 assert.doesNotMatch(doc,/<form\b/i);
 assert.doesNotMatch(doc,/signedInstance|access_token|app_secret|api\/mission\/site-audit/i);
 assert.doesNotMatch(doc,/localStorage|sessionStorage|document\.cookie/i);
});
