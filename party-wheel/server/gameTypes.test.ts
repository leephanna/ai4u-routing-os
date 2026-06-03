import { describe, it, expect } from "vitest";
import {
  buildWheelSegments,
  SEGMENT_LABELS,
  SEGMENT_COLORS,
  SEGMENT_POINTS,
  INTENSITY_LABELS,
} from "../shared/gameTypes";

describe("buildWheelSegments", () => {
  it("returns 43 segments", () => {
    const segments = buildWheelSegments();
    expect(segments.length).toBe(43);
  });

  it("all 9 segment types are present", () => {
    const segments = buildWheelSegments();
    const types = new Set(segments.map((s) => s.type));
    expect(types.size).toBe(9);
    expect(types.has("braincell_check")).toBe(true);
    expect(types.has("prompt_duel")).toBe(true);
    expect(types.has("truth_cache")).toBe(true);
    expect(types.has("glitch_dare")).toBe(true);
    expect(types.has("firewall_bonus")).toBe(true);
    expect(types.has("robot_slapdown")).toBe(true);
    expect(types.has("holo_drama")).toBe(true);
    expect(types.has("crowd_override")).toBe(true);
    expect(types.has("system_crash")).toBe(true);
  });

  it("each segment has a valid angle, label, color, and points", () => {
    const segments = buildWheelSegments();
    for (const seg of segments) {
      expect(seg.angle).toBeGreaterThanOrEqual(0);
      expect(seg.label).toBeTruthy();
      expect(seg.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(typeof seg.points).toBe("number");
    }
  });

  it("angles are evenly distributed", () => {
    const segments = buildWheelSegments();
    const expectedAngle = (2 * Math.PI) / 43;
    for (let i = 0; i < segments.length; i++) {
      expect(segments[i]!.angle).toBeCloseTo(i * expectedAngle, 5);
    }
  });
});

describe("SEGMENT_LABELS", () => {
  it("has correct human-readable labels", () => {
    expect(SEGMENT_LABELS.braincell_check).toBe("Braincell Check");
    expect(SEGMENT_LABELS.prompt_duel).toBe("Prompt Duel");
    expect(SEGMENT_LABELS.truth_cache).toBe("Truth Cache");
    expect(SEGMENT_LABELS.glitch_dare).toBe("Glitch Dare");
    expect(SEGMENT_LABELS.firewall_bonus).toBe("Firewall Bonus");
    expect(SEGMENT_LABELS.robot_slapdown).toBe("Robot Slapdown");
    expect(SEGMENT_LABELS.holo_drama).toBe("Holo-Drama");
    expect(SEGMENT_LABELS.crowd_override).toBe("Crowd Override");
    expect(SEGMENT_LABELS.system_crash).toBe("System Crash");
  });
});

describe("SEGMENT_POINTS", () => {
  it("punishment segments have negative points", () => {
    expect(SEGMENT_POINTS.robot_slapdown).toBeLessThan(0);
    expect(SEGMENT_POINTS.system_crash).toBeLessThan(0);
  });

  it("bonus segments have positive points", () => {
    expect(SEGMENT_POINTS.firewall_bonus).toBeGreaterThan(0);
    expect(SEGMENT_POINTS.braincell_check).toBeGreaterThan(0);
  });
});

describe("INTENSITY_LABELS", () => {
  it("has correct labels", () => {
    expect(INTENSITY_LABELS.house_party).toBe("House Party");
    expect(INTENSITY_LABELS.after_dark).toBe("After Dark");
    expect(INTENSITY_LABELS.chaos_mode).toBe("Chaos Mode");
  });
});
