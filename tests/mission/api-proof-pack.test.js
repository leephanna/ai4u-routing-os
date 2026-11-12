"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const auth=require("../../lib/billing/auth"),db=require("../../lib/billing/db"),proof=require("../../lib/mission/proof-v2"),trusted=require("../../proof-key-v2.json");
const {auditSite}=require("../../lib/mission/site-audit");
const id="b5b5a2e2-bb55-4eb0-9999-89f73bd88811",owner="00000000-0000-4000-8000-000000000001";
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(x){this.body=JSON.parse(x);}};}
test("Signed export enforces owner scope, refuses V1 evidence and reuses persisted receipt",async()=>{
 const original={auth:auth.requireUser,query:db.query,pem:process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY,key:trusted.key_id,pub:trusted.public_key_pem};
 const {privateKey,publicKey}=crypto.generateKeyPairSync("ed25519");
 process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY=privateKey.export({type:"pkcs8",format:"pem"});
 trusted.public_key_pem=publicKey.export({type:"spki",format:"pem"});
 trusted.key_id=crypto.createHash("sha256").update(publicKey.export({type:"spki",format:"der"})).digest("hex");
 let user=owner,hasEvidence=true,receipt=null,created=0,accesses=0;
 const sample=Buffer.from('<html><title>ok</title><meta name="viewport" content="width=device-width"><body>Hi</body></html>');
 const audited=await auditSite("https://example.com/",async url=>({status:200,headers:{"content-type":"text/html"},body:sample.toString("utf8"),sample,finalUrl:url,redirects:[]}));
 const report={status:audited.status,checks:audited.checks,evidence:audited.evidence};
 const mission={id,user_id:owner,target_url:"https://example.com/",status:"complete",attempts:1,completed_at:"2026-11-12T06:00:00.000Z"};
 try{
  auth.requireUser=async()=>({id:user,email:"test@example.com"});
  db.query=async(sql,params)=>{
   assert.equal(params[1],user,"Every lookup must be owner-scoped");
   if(sql.includes("FROM ai4u_private.router_missions"))return {rows:user===owner?[mission]:[]};
   if(sql.includes("FROM ai4u_private.router_mission_evidence")){accesses++;return {rows:hasEvidence?[{mission_id:id,user_id:owner,attempt:1,sample_bytes:sample,report}]:[]};}
   if(sql.includes("FROM ai4u_private.router_mission_receipts"))return {rows:receipt?[{receipt}]:[]};
   if(sql.startsWith("INSERT INTO ai4u_private.router_mission_receipts")){created++;receipt=JSON.parse(params[4]);return {rows:[]};}
   throw Error("Unexpected SQL");
  };
  const p=require.resolve("../../api/mission/proof-pack");delete require.cache[p];const handler=require(p);
  const call=async(query,method="GET")=>{const res=response();await handler({method,query,headers:{}},res);return res;};
  assert.equal((await call({mission_id:id},"POST")).statusCode,405);
  assert.equal((await call({mission_id:"invalid"})).statusCode,400);
  user="00000000-0000-4000-8000-000000000002";
  assert.equal((await call({mission_id:id})).statusCode,404);
  user=owner;hasEvidence=false;
  const legacy=await call({mission_id:id});assert.equal(legacy.statusCode,409);assert.match(legacy.body.error,/cannot be retroactively certified/);
  hasEvidence=true;
  const first=await call({mission_id:id});assert.equal(first.statusCode,200);assert.equal(first.body.format,"AI4U Router Signed Proof Pack V2");
  assert.equal(proof.verifyPack(first.body).verified,true);
  const second=await call({mission_id:id});assert.equal(second.statusCode,200);
  assert.deepEqual(second.body,first.body);assert.equal(created,1);assert.equal(accesses,3);
  assert.equal((await call({mission_id:id,attempt:"999"})).statusCode,400);
 }finally{
  auth.requireUser=original.auth;db.query=original.query;
  if(original.pem===undefined)delete process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY;
  else process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY=original.pem;
  trusted.key_id=original.key;trusted.public_key_pem=original.pub;
  delete require.cache[require.resolve("../../api/mission/proof-pack")];
 }
});
