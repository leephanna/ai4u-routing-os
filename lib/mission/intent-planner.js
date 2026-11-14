"use strict";
// AI4U P1: explainable, bounded intent optimization. Pure planning only; no tools, charges or execution.
const MAX_GOAL=4000;
const REQUIRES_APPROVAL=["payment","purchase","delete","publish","deploy","email","send","share","transfer"];
const EXECUTABLE_WEBSITE=/\b(check|audit|test|verify|inspect|readiness)\b/i;
const WEBSITE=/\b(site|website|homepage|webpage|url|domain)\b/i;
function clean(value,limit=1000){return typeof value==="string"?value.trim().replace(/\s+/g," ").slice(0,limit):"";}
function normalizeList(values){return Array.isArray(values)?values.map(x=>clean(x,400)).filter(Boolean).slice(0,12):[];}
function detectWebsite(goal){return WEBSITE.test(goal)||/https:\/\//i.test(goal);}
function extractUrl(goal){const hit=goal.match(/https:\/\/[^\s<>\"']+/i);if(!hit)return null;try{return new URL(hit[0].replace(/[.,;!?]+$/,"")).href;}catch{return null;}}
function typedStep(id,title,action,acceptance,mode="guide",approval=false){
 return {id,title,mode,action,acceptance_criteria:acceptance,requires_approval:approval,status:"not_started"};
}
// Remove only exact AI4U-generated helper clauses from new suggestions.
// The original user goal remains unchanged for accountability and recovery.
function proposalCore(original){
 let core=original;
 const canned=[
  /\\bCopy prompt\\.\\s*/gi,
  /\\bIdentify the most efficient practical route and return a verifiable result\\.\\s*/gi,
  /\\bRespect my constraints and clearly identify any assumptions\\.\\s*/gi,
  /\\bAsk before irreversible actions\\.\\s*/gi,
  /\\bRecommend a cost-effective route, define a usable deliverable, and verify it with evidence\\.\\s*/gi,
  /\\bCheck the public HTTPS homepage, record the five scoped checks, and state what was not tested\\.\\s*/gi
 ];
 for(const expression of canned)core=core.replace(expression,"");
 return core.replace(/\\s+/g," ").trim().replace(/[.!?]+$/,"")||original;
}
function planMission(request){
 if(!request||typeof request!=="object"||Array.isArray(request))throw new TypeError("Mission request must be an object");
 const goal=clean(request.goal,MAX_GOAL),constraints=normalizeList(request.constraints),
 budget=clean(request.budget,100),acceptance=normalizeList(request.acceptance_criteria||request.acceptanceCriteria);
 if(!goal)return {schema:"ai4u.mission.intent-plan.v1",status:"needs_clarification",inferred_intent:null,clarification:{question:"What would you like to accomplish?",options:["I want to check whether my website is reachable.","I want a step-by-step plan for launching a website.","I want to compare the best tools for my project."]},alternatives:[],steps:[],assumptions:[],execution_allowed:false};
 const isWebsite=detectWebsite(goal),isAudit=isWebsite&&EXECUTABLE_WEBSITE.test(goal),url=extractUrl(goal);
 const ambiguous=goal.length<18||!(/\s/.test(goal))||/^(help|fix|improve|build|make|do|start|website|app|business|something|it|this)(\s+(me|this|it))?[.!?]?$/i.test(goal);
 const risky=REQUIRES_APPROVAL.filter(x=>new RegExp("\\b"+x+"\\b","i").test(goal));
 const category=isAudit?"website_readiness":isWebsite?"website_project":"general_project";
 const assumptions=[];
 if(isWebsite&&!url)assumptions.push({statement:"A website-related task is intended; no target URL was supplied.",confirmed:false});
 if(!acceptance.length)assumptions.push({statement:"The user has not defined measurable success criteria.",confirmed:false});
 const core=proposalCore(goal);
 const statedGoal=/^(?:I\b|My\b)/i.test(core)?core:"I want to "+core.charAt(0).toLowerCase()+core.slice(1);
 const improved=statedGoal+". "+(category==="website_readiness"?"Check the public HTTPS homepage, record the five scoped checks, and state what was not tested.":category==="website_project"?"Recommend a cost-effective route, define a usable deliverable, and verify it with evidence.":"Identify the most efficient practical route and return a verifiable result.")+" Respect my constraints"+(constraints.length?": "+constraints.join("; "):" and clearly identify any assumptions")+". "+(budget?"Stay within budget: "+budget+". ":"")+"Ask before irreversible actions.";
 const alternatives=[
 {id:"recommended",label:"Recommended — Most effective",prompt:improved,tradeoff:"More specific; includes proof and permission requirements."},
 {id:"fast",label:"Fastest useful outcome",prompt:"My goal is: "+goal+". Find the smallest safe next action that creates a testable result. Explain what will remain unfinished.",tradeoff:"Faster, but narrower scope."},
 {id:"thorough",label:"Most thorough",prompt:"My goal is: "+goal+". Compare at least two feasible approaches by effort, cost, risks, accessibility, and evidence of success. Recommend one and explain the tradeoffs.",tradeoff:"More evaluation effort before execution."}
 ];
 let clarification=null;
 if(ambiguous)clarification={question:"Which outcome best matches what you want?",options:[goal+" — give me a plan",goal+" — help me create a working result",goal+" — compare the best approaches first"]};
 else if(isAudit&&!url)clarification={question:"Which public HTTPS homepage should I check?",options:["https://example.com/ (replace with my homepage address)","I need help finding my website's homepage URL","Compare website readiness test types first"]};
 const steps=[
 typedStep("understand","Confirm intended outcome","Review inferred intent, assumptions, optimized wording, and alternatives.","The user can identify or correct the intended outcome."),
 typedStep("choose","Select the optimal route","Compare feasible paths and explain speed, quality, cost, and risk tradeoffs.","A preferred route and its limitations are recorded."),
 typedStep("approve","Authorize gated actions","Obtain explicit user authorization before payments, publication, deletion, sending, or external changes.","Approval is recorded before any restricted action.","human",true),
 typedStep("verify","Verify the result","Run evidence-based acceptance checks appropriate to the chosen route.","The result meets stated acceptance criteria, or unresolved gaps are explicit."),
 typedStep("complete","Confirm satisfaction and preserve proof","Save the work, next steps, and applicable signed evidence before marking complete.","The user confirms satisfaction; evidence and limitations remain accessible.","human")
 ];
 if(isAudit&&url&&!clarification){
   steps.splice(2,0,typedStep("website-check","Run scoped HTTPS homepage checks","Validate target and perform the separately authorized, existing read-only website mission.","Five homepage checks produce a recorded PASS/FAIL outcome; no claims about browser or checkout readiness.","website_readiness"));
 }
 return {schema:"ai4u.mission.intent-plan.v1",status:clarification?"needs_clarification":"ready_for_review",category,original_goal:goal,inferred_intent:{summary:goal,confidence_label:ambiguous?"low":isWebsite?"medium":"unassessed",is_assumption:true},suggested_prompt:improved,alternatives,clarification,assumptions,acceptance_criteria:acceptance,risks_detected:risky,steps,execution_allowed:false,disclaimer:"Suggestions are inferred, not confirmed requirements. This object never authorizes tool execution or irreversible actions."};
}
module.exports={planMission};
