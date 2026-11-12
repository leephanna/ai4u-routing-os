"use strict";
// Proof Pack V2: canonical signed manifest, exact sampled bytes, pinned verification key.
// A signature authenticates AI4U's receipt, not the truth of a third-party website.
const crypto=require("node:crypto");
const trusted=require("../../proof-key-v2.json");
const MAX_SAMPLE_BYTES=262144;
function canonical(value){
  if(value===null||typeof value==="string"||typeof value==="boolean")return JSON.stringify(value);
  if(typeof value==="number"&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
  if(value&&typeof value==="object"&&!Buffer.isBuffer(value)){
    return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";
  }
  throw new Error("Proof manifest contains unsupported data");
}
function hash(buffer){return crypto.createHash("sha256").update(buffer).digest("hex");}
function keyId(key){
  return hash(crypto.createPublicKey(key).export({format:"der",type:"spki"}));
}
function privateSigningKey(){
  const pem=process.env.AI4U_PROOF_SIGNING_PRIVATE_KEY;
  if(!pem){const e=new Error("Signed Proof Pack V2 is not configured on this environment.");e.status=503;throw e;}
  let key;
  try{key=crypto.createPrivateKey(pem);}catch(_){throw new Error("Proof signing key configuration is invalid");}
  if(key.asymmetricKeyType!=="ed25519"||keyId(key)!==trusted.key_id)throw new Error("Proof signing key does not match the published verification key");
  return key;
}
function iso(value){return value?new Date(value).toISOString():null;}
function checkedSample(record){
  const sample=record.sample_bytes;
  if(!Buffer.isBuffer(sample)||sample.length>MAX_SAMPLE_BYTES)throw new Error("Stored proof sample is missing or oversized");
  const report=record.report;
  if(!report||!report.evidence||!Array.isArray(report.checks))throw new Error("Stored proof report is invalid");
  if(report.evidence.sample_sha256!==hash(sample)||report.evidence.sample_bytes!==sample.length)throw new Error("Stored evidence hash or byte count mismatch");
  return sample;
}
function createReceipt(mission,record,issuedAt=new Date().toISOString()){
  const sample=checkedSample(record);
  const isCurrent=Number(mission.attempts)===Number(record.attempt);
  const accepted=isCurrent&&mission.status==="complete";
  const manifest={
    schema:"ai4u.router.website-proof.v2",
    mission_id:String(mission.id),
    attempt:Number(record.attempt),
    target_url:String(mission.target_url),
    run_status:String(record.report.status),
    mission_status_at_issue:accepted?"complete":String(record.report.status),
    user_accepted_at:accepted?iso(mission.completed_at):null,
    issued_at:iso(issuedAt),
    checked_at:iso(record.report.evidence.checked_at),
    checks:record.report.checks,
    evidence:record.report.evidence,
    artifact:{name:"homepage_sample",encoding:"base64",content_type:"application/octet-stream",byte_length:sample.length,sha256:hash(sample),truncated:!!record.report.evidence.sample_truncated},
    methodology:"Pinned-DNS HTTPS request with runtime TLS verification; sampled homepage HTML only",
    scope_limitations:"Not a browser, accessibility, performance, checkout, security, full-site, or third-party content-truth audit",
    software_revision:process.env.VERCEL_GIT_COMMIT_SHA||"unavailable"
  };
  const privateKey=privateSigningKey();
  const signature=crypto.sign(null,Buffer.from(canonical(manifest),"utf8"),privateKey).toString("base64");
  return {
    format:"AI4U Router Signed Proof Pack V2",
    manifest,
    signature:{algorithm:"Ed25519",key_id:trusted.key_id,value_base64:signature},
    verification_key_url:"https://routing.ai4utech.com/proof-key-v2.json"
  };
}
function completePack(receipt,sample){
  const pack={...receipt,artifacts:{homepage_sample:{encoding:"base64",data:sample.toString("base64")}}};
  verifyPack(pack);
  return pack;
}
function verifyPack(pack,publicKey=trusted){
  if(!pack||pack.format!=="AI4U Router Signed Proof Pack V2")throw new Error("Unsupported proof pack format");
  const m=pack.manifest,s=pack.signature;
  if(!m||m.schema!=="ai4u.router.website-proof.v2"||!s||s.algorithm!=="Ed25519"||s.key_id!==publicKey.key_id)throw new Error("Untrusted signing key or manifest");
  const key=crypto.createPublicKey(publicKey.public_key_pem);
  if(key.asymmetricKeyType!=="ed25519"||keyId(key)!==publicKey.key_id)throw new Error("Invalid trusted public key");
  if(typeof s.value_base64!=="string"||!(/^[A-Za-z0-9+/]{86}==$/).test(s.value_base64))throw new Error("Invalid signature encoding");
  if(!crypto.verify(null,Buffer.from(canonical(m),"utf8"),key,Buffer.from(s.value_base64,"base64")))throw new Error("Proof manifest signature is invalid");
  const artifact=pack.artifacts&&pack.artifacts.homepage_sample;
  if(!artifact||artifact.encoding!=="base64"||typeof artifact.data!=="string"||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(artifact.data))throw new Error("Evidence artifact missing or invalid");
  const sample=Buffer.from(artifact.data,"base64");
  if(sample.length>MAX_SAMPLE_BYTES||sample.length!==m.artifact.byte_length||hash(sample)!==m.artifact.sha256)throw new Error("Evidence artifact was modified or truncated");
  if(m.evidence.sample_sha256!==m.artifact.sha256||m.evidence.sample_bytes!==sample.length||m.artifact.truncated!==!!m.evidence.sample_truncated)throw new Error("Manifest evidence mismatch");
  if(!Array.isArray(m.checks)||m.checks.length!==5)throw new Error("Unexpected check set");
  return {verified:true,key_id:s.key_id,mission_id:m.mission_id,attempt:m.attempt,sample_bytes:sample.length,checked_at:m.checked_at};
}
module.exports={canonical,hash,keyId,checkedSample,createReceipt,completePack,verifyPack,MAX_SAMPLE_BYTES};
