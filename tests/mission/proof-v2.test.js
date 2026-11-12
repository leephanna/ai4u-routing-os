"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path");
const {spawnSync}=require("node:child_process");
const proof=require("../../lib/mission/proof-v2"),trusted=require("../../proof-key-v2.json");
const {auditSite}=require("../../lib/mission/site-audit");
const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519");
const privatePem=privateKey.export({format:"pem",type:"pkcs8"});
const publicPem=publicKey.export({format:"pem",type:"spki"});
const kid=crypto.createHash("sha256").update(publicKey.export({format:"der",type:"spki"})).digest("hex");
const uuid="b5b5a2e2-bb55-4eb0-9999-89f73bd88811";
async function fixture(){
 const sample=Buffer.from([60,104,116,109,108,62,0xff,0xfe,60,47,104,116,109,108,62]);
 const report=await auditSite("https://example.com/",async url=>({
  status:200,headers:{"content-type":"text/html"},sample,body:sample.toString("utf8"),
  finalUrl:url,redirects:[],truncated:false
 }));
 const record={attempt:1,sample_bytes:sample,report:{status:report.status,checks:report.checks,evidence:report.evidence}};
 const mission={id:uuid,target_url:"https://example.com/",status:"complete",attempts:1,completed_at:"2026-11-12T06:00:00.000Z"};
 return {sample,record,mission};
}
test("Exact response bytes are hashed even with invalid UTF-8",async()=>{
 const {sample,record}=await fixture();
 assert.equal(record.report.evidence.sample_sha256,proof.hash(sample));
 assert.equal(record.report.evidence.sample_bytes,sample.length);
 assert.notEqual(record.report.evidence.sample_sha256,proof.hash(Buffer.from(sample.toString("utf8"))));
});
test("Ed25519 signed pack verifies; all tampering, missing evidence and wrong key fail",async()=>{
 const prior={pem:process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY,id:trusted.key_id,pub:trusted.public_key_pem};
 try{
  process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY=privatePem;
  trusted.key_id=kid;trusted.public_key_pem=publicPem;
  const {record,mission,sample}=await fixture();
  const receipt=proof.createReceipt(mission,record,"2026-11-12T06:01:00.000Z");
  const pack=proof.completePack(receipt,sample);
  assert.equal(proof.verifyPack(pack).verified,true);
  assert.equal(pack.manifest.user_accepted_at,mission.completed_at);
  function modified(fn){const p=JSON.parse(JSON.stringify(pack));fn(p);return p;}
  assert.throws(()=>proof.verifyPack(modified(p=>p.manifest.checks[0].status="fail")),/signature/);
  assert.throws(()=>proof.verifyPack(modified(p=>p.manifest.issued_at="2030-01-01T00:00:00Z")),/signature/);
  assert.throws(()=>proof.verifyPack(modified(p=>p.artifacts.homepage_sample.data=Buffer.from("different").toString("base64"))),/modified|truncated|hash|length/);
  assert.throws(()=>proof.verifyPack(modified(p=>delete p.artifacts)),/Evidence/);
  assert.throws(()=>proof.verifyPack(modified(p=>p.signature.key_id="f".repeat(64))),/Untrusted/);
  assert.throws(()=>proof.verifyPack(modified(p=>p.signature.value_base64="A".repeat(86)+"==")),/signature/);
  assert.throws(()=>proof.verifyPack(pack,{key_id:"0".repeat(64),public_key_pem:publicPem}),/Untrusted/);
  const bad={...record,sample_bytes:Buffer.from("changed")};
  assert.throws(()=>proof.createReceipt(mission,bad),/mismatch/);
  delete process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY;
  assert.throws(()=>proof.createReceipt(mission,record),/not configured/);
 }finally{
  if(prior.pem===undefined)delete process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY;
  else process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY=prior.pem;
  trusted.key_id=prior.id;trusted.public_key_pem=prior.pub;
 }
});
test("Standalone offline verifier accepts a signed pack and rejects altered evidence",async()=>{
 const prior={pem:process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY,id:trusted.key_id,pub:trusted.public_key_pem};
 try{
  process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY=privatePem;trusted.key_id=kid;trusted.public_key_pem=publicPem;
  const {mission,record,sample}=await fixture();
  const pack=proof.completePack(proof.createReceipt(mission,record),sample);
  const tmp=fs.mkdtempSync(path.join(require("node:os").tmpdir(),"ai4u-proof-test-"));
  try{
   const original=fs.readFileSync(path.join(__dirname,"../../scripts/verify-proof-pack.js"),"utf8");
   const script=original.replace(prior.pub.replace(/\n/g,"\\n"),publicPem.replace(/\n/g,"\\n")).replace(/66d9b4bd1aac1f82ef5108a9710faa64c367dd9b9dc5ed3515c77fb36e6f3c83/g,kid);
   // Only the test copy gets a test trust root; the production verifier remains pinned.
   const scriptPath=path.join(tmp,"verify.js"),packPath=path.join(tmp,"pack.json");
   fs.writeFileSync(scriptPath,script);fs.writeFileSync(packPath,JSON.stringify(pack));
   const ok=spawnSync(process.execPath,[scriptPath,packPath],{encoding:"utf8"});
   assert.equal(ok.status,0,ok.stderr);
   assert.match(ok.stdout,/SIGNATURE_AND_EVIDENCE_VERIFIED/);
   pack.artifacts.homepage_sample.data=Buffer.from("tampered").toString("base64");
   fs.writeFileSync(packPath,JSON.stringify(pack));
   const bad=spawnSync(process.execPath,[scriptPath,packPath],{encoding:"utf8"});
   assert.equal(bad.status,1);
   assert.match(bad.stderr,/PROOF_VERIFICATION_FAILED/);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 }finally{
  if(prior.pem===undefined)delete process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY;
  else process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY=prior.pem;
  trusted.key_id=prior.id;trusted.public_key_pem=prior.pub;
 }
});
test("Production verifier trust root matches published key",()=>{
 const script=fs.readFileSync(path.join(__dirname,"../../scripts/verify-proof-pack.js"),"utf8");
 assert.ok(script.includes(trusted.key_id));
 assert.ok(script.includes(trusted.public_key_pem.replace(/\n/g,"\\n")));
});
