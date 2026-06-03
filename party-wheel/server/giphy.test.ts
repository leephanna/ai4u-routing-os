import { describe, it, expect } from "vitest";

/**
 * Validates the VITE_GIPHY_API_KEY by calling the Giphy search endpoint.
 * A 200 response with a data array confirms the key is valid.
 */
describe("Giphy API key validation", () => {
  it("should return GIFs for a search query using VITE_GIPHY_API_KEY", async () => {
    const apiKey = process.env.VITE_GIPHY_API_KEY;
    expect(apiKey, "VITE_GIPHY_API_KEY must be set").toBeTruthy();
    expect(apiKey!.length, "API key should be at least 20 chars").toBeGreaterThan(20);

    const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=reaction&limit=1&rating=r`;
    const res = await fetch(url);
    expect(res.status, `Giphy API returned ${res.status}`).toBe(200);

    const json = await res.json() as { data: unknown[] };
    expect(Array.isArray(json.data), "Response should have a data array").toBe(true);
    expect(json.data.length, "Should return at least 1 GIF").toBeGreaterThan(0);
  }, 10000);
});
