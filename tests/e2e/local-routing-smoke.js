"use strict";
// Optional real-Chromium smoke for the Route Engine; requires Playwright installed separately.
// Serves actual static app files. Authentication/billing approval is simulated, and no charge occurs.
const http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.join(__dirname,"../..");
const server=http.createServer((req,res)=>{
 if(req.url.startsWith("/api/billing/config")){res.setHeader("Content-Type","application/json");return res.end('{"enabled":false}');}
 const filename=req.url==="/"?"/index.html":req.url.split("?")[0];
 if(!/^\/[a-zA-Z0-9._-]+$/.test(filename)){res.statusCode=404;return res.end("not found");}
 const full=path.join(root,filename);
 if(!fs.existsSync(full)){res.statusCode=404;return res.end("not found");}
 res.setHeader("Content-Type",filename.endsWith(".js")?"text/javascript":filename.endsWith(".html")?"text/html":"application/octet-stream");
 res.end(fs.readFileSync(full));
});
async function main(){
 await new Promise(ok=>server.listen(8766,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.route("https://cdn.jsdelivr.net/**",route=>route.abort());
  await page.goto("http://127.0.0.1:8766/",{waitUntil:"domcontentloaded",timeout:30000});
  await page.evaluate(()=>{
   window.AI4UBilling.requestTaskAccess=async()=>{window.__accessCalls=(window.__accessCalls||0)+1;return true;};
   window.__accessCalls=0;
   showPanel("router");
  });
  await page.click('button[onclick="runRouter()"]');
  await page.waitForTimeout(200);
  if(await page.evaluate(()=>window.__accessCalls)!==0)throw Error("Empty route requested billing access");
  const cases=[
   ["Build a one-page marketing website for a local shop","idea","medium","Wix"],
   ["Fact-check a disputed political claim with an auditable evidence trail","idea","high","AI4U Truth Task Force"],
   ["Automate a weekly email summary without coding","automation","low","Zapier"],
   ["Run Playwright browser regression tests on our live deployment","proof","high","GitHub Actions"],
   ["Build a tool-using AI agent with independent verification","agent","critical","Vercel AI SDK"],
   ["Design a website logo for my restaurant","idea","low","ChatGPT"],
   ["Compare Wix and Squarespace for a new website","idea","medium","Perplexity Pro"],
   ["Make a Shopify store with payments","idea","high","Shopify"]
  ];
  for(const [goal,stage,risk,expected] of cases){
   await page.selectOption("#r-stage",stage);
   await page.selectOption("#r-risk",risk);
   await page.fill("#r-goal",goal);
   await page.click('button[onclick="runRouter()"]');
   await page.waitForFunction(value=>document.querySelector("#route-output .route-platform-name")?.textContent===value,expected,{timeout:10000});
  }
  await page.setViewportSize({width:375,height:812});
  await page.locator(".nav-hamburger").click();
  await page.locator("#mobile-menu button").filter({hasText:"Route Engine"}).click();
  if(!await page.locator("#panel-router").evaluate(el=>el.classList.contains("active")))throw Error("Mobile routing navigation failed");
  console.log(JSON.stringify({result:"PASS",browser:"Chromium headless",cases:cases.length,empty_form_billing_guard:"PASS",mobile_navigation_375px:"PASS",actual_external_billing:"NOT EXECUTED",real_user_success:"NOT MEASURED"}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error("ROUTING_SMOKE_FAIL",e.stack);process.exitCode=1;}).finally(()=>server.close());
