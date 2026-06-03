/**
 * Phase 9: Intensity Tier System
 * Three levels of content intensity for AI4U Party Wheel
 */

export type IntensityTier = "house_party" | "after_dark" | "chaos_mode";

export const INTENSITY_TIERS = {
  house_party: {
    label: "House Party",
    description: "PG-13 friendly content",
    emoji: "🎉",
    color: "#06b6d4", // cyan
    systemPrompt: "Generate family-friendly, humorous party game content. Keep it light, funny, and appropriate for all ages.",
  },
  after_dark: {
    label: "After Dark",
    description: "Strong innuendo & adult humor",
    emoji: "🌙",
    color: "#a855f7", // purple
    systemPrompt: "Generate witty, suggestive party game content with adult humor and innuendo. Keep it clever and entertaining without being explicit.",
  },
  chaos_mode: {
    label: "Chaos Mode",
    description: "Maximum spice & unpredictability",
    emoji: "🔥",
    color: "#ef4444", // red
    systemPrompt: "Generate wild, outrageous, and maximally entertaining party game content. Push boundaries with absurdist humor and chaos.",
  },
} as const;

export const DEFAULT_INTENSITY: IntensityTier = "house_party";

/**
 * Get system prompt for LLM based on intensity tier
 */
export function getIntensitySystemPrompt(intensity: IntensityTier): string {
  return INTENSITY_TIERS[intensity].systemPrompt;
}

/**
 * Get display info for intensity tier
 */
export function getIntensityInfo(intensity: IntensityTier) {
  return INTENSITY_TIERS[intensity];
}

/**
 * Validate intensity tier
 */
export function isValidIntensity(value: unknown): value is IntensityTier {
  return value === "house_party" || value === "after_dark" || value === "chaos_mode";
}
