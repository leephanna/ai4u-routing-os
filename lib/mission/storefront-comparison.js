"use strict";
// Reviewed primary-source snapshot, not a live pricing feed.
// Never use the prices below as binding checkout quotes.
const SOURCES={
 wix:{pricing:"https://www.wix.com/plans",fulfillment:"https://support.wix.com/en/article/wix-stores-about-shipping-delivery-and-pickup"},
 shopify:{pricing:"https://www.shopify.com/pricing",fulfillment:"https://help.shopify.com/en/manual/fulfillment/setup/delivery-methods/pickup-in-store"},
 square:{pricing:"https://squareup.com/us/en/pricing",fees:"https://squareup.com/help/us/en/article/5068-what-are-square-s-fees"}
};
const REVIEWED="2026-11-13";
const OPTIONS=[
 {id:"wix",name:"Wix Core",cost:"About $29–30 per month on an annual plan; charged annually. Location and taxes may change the price.",strength:"Visual, low-code storefront with checkout, shipping and local pickup.",caution:"Confirm final billed cost, processing fees, delivery profiles, and fragile-product shipping.",sources:[SOURCES.wix.pricing,SOURCES.wix.fulfillment]},
 {id:"shopify",name:"Shopify Basic",cost:"Listed from $29/month with annual billing on the US pricing page; verify the monthly billing quote.",strength:"Commerce-focused inventory, shipping and in-store pickup workflows.",caution:"Review monthly versus annual price, apps, transaction fees, pickup rules and theme effort.",sources:[SOURCES.shopify.pricing,SOURCES.shopify.fulfillment]},
 {id:"square",name:"Square Free",cost:"Starting subscription price $0 for eligible basic online selling; online payment processing fees apply.",strength:"Potential low fixed-cost starting route for a small catalog and local pickup.",caution:"Verify shipping capabilities on the selected plan, design controls, branding/domain cost and online processing fees.",sources:[SOURCES.square.pricing,SOURCES.square.fees]}
];
function compareStorefront(requirements){
 const r=requirements||{},reasons=[];
 if(r.region!=="US")return {reviewed_at:REVIEWED,mode:"needs_local_verification",recommendation:null,options:OPTIONS.map(x=>({...x,fit:"Requires country-specific pricing and eligibility review"})),reasons:["Prices and plan availability here were checked primarily for the US. Do not treat this comparison as a local quote."],disclaimer:"Research snapshot only. Verify provider checkout and current prices before purchase."};
 let best="wix";
 if(r.budget==="under_50"&&r.shipping==="pickup"){best="square";reasons.push("Local pickup and low fixed monthly cost make Square worth checking first.");}
 else if(r.shipping==="ship"&&r.budget==="over_150"){best="shopify";reasons.push("Shipping-focused retail operations warrant a Shopify comparison.");}
 else reasons.push("An easy-to-edit Wix storefront is a practical candidate for a small shop using shipping and pickup.");
 if(r.budget==="under_50")reasons.push("Budget under $50 is a monthly target: annual prepayment and processing fees still require verification.");
 if(r.shipping==="both")reasons.push("Both shipment and local pickup are required. Confirm checkout supports each path and test sample orders.");
 reasons.push("Prices are a dated source snapshot, not a guaranteed quote, and actual shipping rates for fragile wreaths depend on package measurements and destinations.");
 return {reviewed_at:REVIEWED,mode:"source_snapshot",recommendation:best,options:OPTIONS.map(x=>({...x,fit:x.id===best?"Suggested starting point, pending verification":"Viable alternative; compare the tradeoffs"})),reasons,disclaimer:"Rule-based recommendation, not measured probability of success. No provider account, checkout, or shipment was tested."};
}
module.exports={compareStorefront,REVIEWED,SOURCES};
