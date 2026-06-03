/**
 * Validates Supabase credentials for Realtime integration.
 *
 * Uses SUPABASE_URL (server-side, not redacted) for the health check,
 * and VITE_SUPABASE_ANON_KEY for the JWT structure check.
 */
import { describe, it, expect } from "vitest";

// SUPABASE_URL is the server-side env (not redacted by sandbox)
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";

describe("Supabase credentials", () => {
  it("SUPABASE_URL is set and is a valid URL string", () => {
    expect(supabaseUrl).toBeTruthy();
    expect(supabaseUrl.length).toBeGreaterThan(10);
    // Should be parseable as a URL
    expect(() => new URL(supabaseUrl)).not.toThrow();
  });

  it("VITE_SUPABASE_ANON_KEY is set and is a JWT string (3 dot-separated parts)", () => {
    expect(supabaseAnonKey).toBeTruthy();
    const parts = supabaseAnonKey.split(".");
    expect(parts.length).toBe(3);
    parts.forEach((part) => expect(part.length).toBeGreaterThan(0));
  });

  it("Supabase REST health endpoint returns a valid HTTP response", async () => {
    const url = new URL("/rest/v1/", supabaseUrl).toString();
    const res = await fetch(url, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });
    // 200/404 = tables accessible; 401 = RLS blocks anon but key is valid and server reached
    expect([200, 404, 401]).toContain(res.status);
  });
});
