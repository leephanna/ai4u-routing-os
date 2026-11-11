"use strict";
// Optional browser smoke test. Uses an in-memory API fixture, but runs real HTTPS checks.
// Requires: npm install --no-save playwright && npx playwright install chromium
const http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const {auditSite}=require("../../lib/mission/site-audit");
let mission=null;
const root=path.join(__dirname,"../..");
const server=http.createServer(async(req,res)=>{
  try{
    if(req.url.startsWith("/api/billing/config")){res.setHeader("Content-Type","application/json");return res.end('{"enabled":false}');}
    if(req.url.startsWith("/api/mission/site-audit")){
      res.setHeader("Content-Type","application/json");
      let body={};
      if(req.method==="POST"){const parts=[];for await(const c of req)parts.push(c);body=JSON.parse(Buffer.concat(parts).toString()||"{}");}
      if(req.method==="GET")return res.end(JSON.stringify({mission}));
      if(body.action==="start"){mission={id:"11111111-1111-4111-8111-111111111111",target_url:body.target_url,status:"draft",attempts:0,checks:[],evidence:{}};res.statusCode=201;}
      if(body.action==="run"){const report=await auditSite(mission.target_url);mission={...mission,...report,attempts:mission.attempts+1,checked_at:new Date().toISOString()};}
      if(body.action==="accept"){mission.status="complete";mission.completed_at=new Date().toISOString();}
      return res.end(JSON.stringify({mission}));
    }
    const filename=req.url==="/"?"/index.html":req.url.split("?")[0];
    if(!/^\/[a-zA-Z0-9._-]+$/.test(filename)){res.statusCode=404;return res.end("missing");}
    const full=path.join(root,filename);
    if(!fs.existsSync(full)){res.statusCode=404;return res.end("missing");}
    res.setHeader("Content-Type",filename.endsWith(".js")?"text/javascript":filename.endsWith(".html")?"text/html":"application/octet-stream");
    res.end(fs.readFileSync(full));
  }catch(error){res.statusCode=500;res.end(JSON.stringify({error:error.message}));}
});
async function main(){
  await new Promise(ok=>server.listen(8765,"127.0.0.1",ok));
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
    const page=await browser.newPage({acceptDownloads:true});
    await page.route("https://cdn.jsdelivr.net/**",route=>route.abort());
    await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded",timeout:30000});
    await page.evaluate(()=>{window.AI4UBilling.getAccessToken=()=>"smoke-test-token";});
    await page.locator('button[onclick="showPanel(\'mission\')"]').first().click();
    await page.fill("#mission-url","https://routing.ai4utech.com/");
    await page.click("#mission-start");
    await page.waitForFunction(()=>document.getElementById("mission-state").textContent==="verified",null,{timeout:30000});
    const checks=await page.locator("#mission-checks > div").count();
    if(checks!==5)throw new Error("Expected five visible checks, got "+checks);
    const waitDownload=page.waitForEvent("download");
    await page.click("#mission-download");
    const download=await waitDownload;
    if(!download.suggestedFilename().startsWith("AI4U_Proof_Pack_"))throw new Error("Proof Pack not downloadable");
    await page.click("#mission-accept");
    await page.waitForFunction(()=>document.getElementById("mission-state").textContent==="complete");
    await page.reload({waitUntil:"domcontentloaded"});
    await page.evaluate(()=>{window.AI4UBilling.getAccessToken=()=>"smoke-test-token";});
    await page.locator('button[onclick="showPanel(\'mission\')"]').first().click();
    await page.click('button[onclick="AI4UMission.resume()"]');
    await page.waitForFunction(()=>document.getElementById("mission-state").textContent==="complete");
    await page.evaluate(()=>{localStorage.setItem("ai4u_ledger",JSON.stringify([{id:1,task:"<img src=x onerror=window.__xss=1>",platform:"Vercel",outcome:"worked",date:"today",why:"<script>window.__xss=1</script>",artifact:"javascript:alert(1)"}]));});
    await page.reload({waitUntil:"domcontentloaded"});
    await page.locator('button[onclick="showPanel(\\'ledger\\')"]').first().click();
    if(await page.locator("#ledger-list img").count())throw new Error("Stored Ledger HTML injection rendered an image");
    if(await page.evaluate(()=>window.__xss))throw new Error("Stored Ledger HTML injection executed");
    await page.setViewportSize({width:375,height:812});
    await page.locator(".nav-hamburger").click();
    await page.locator('#mobile-menu button[onclick="showPanel(\\'mission\\');toggleMenu()"]').click();
    if(!await page.locator("#panel-mission").evaluate(el=>el.classList.contains("active")))throw new Error("Mobile mission navigation failed");
    console.log(JSON.stringify({result:"PASS",checks,proof_pack:download.suggestedFilename(),completed:true,resumed:true,mobile_navigation:true,stored_xss_blocked:true,network_execution:"real HTTPS",database:"in-memory fixture"}));
  }finally{await browser.close();}
}
main().catch(error=>{console.error("SMOKE FAIL",error.stack);process.exitCode=1;}).finally(()=>server.close());
