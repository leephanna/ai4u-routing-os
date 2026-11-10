async function requireUser(req) {
  const authorization = req.headers.authorization || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    const error = new Error("Sign in to continue.");
    error.status = 401;
    throw error;
  }
  const baseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !publicKey) throw new Error("Router account authentication is not configured.");
  const response = await fetch(baseUrl.replace(/\/$/, "") + "/auth/v1/user", {
    method: "GET",
    headers: { apikey: publicKey, Authorization: authorization }
  });
  if (!response.ok) {
    const error = new Error("Your sign-in session expired. Please sign in again.");
    error.status = 401;
    throw error;
  }
  const user = await response.json();
  if (!user || !user.id || !user.email) {
    const error = new Error("A verified email sign-in is required.");
    error.status = 401;
    throw error;
  }
  return { id: user.id, email: user.email };
}
module.exports = { requireUser };