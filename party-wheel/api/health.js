// Independent health check — does NOT import the main Express app,
// database, Supabase, OAuth, or any LLM module.
export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    service: "ai4u-party-wheel",
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    timestamp: new Date().toISOString(),
  });
}
