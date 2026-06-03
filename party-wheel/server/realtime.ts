/**
 * server/realtime.ts
 *
 * Server-side Supabase Realtime broadcast helper.
 * Uses the service-role key (SUPABASE_KEY) so the server can broadcast
 * without being subject to RLS policies.
 *
 * The server does NOT subscribe — it only sends. Clients subscribe via
 * the anon key in client/src/lib/supabase.ts.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
// Use service role key on server for broadcast permissions
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_KEY ??
  "";

let _client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!_client) {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[Realtime] Missing SUPABASE_URL or SUPABASE_KEY — broadcasts disabled");
      return null;
    }
    _client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

/**
 * Broadcast a room event to all subscribers on `room:{roomCode}`.
 * Fire-and-forget — never throws, logs warnings on failure.
 */
export async function broadcastRoomEvent(
  roomCode: string,
  event: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
): Promise<void> {
  const client = getClient();
  if (!client) return;

  try {
    const channel = client.channel(`room:${roomCode}`);
    await channel.send({
      type: "broadcast",
      event,
      payload,
    });
    // Clean up the ephemeral channel after sending
    await client.removeChannel(channel);
  } catch (err) {
    console.warn(`[Realtime] Broadcast failed for room:${roomCode}:`, err);
  }
}
