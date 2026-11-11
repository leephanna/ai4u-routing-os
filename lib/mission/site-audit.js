"use strict";
// A deliberately narrow first mission: HTTPS homepage readiness, not a full browser, accessibility, or checkout audit.
// DNS is resolved and pinned to a vetted public IPv4 address for each TLS connection.
const https=require("node:https");
const dns=require("node:dns").promises;
const net=require("node:net");
const crypto=require("node:crypto");
const MAX_BYTES=262144;
function bad(message){const e=new Error(message);e.status=400;return e;}
function validateTarget(value){
  if(typeof value!=="string"||value.length>2048)throw bad("Enter an HTTPS homepage URL under 2048 characters.");
  let url;try{url=new URL(value);}catch(_){throw bad("Enter a valid HTTPS URL.");}
  if(url.protocol!=="https:"||url.username||url.password||url.port&&url.port!=="443"||url.search||url.pathname!=="/"){
    throw bad("Use a public HTTPS root homepage URL (/) with no credentials, query parameters, or custom port.");
  }
  if(net.isIP(url.hostname)||!url.hostname.includes(".")||/\.(local|localhost|internal|test|invalid|onion)$/i.test(url.hostname)){
    throw bad("Only public DNS hostnames are supported.");
  }
  url.hash="";
  return url;
}
function isPublicIPv4(value){
  if(net.isIP(value)!==4)return false;
  const a=value.split(".").map(Number),[x,y]=a;
  if(x===0||x===10||x===127||x>=224||x===169&&y===254||x===172&&y>=16&&y<=31||
     x===192&&(y===168||y===0||y===88)||x===100&&y>=64&&y<=127||
     x===192&&y===0&&a[2]===2||x===198&&(y===18||y===19||y===51&&a[2]===100)||
     x===203&&y===0&&a[2]===113)return false;
  return true;
}
async function resolvePublicIPv4(hostname){
  const addresses=await dns.lookup(hostname,{all:true,family:4});
  const approved=addresses.map(x=>x.address).filter(isPublicIPv4);
  if(!approved.length||approved.length!==addresses.length)throw bad("The hostname resolves to a non-public or unsupported address.");
  return approved[0];
}
async function fetchOnce(url){
  const address=await resolvePublicIPv4(url.hostname);
  return new Promise((resolve,reject)=>{
    const request=https.request(url,{
      method:"GET",agent:false,timeout:7000,rejectUnauthorized:true,
      lookup:(host,options,cb)=>options&&options.all?cb(null,[{address,family:4}]):cb(null,address,4),
      headers:{"User-Agent":"AI4U-Router-Readiness/1.0","Accept":"text/html","Connection":"close"}
    },response=>{
      const chunks=[];let bytes=0,truncated=false,finished=false;
      const finish=()=>{if(finished)return;finished=true;resolve({status:response.statusCode||0,headers:response.headers,body:Buffer.concat(chunks).toString("utf8"),bytes,truncated});};
      if(response.statusCode>=300&&response.statusCode<400&&response.headers.location){response.resume();finish();return;}
      response.on("data",chunk=>{
        if(finished)return;
        const available=MAX_BYTES-bytes;
        if(chunk.length>available){truncated=true;chunks.push(chunk.subarray(0,available));bytes+=available;finish();response.destroy();return;}
        chunks.push(chunk);bytes+=chunk.length;
      });
      response.on("end",finish);
      response.on("error",e=>{if(!finished)reject(e);});
    });
    request.on("timeout",()=>request.destroy(new Error("HTTPS request timed out")));
    request.on("error",reject);
    request.end();
  });
}
async function fetchPage(input){
  let current=validateTarget(input),redirects=[];
  for(let i=0;i<4;i++){
    const response=await fetchOnce(current);
    if(response.status>=300&&response.status<400&&response.headers.location){
      if(i===3)throw bad("Too many redirects; maximum three.");
      const next=validateTarget(new URL(response.headers.location,current).href);
      redirects.push({from:current.href,to:next.href,status:response.status});
      current=next;continue;
    }
    return {...response,finalUrl:current.href,redirects};
  }
  throw bad("Too many redirects.");
}
function check(id,label,passed,detail){
  return {id,label,status:passed?"pass":"fail",detail:String(detail||"").slice(0,240)};
}
async function auditSite(input,fetcher=fetchPage){
  const target=validateTarget(input).href;
  const response=await fetcher(target);
  const html=response.body||"";
  const status=response.status||0;
  const contentType=String(response.headers&&response.headers["content-type"]||"").split(";")[0].trim();
  const titleMatch=html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title\s*>/i);
  const title=titleMatch?titleMatch[1].replace(/<[^>]*>/g,"").trim().slice(0,140):"";
  const hasViewport=/<meta\b(?=[^>]*\bname\s*=\s*["']?viewport\b)[^>]*>/i.test(html);
  const checks=[
    check("https_tls","HTTPS transport",true,"TLS certificate validated by the server runtime"),
    check("http_2xx","HTTP success",status>=200&&status<300,"HTTP "+status),
    check("html_document","HTML response",contentType==="text/html"&&/<(?:html|body)\b/i.test(html),contentType||"Missing content type"),
    check("page_title","Nonempty page title",!!title,title||"No title in sampled HTML"),
    check("mobile_viewport","Mobile viewport metadata",hasViewport,hasViewport?"Viewport meta found":"Viewport meta missing")
  ];
  const checkedAt=new Date().toISOString();
  return {
    target_url:target,status:checks.every(c=>c.status==="pass")?"verified":"needs_attention",checks,
    evidence:{scope:"HTTPS homepage response checks only; not a browser, accessibility, performance, payment, or full asset audit",checked_at:checkedAt,final_url:response.finalUrl||target,http_status:status,content_type:contentType,redirects:response.redirects||[],sample_bytes:response.bytes||Buffer.byteLength(html),sample_truncated:!!response.truncated,sample_sha256:crypto.createHash("sha256").update(html).digest("hex"),title}
  };
}
module.exports={validateTarget,isPublicIPv4,resolvePublicIPv4,fetchPage,auditSite};
