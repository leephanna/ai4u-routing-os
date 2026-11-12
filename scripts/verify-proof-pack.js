#!/usr/bin/env node
"use strict";
// Standalone offline verifier. Requires Node.js >=20, no account/network/dependencies.
// TRUST ROOT: the public key below must be obtained independently of the proof pack.
const fs=require("node:fs");
const crypto=require("node:crypto");
const TRUSTED_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAQHvZD7u88KU22bjlMbRLeUsIX/zlR2JcwoEBsdx2cbU=\n-----END PUBLIC KEY-----\n";
const TRUSTED_KEY_ID="66d9b4bd1aac1f82ef5108a9710faa64c367dd9b9dc5ed3515c77fb36e6f3c83";
function canonical(v){
  if(v===null||typeof v==="string"||typeof v==="boolean")return JSON.stringify(v);
  if(typeof v==="number"&&Number.isFinite(v))return JSON.stringify(v);
  if(Array.isArray(v))return "["+v.map(canonical).join(",")+"]";
  if(v&&typeof v==="object"&&!Buffer.isBuffer(v))return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
  throw Error("Unsupported manifest value");
}
function hash(v){return crypto.createHash("sha256").update(v).digest("hex");}
function verify(pack){
  if(!pack||pack.format!=="AI4U Router Signed Proof Pack V2"||pack.manifest?.schema!=="ai4u.router.website-proof.v2")throw Error("Not a supported V2 pack");
  const sig=pack.signature||{},m=pack.manifest;
  if(sig.algorithm!=="Ed25519"||sig.key_id!==TRUSTED_KEY_ID)throw Error("Untrusted key ID");
  const key=crypto.createPublicKey(TRUSTED_PUBLIC_KEY);
  if(hash(key.export({type:"spki",format:"der"}))!==TRUSTED_KEY_ID)throw Error("Verifier trust root invalid");
  if(typeof sig.value_base64!=="string"||!/^[A-Za-z0-9+/]{86}==$/.test(sig.value_base64))throw Error("Malformed signature");
  if(!crypto.verify(null,Buffer.from(canonical(m)),key,Buffer.from(sig.value_base64,"base64")))throw Error("Manifest signature INVALID");
  const a=pack.artifacts?.homepage_sample;
  if(!a||a.encoding!=="base64"||typeof a.data!=="string"||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.data))throw Error("Evidence missing or malformed");
  const raw=Buffer.from(a.data,"base64");
  if(raw.length>262144||raw.length!==m.artifact?.byte_length||hash(raw)!==m.artifact?.sha256)throw Error("Evidence hash or length INVALID");
  if(m.evidence?.sample_sha256!==m.artifact.sha256||m.evidence?.sample_bytes!==raw.length||m.artifact?.truncated!==!!m.evidence?.sample_truncated)throw Error("Evidence metadata inconsistent");
  if(!Array.isArray(m.checks)||m.checks.length!==5)throw Error("Check set inconsistent");
  return {result:"SIGNATURE_AND_EVIDENCE_VERIFIED",mission_id:m.mission_id,attempt:m.attempt,checked_at:m.checked_at,key_id:TRUSTED_KEY_ID,bytes:raw.length,scope:m.scope_limitations};
}
try{
  if(process.argv.length!==3)throw Error("Usage: node verify-proof-pack.js <downloaded-pack.json>");
  const raw=fs.readFileSync(process.argv[2]);
  if(raw.length>1024*1024)throw Error("Proof Pack exceeds the 1 MiB verifier limit");
  const result=verify(JSON.parse(raw.toString("utf8")));
  console.log(JSON.stringify(result,null,2));
}catch(e){console.error("PROOF_VERIFICATION_FAILED: "+e.message);process.exitCode=1;}
