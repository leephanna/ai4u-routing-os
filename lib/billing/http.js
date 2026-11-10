function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}
function method(req, allowed) {
  if (req.method !== allowed) {
    send(req.res || {}, 405, { error: "Method not allowed" });
    return false;
  }
  return true;
}
async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
function fail(res, error) {
  const status = Number(error && error.status) || 500;
  send(res, status, { error: status >= 500 ? "The billing service could not complete that request." : error.message });
}
module.exports = { send, readJson, fail };