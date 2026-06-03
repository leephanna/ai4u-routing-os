import { useEffect, useRef, useMemo } from "react";
import { buildWheelSegments, SEGMENT_COLORS, type WheelSegment } from "../../../shared/gameTypes";

interface WheelSVGProps {
  rotation: number; // current rotation in radians
  isSpinning: boolean;
  size?: number;
  highlightSegmentIndex?: number | null;
  onSegmentLand?: (segmentIndex: number) => void;
}

const SEGMENTS = buildWheelSegments();
const SEGMENT_COUNT = SEGMENTS.length;
const ANGLE_PER_SEGMENT = (2 * Math.PI) / SEGMENT_COUNT;

function polarToXY(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

function buildSegmentPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToXY(cx, cy, r, startAngle);
  const end = polarToXY(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function buildArcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToXY(cx, cy, r, startAngle);
  const end = polarToXY(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function adjustBrightness(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `rgb(${clamp(r + amount)},${clamp(g + amount)},${clamp(b + amount)})`;
}

// Short icon/label for each segment type (fits on small wedges)
const SEGMENT_SHORT: Record<string, string> = {
  braincell_check: "🧠",
  prompt_duel: "⚔",
  truth_cache: "💬",
  glitch_dare: "🎯",
  firewall_bonus: "🛡",
  robot_slapdown: "🤖",
  holo_drama: "🎭",
  crowd_override: "👥",
  system_crash: "💥",
};

const SEGMENT_SHORT_TEXT: Record<string, string> = {
  braincell_check: "BRAIN",
  prompt_duel: "DUEL",
  truth_cache: "TRUTH",
  glitch_dare: "DARE",
  firewall_bonus: "BONUS",
  robot_slapdown: "ROBOT",
  holo_drama: "DRAMA",
  crowd_override: "CROWD",
  system_crash: "CRASH",
};

export default function WheelSVG({
  rotation,
  isSpinning,
  size = 320,
  highlightSegmentIndex,
  onSegmentLand,
}: WheelSVGProps) {
  const lastSegmentRef = useRef<number>(-1);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 8;
  const innerR = outerR * 0.22; // hub radius
  const textR = outerR * 0.68; // radius for text path

  // Notify segment landing
  useEffect(() => {
    if (isSpinning) return;
    const pointerAngle = -Math.PI / 2;
    const normalizedRot = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const adjustedAngle = ((pointerAngle - normalizedRot) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const segmentIndex = Math.floor(adjustedAngle / ANGLE_PER_SEGMENT) % SEGMENT_COUNT;
    if (segmentIndex !== lastSegmentRef.current) {
      lastSegmentRef.current = segmentIndex;
      onSegmentLand?.(segmentIndex);
    }
  }, [rotation, isSpinning, onSegmentLand]);

  const rotationDeg = (rotation * 180) / Math.PI;

  // Build unique path IDs for textPath
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {/* Glow ring */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          boxShadow: isSpinning
            ? "0 0 48px 16px rgba(139,92,246,0.7), 0 0 96px 32px rgba(109,40,217,0.35), 0 0 140px 48px rgba(139,92,246,0.12)"
            : "0 0 24px 8px rgba(139,92,246,0.4), 0 0 48px 16px rgba(109,40,217,0.18)",
          transition: "box-shadow 0.5s ease",
          borderRadius: "50%",
          zIndex: 0,
        }}
      />

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          filter: isSpinning
            ? "drop-shadow(0 0 18px rgba(139,92,246,0.85)) brightness(1.1)"
            : "drop-shadow(0 0 8px rgba(139,92,246,0.45))",
          transition: "filter 0.4s ease",
          position: "relative",
          zIndex: 1,
        }}
      >
        <defs>
          {/* Outer halo gradient */}
          <radialGradient id={`halo-${uid}`} cx="50%" cy="50%" r="55%">
            <stop offset="85%" stopColor="rgba(139,92,246,0)" />
            <stop offset="95%" stopColor="rgba(139,92,246,0.3)" />
            <stop offset="100%" stopColor="rgba(139,92,246,0)" />
          </radialGradient>

          {/* Hub gradient */}
          <radialGradient id={`hub-${uid}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="35%" stopColor="#7c3aed" />
            <stop offset="75%" stopColor="#4c1d95" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </radialGradient>

          {/* Chrome rim gradient */}
          <linearGradient id={`rim-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.92)" />
            <stop offset="25%" stopColor="rgba(196,181,253,0.75)" />
            <stop offset="50%" stopColor="rgba(139,92,246,1)" />
            <stop offset="75%" stopColor="rgba(196,181,253,0.75)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.92)" />
          </linearGradient>

          {/* Text arc paths — one per segment, on the outer arc */}
          {SEGMENTS.map((seg: WheelSegment, i: number) => {
            const startAngle = i * ANGLE_PER_SEGMENT - Math.PI / 2;
            const endAngle = startAngle + ANGLE_PER_SEGMENT;
            // Always go left-to-right visually
            const midAngle = startAngle + ANGLE_PER_SEGMENT / 2;
            const normalizedMid = ((midAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            const isBottom = normalizedMid > Math.PI / 2 && normalizedMid < 3 * Math.PI / 2;
            const arcPath = isBottom
              ? buildArcPath(cx, cy, textR, endAngle, startAngle) // reversed for bottom half
              : buildArcPath(cx, cy, textR, startAngle, endAngle);
            return (
              <path
                key={i}
                id={`tp-${uid}-${i}`}
                d={arcPath}
                fill="none"
              />
            );
          })}
        </defs>

        {/* Wheel group — rotates */}
        <g
          transform={`rotate(${rotationDeg}, ${cx}, ${cy})`}
          style={{ transition: isSpinning ? "none" : undefined }}
        >
          {/* Halo */}
          <circle cx={cx} cy={cy} r={outerR + 16} fill={`url(#halo-${uid})`} />

          {/* Segments */}
          {SEGMENTS.map((seg: WheelSegment, i: number) => {
            const startAngle = i * ANGLE_PER_SEGMENT - Math.PI / 2;
            const endAngle = startAngle + ANGLE_PER_SEGMENT;
            const isHighlighted = highlightSegmentIndex === i;
            const fillColor = i % 2 === 0 ? seg.color : adjustBrightness(seg.color, -22);
            const highlightFill = isHighlighted ? "rgba(255,255,255,0.25)" : "none";

            // Midpoint for icon placement
            const midAngle = startAngle + ANGLE_PER_SEGMENT / 2;
            const iconR = outerR * 0.82;
            const iconX = cx + iconR * Math.cos(midAngle);
            const iconY = cy + iconR * Math.sin(midAngle);
            const shortText = SEGMENT_SHORT_TEXT[seg.type] ?? seg.label.slice(0, 5).toUpperCase();

            return (
              <g key={i}>
                {/* Segment wedge */}
                <path
                  d={buildSegmentPath(cx, cy, outerR, startAngle, endAngle)}
                  fill={fillColor}
                  stroke="rgba(0,0,0,0.45)"
                  strokeWidth={1.5}
                />
                {/* Highlight overlay */}
                {isHighlighted && (
                  <path
                    d={buildSegmentPath(cx, cy, outerR, startAngle, endAngle)}
                    fill={highlightFill}
                    stroke="rgba(255,255,255,0.6)"
                    strokeWidth={2}
                  />
                )}
                {/* Tick mark at outer rim */}
                <line
                  x1={cx + (outerR - 8) * Math.cos(startAngle)}
                  y1={cy + (outerR - 8) * Math.sin(startAngle)}
                  x2={cx + outerR * Math.cos(startAngle)}
                  y2={cy + outerR * Math.sin(startAngle)}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* Text labels via textPath — follow arc around each segment */}
          {SEGMENTS.map((seg: WheelSegment, i: number) => {
            const startAngle = i * ANGLE_PER_SEGMENT - Math.PI / 2;
            const endAngle = startAngle + ANGLE_PER_SEGMENT;
            const midAngle = startAngle + ANGLE_PER_SEGMENT / 2;
            const normalizedMid = ((midAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            const isBottom = normalizedMid > Math.PI / 2 && normalizedMid < 3 * Math.PI / 2;
            const arcPath = isBottom
              ? buildArcPath(cx, cy, textR, endAngle, startAngle)
              : buildArcPath(cx, cy, textR, startAngle, endAngle);
            const shortText = SEGMENT_SHORT_TEXT[seg.type] ?? seg.label.slice(0, 5).toUpperCase();
            const fontSize = Math.max(6, Math.round(size / 47));

            return (
              <text
                key={i}
                fontSize={fontSize}
                fontFamily="'Orbitron', sans-serif"
                fontWeight="bold"
                fill="rgba(255,255,255,0.95)"
                style={{ textShadow: "0 0 4px rgba(0,0,0,0.9)" }}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                <textPath
                  href={`#tp-${uid}-${i}`}
                  startOffset="50%"
                >
                  {shortText}
                </textPath>
              </text>
            );
          })}

          {/* Chrome outer rim */}
          <circle
            cx={cx} cy={cy} r={outerR + 3}
            fill="none"
            stroke={`url(#rim-${uid})`}
            strokeWidth={5}
          />
          <circle
            cx={cx} cy={cy} r={outerR + 0.5}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1.5}
          />

          {/* Hub */}
          <circle cx={cx} cy={cy} r={innerR * 1.4} fill={`url(#hub-${uid})`} />
          <circle cx={cx} cy={cy} r={innerR * 1.4} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="rgba(196,181,253,0.5)" strokeWidth={1} />
          <text
            x={cx} y={cy + 1}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.max(7, Math.round(size * 0.028))}
            fontFamily="'Orbitron', sans-serif"
            fontWeight="bold"
            fill="rgba(255,255,255,0.95)"
            style={{ userSelect: "none" }}
          >
            AI4U
          </text>
        </g>

        {/* Pointer — does NOT rotate with wheel */}
        <g>
          {/* Pointer glow */}
          <polygon
            points={`${cx - 14},6 ${cx + 14},6 ${cx},${28 + outerR * 0.06}`}
            fill="none"
            stroke="rgba(139,92,246,0.7)"
            strokeWidth={8}
            strokeLinejoin="round"
            style={{ filter: "blur(4px)" }}
          />
          {/* Pointer body */}
          <polygon
            points={`${cx - 12},5 ${cx + 12},5 ${cx},${26 + outerR * 0.05}`}
            fill="#ffffff"
            stroke="rgba(139,92,246,0.9)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {/* Pointer highlight */}
          <polygon
            points={`${cx - 7},5 ${cx},9 ${cx - 7},${16}`}
            fill="rgba(255,255,255,0.45)"
          />
        </g>
      </svg>
    </div>
  );
}
