"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {validateTarget,isPublicIPv4,auditSite}=require("../../lib/mission/site-audit");
test("Rejects private hosts, metadata IPs, non-HTTPS URLs, credentials and query secrets",()=>{
  for(const url of ["http://example.com","https://127.0.0.1","https://169.254.169.254/latest/meta-data","https://localhost","https://site.local","https://user:pass@example.com","https://example.com/?token=secret","https://example.com:8080/"]){
    assert.throws(()=>validateTarget(url));
  }
  for(const ip of ["127.0.0.1","10.0.0.1","172.16.0.1","192.168.1.1","169.254.169.254","100.64.1.1","192.0.2.1","198.51.100.1","203.0.113.1"]){
    assert.equal(isPublicIPv4(ip),false,ip);
  }
  assert.equal(isPublicIPv4("8.8.8.8"),true);
});
test("Real scoped evidence is computed from sampled HTTPS response, never assumed",async()=>{
  const good=await auditSite("https://example.com/",async url=>({
    status:200,headers:{"content-type":"text/html; charset=utf-8"},
    body:'<!doctype html><html><head><title>Example</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>Hello</body></html>',
    bytes:144,finalUrl:url,redirects:[]
  }));
  assert.equal(good.status,"verified");
  assert.equal(good.checks.length,5);
  assert.ok(good.checks.every(c=>c.status==="pass"));
  assert.match(good.evidence.sample_sha256,/^[a-f0-9]{64}$/);
  assert.match(good.evidence.scope,/not a browser/);
  const bad=await auditSite("https://example.com/",async()=>({status:503,headers:{"content-type":"text/plain"},body:"offline",bytes:7}));
  assert.equal(bad.status,"needs_attention");
  assert.ok(bad.checks.some(c=>c.status==="fail"));
});
test("No arbitrary customer URLs can be used to bypass HTTPS-only scope",()=>{
  assert.throws(()=>validateTarget("file:///etc/passwd"));
  assert.throws(()=>validateTarget("https://[::1]/"));
  assert.throws(()=>validateTarget("https://192.168.0.1/"));
});
