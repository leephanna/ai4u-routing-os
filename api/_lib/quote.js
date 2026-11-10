const STAGE_POINTS = {
  idea: 0, prototype: 1, proof: 1, broken: 3,
  production: 3, automation: 3, agent: 3, business: 2
};
const RISK_POINTS = { low: 0, medium: 1, high: 3, critical: 5 };
const PRICE_CENTS = { basic: 199, standard: 299, advanced: 499 };

function computeTaskQuote(input, freeTaskAvailable) {
  const goal = String(input.goal || "").trim();
  const stage = String(input.stage || "idea");
  const risk = String(input.risk || "medium");
  const output = String(input.output || "");
  if (!goal) throw new Error("Enter your task before requesting an estimate.");
  if (goal.length > 2000) throw new Error("Please shorten the task description to 2,000 characters or fewer.");
  if (!(stage in STAGE_POINTS) || !(risk in RISK_POINTS)) {
    throw new Error("Select a valid task stage and risk level.");
  }

  let score = STAGE_POINTS[stage] + RISK_POINTS[risk];
  if (goal.length > 800) score += 2;
  else if (goal.length > 300) score += 1;
  if (/\b(end.to.end|multi.?step|multiple|several|integrat\\w*|migrat\\w*|automate\\w*|debug\\w*|troubleshoot\\w*|deploy\\w*|workflow|agent|database|authentication|api)\b/i.test(goal)) score += 1;
  const outputs = output.split(/[;,]/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (outputs.length > 2) score += 1;

  const freeEligible = freeTaskAvailable &&
    score <= 2 &&
    (risk === "low" || risk === "medium") &&
    ["idea", "prototype", "proof"].includes(stage);

  const tier = score <= 2 ? "basic" : score <= 4 ? "standard" : "advanced";
  return {
    complexity_score: score,
    tier,
    amount_cents: freeEligible ? 0 : PRICE_CENTS[tier],
    free_eligible: freeEligible,
    estimated_cost_cents: 5,
    currency: "usd"
  };
}
module.exports = { computeTaskQuote, PRICE_CENTS };