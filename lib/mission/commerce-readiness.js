"use strict";
// Site-specific read-only inventory. Does not imply Wix OAuth inside Routing OS.
const crypto=require("node:crypto");
const EXISTING_SITE={
 name:"Sparrow Wreath Preview",
 url:"https://headless-etnhqsdtksr-leehanna8-1409.wix-site-host.com/",
 wix_site_id:"438bf0a6-4162-4166-9a14-30ccd129ff00"
};
function selectedSite(row){
 if(row?.route_choice?.platform!=="wix"||row?.setup_context?.site_status!=="existing")return null;
 const ctx=row.setup_context;
 if(ctx.site_name!==EXISTING_SITE.name)return null;
 if(ctx.site_url&&ctx.site_url!==EXISTING_SITE.url)return null;
 return EXISTING_SITE;
}
function sampledHtmlFindings(bytes,claimedDigest){
 if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>262144)return {valid:false};
 const digest=crypto.createHash("sha256").update(bytes).digest("hex");
 if(digest!==claimedDigest)return {valid:false};
 const sample=bytes.toString("utf8");
 return {
  valid:true,
  has_noindex:/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(sample),
  has_preview_notice:/first-look website preview|not yet accepting orders or payments/i.test(sample),
  contains_showcase_cards:/class=["'][^"']*product-card/i.test(sample),
  // Explicit HTML observations only, not a browser or ecommerce API verification.
  has_static_cart_link:/href=["'][^"']*\/(?:cart|checkout)(?:[\/?#]|["'])/i.test(sample)
 };
}
async function assess(row,query){
 const site=selectedSite(row);
 const base={
  site_name:row?.setup_context?.site_name||null,mode:site?"known_site_snapshot":"unlinked",
  homepage:{status:"not_linked"},commerce:{
   products:"not_verified",cart:"not_verified",payments:"not_verified",
   shipping:"not_verified",pickup:"not_verified",wix_stores:"not_listed_in_prior_inventory"
  },
  next_action:"Verify existing site commerce capabilities with explicit Wix account authorization. No purchase or rebuilding is justified yet.",
  provenance:{wix_inventory:"Read-only Wix site context from separate ChatGPT connector inspection; not a Routing OS account connection.",checked_at:"2026-11-14"}
 };
 if(!site){
  base.commerce.wix_stores="not_verified";
  base.next_action="Confirm the intended Wix site and connect a scoped, read-only Wix account before reviewing commerce readiness.";
  return base;
 }
 const sql="SELECT m.id,m.target_url,m.status,m.checks,m.checked_at,e.sample_bytes,e.sample_sha256 FROM ai4u_private.router_missions m LEFT JOIN LATERAL (SELECT sample_bytes,sample_sha256 FROM ai4u_private.router_mission_evidence WHERE mission_id=m.id AND user_id=$1 ORDER BY attempt DESC LIMIT 1) e ON true WHERE m.user_id=$1 AND m.target_url=$2 AND m.status='complete' ORDER BY m.completed_at DESC LIMIT 1";
 const result=await query(sql,[row.user_id,site.url]);
 const match=result.rows[0];
 if(!match){
  base.next_action="Complete the existing HTTPS Homepage Readiness test, then return here to review the evidence.";
  return base;
 }
 const checks=Array.isArray(match.checks)?match.checks:[];
 const allPassed=checks.length===5&&checks.every(c=>c&&c.status==="pass");
 const sample=sampledHtmlFindings(match.sample_bytes,match.sample_sha256);
 base.homepage={
  status:allPassed?"five_checks_passed":"needs_review",
  mission_id:match.id,
  checked_at:match.checked_at||null,
  checks_passed:checks.filter(c=>c?.status==="pass").length,
  checks_total:checks.length,
  sample_sha256:sample.valid?match.sample_sha256:null,
  html_observations:sample.valid?{
   preview_notice:sample.has_preview_notice,showcase_cards:sample.contains_showcase_cards,
   noindex:sample.has_noindex,static_cart_link:sample.has_static_cart_link
  }:null,
  scope:"Sampled HTTPS/HTML only; NOT an ecommerce, browser, payment, or fulfillment audit."
 };
 if(!allPassed||!sample.valid){
  base.next_action="Review or rerun the homepage check; no verified content sample is available for a commerce-readiness assessment.";
  return base;
 }
 base.commerce.showcase=sample.contains_showcase_cards?"showcase_markup_present":"not_established";
 base.commerce.orders=sample.has_preview_notice?"preview_not_accepting_orders":"not_verified";
 base.commerce.indexing=sample.has_noindex?"noindex_in_html_sample":"not_verified";
 base.next_action="Keep the existing preview. Next, authorize a read-only Wix commerce inspection before selecting catalog, payment or shipping changes.";
 return base;
}
module.exports={EXISTING_SITE,selectedSite,sampledHtmlFindings,assess};
