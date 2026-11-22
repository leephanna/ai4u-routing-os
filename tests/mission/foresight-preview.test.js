"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.resolve(__dirname,"../../mission-intent.js"),"utf8");
test("Foresight preview is opt-in, not enabled for existing Router users",()=>{
  assert.match(source,/URLSearchParams\(global\.location\.search\)\.get\("foresight_preview"\)==="1"/);
  assert.match(source,/if\(!foresightPreviewEnabled\(\)/);
});
test("Suggested action is a plain-English card with progressive disclosure",()=>{
  assert.match(source,/DO THIS NEXT · Preview/);
  assert.match(source,/Show me exactly how/);
  assert.match(source,/Why this step\?/);
  assert.match(source,/Explore deeper research/);
});
test("Foresight preview does not pretend research or verification happened",()=>{
  assert.match(source,/No proactive research has been performed in this preview/);
  assert.match(source,/ranking has not yet been independently tested/);
});
test("Foresight preview uses safe DOM text, not innerHTML",()=>{
  const start=source.indexOf("function renderForesightPreview(");
  const end=source.indexOf("function render(value)",start);
  assert.ok(start>0&&end>start);
  assert.doesNotMatch(source.slice(start,end),/innerHTML|insertAdjacentHTML|eval\(/);
  assert.match(source.slice(start,end),/text\(card,"h3"/);
});
test("Existing save/resume/route handoff functions remain",()=>{
  for(const name of ["async function preview()","async function save()","async function resume()","function next()"]){
    assert.ok(source.includes(name),name);
  }
});
