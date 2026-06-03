import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !key || !url.startsWith("http")) {
    // Silently disabled — game works fine on polling fallback
    return null;
  }

  try {
    _supabase = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
    return _supabase;
  } catch (err) {
    console.warn("[Supabase] Failed to initialize client:", err);
    return null;
  }
}

// Export a getter, not a live instance — safe to call even when env vars are missing
export { getSupabaseClient };

// Also export a null-safe instance for backward compat with existing imports
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      // Return no-op functions so callers don't crash
      if (prop === "channel") return () => ({
        on: () => ({ subscribe: () => ({}) }),
        subscribe: () => ({}),
      });
      if (prop === "removeChannel") return () => Promise.resolve("ok");
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (client as unknown as Record<string | symbol, unknown>)[prop as string];
  },
});
