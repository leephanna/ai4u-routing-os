import { useEffect } from "react";

interface ChallengeBoardProps {
  content: string | null;
  segmentType: string | null;
  segmentLabel: string | null;
  segmentEmoji: string;
  segmentColor: string;
  activePlayerName: string;
}

const CHALLENGE_KEYFRAMES = `
@keyframes challengeCardIn {
  from { opacity: 0; transform: translateY(24px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes glitchBorder {
  0%, 96%, 100% {
    box-shadow: 0 0 18px var(--cbc), 0 0 40px var(--cbc2), 0 4px 40px rgba(0,0,0,0.6);
  }
  97% {
    box-shadow: 3px 0 18px var(--cbc), -3px 0 18px #00ffff55, 0 4px 40px rgba(0,0,0,0.6);
  }
  98.5% {
    box-shadow: -2px 0 18px var(--cbc), 2px 0 10px #ff00ff55, 0 4px 40px rgba(0,0,0,0.6);
  }
}
@keyframes activePlayerGlow {
  0%, 100% { text-shadow: 0 0 8px #ff40c0, 0 0 16px #ff40c088; }
  50%       { text-shadow: 0 0 16px #ff40c0, 0 0 32px #ff40c0, 0 0 48px #ff40c066; }
}
@keyframes contentFadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

let challengeKFInjected = false;
function injectChallengeKeyframes() {
  if (challengeKFInjected) return;
  challengeKFInjected = true;
  const s = document.createElement("style");
  s.textContent = CHALLENGE_KEYFRAMES;
  document.head.appendChild(s);
}

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(168,0,255,${alpha})`;
  return `rgba(${parseInt(result[1]!, 16)},${parseInt(result[2]!, 16)},${parseInt(result[3]!, 16)},${alpha})`;
}

export default function ChallengeBoard({
  content,
  segmentType,
  segmentLabel,
  segmentEmoji,
  segmentColor,
  activePlayerName,
}: ChallengeBoardProps) {
  useEffect(() => { injectChallengeKeyframes(); }, []);

  const colorDim = hexToRgba(segmentColor, 0.45);
  const colorFaint = hexToRgba(segmentColor, 0.12);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center p-4"
      style={{ animation: "challengeCardIn 0.5s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${colorFaint} 0%, rgba(4,0,16,0.96) 80%)`,
          border: `1.5px solid ${colorDim}`,
          // @ts-expect-error – CSS custom properties are valid
          "--cbc": colorDim,
          "--cbc2": hexToRgba(segmentColor, 0.2),
          animation: "glitchBorder 5s ease-in-out infinite",
          fontFamily: "'Orbitron', sans-serif",
        }}
      >
        {/* Top accent bar */}
        <div
          className="w-full h-1"
          style={{
            background: `linear-gradient(90deg, transparent, ${segmentColor}, transparent)`,
            boxShadow: `0 0 16px ${segmentColor}`,
          }}
        />

        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 pt-5 pb-3"
          style={{ borderBottom: `1px solid ${colorFaint}` }}
        >
          <span className="text-4xl leading-none">{segmentEmoji}</span>
          <div>
            <div
              className="text-xs tracking-widest uppercase"
              style={{ color: hexToRgba(segmentColor, 0.7) }}
            >
              Challenge
            </div>
            <div
              className="text-xl font-black uppercase tracking-wide"
              style={{
                color: segmentColor,
                textShadow: `0 0 12px ${segmentColor}`,
              }}
            >
              {segmentLabel ?? segmentType?.replace(/_/g, " ") ?? "—"}
            </div>
          </div>
        </div>

        {/* Active player banner */}
        <div
          className="flex items-center gap-2 px-6 py-2.5"
          style={{
            background: "rgba(255,20,160,0.08)",
            borderBottom: `1px solid ${colorFaint}`,
          }}
        >
          <span className="text-sm">🎯</span>
          <span
            className="text-[11px] tracking-widest uppercase"
            style={{ color: "rgba(255,100,180,0.7)" }}
          >
            Active Player:
          </span>
          <span
            className="text-sm font-black"
            style={{
              color: "#ff40c0",
              animation: "activePlayerGlow 2s ease-in-out infinite",
            }}
          >
            {activePlayerName}
          </span>
        </div>

        {/* Challenge content */}
        <div
          className="px-6 py-8"
          style={{ animation: "contentFadeIn 0.6s ease-out 0.2s both" }}
        >
          {content ? (
            <p
              className="text-xl font-bold leading-relaxed text-center"
              style={{
                color: "#f0e8ff",
                textShadow: "0 1px 8px rgba(0,0,0,0.8)",
                lineHeight: "1.65",
              }}
            >
              {content}
            </p>
          ) : (
            <div className="flex items-center justify-center gap-3 py-4">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: segmentColor,
                  boxShadow: `0 0 8px ${segmentColor}`,
                  animation: "activePlayerGlow 0.6s ease-in-out infinite",
                }}
              />
              <span
                className="text-sm tracking-widest uppercase"
                style={{ color: "rgba(180,100,240,0.6)" }}
              >
                Loading challenge...
              </span>
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: segmentColor,
                  boxShadow: `0 0 8px ${segmentColor}`,
                  animation: "activePlayerGlow 0.6s ease-in-out 0.3s infinite",
                }}
              />
            </div>
          )}
        </div>

        {/* Bottom accent bar */}
        <div
          className="w-full h-1"
          style={{
            background: `linear-gradient(90deg, transparent, ${segmentColor}, transparent)`,
            boxShadow: `0 0 16px ${segmentColor}`,
            opacity: 0.5,
          }}
        />

        {/* Subtle inner corner decorations */}
        {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos) => (
          <div
            key={pos}
            className={`absolute ${pos} w-5 h-5 pointer-events-none`}
            style={{
              borderColor: `${segmentColor}55`,
              borderStyle: "solid",
              borderWidth: pos.includes("top") && pos.includes("left")
                ? "2px 0 0 2px"
                : pos.includes("top") && pos.includes("right")
                ? "2px 2px 0 0"
                : pos.includes("bottom") && pos.includes("left")
                ? "0 0 2px 2px"
                : "0 2px 2px 0",
            }}
          />
        ))}
      </div>
    </div>
  );
}
