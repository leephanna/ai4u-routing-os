import { useEffect, useState } from "react";

interface CategoryRevealProps {
  segmentType: string | null;
  segmentLabel: string | null;
  segmentEmoji: string;
  segmentColor: string;
  visible: boolean;
}

const CATREV_KEYFRAMES = `
@keyframes catRevealBounceIn {
  0%   { transform: scale(0) rotate(-8deg); opacity: 0; }
  55%  { transform: scale(1.18) rotate(2deg); opacity: 1; }
  75%  { transform: scale(0.94) rotate(-1deg); opacity: 1; }
  90%  { transform: scale(1.04) rotate(0.5deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes catRevealFadeOut {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(1.1); }
}
@keyframes catEmojiFloat {
  0%, 100% { transform: translateY(0) scale(1); }
  50%       { transform: translateY(-12px) scale(1.1); }
}
@keyframes catTextBlink {
  0%, 90%, 100% { opacity: 1; }
  95%            { opacity: 0.4; }
}
@keyframes catBgFlash {
  0%   { opacity: 0.55; }
  15%  { opacity: 0.22; }
  30%  { opacity: 0.45; }
  50%  { opacity: 0.18; }
  100% { opacity: 0; }
}
@keyframes catSubtitleSlide {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

let catRevKFInjected = false;
function injectCatRevKeyframes() {
  if (catRevKFInjected) return;
  catRevKFInjected = true;
  const s = document.createElement("style");
  s.textContent = CATREV_KEYFRAMES;
  document.head.appendChild(s);
}

export default function CategoryReveal({
  segmentType,
  segmentLabel,
  segmentEmoji,
  segmentColor,
  visible,
}: CategoryRevealProps) {
  useEffect(() => { injectCatRevKeyframes(); }, []);

  const [fadingOut, setFadingOut] = useState(false);
  const [showBgFlash, setShowBgFlash] = useState(false);

  useEffect(() => {
    if (!visible) {
      setFadingOut(false);
      setShowBgFlash(false);
      return;
    }
    setFadingOut(false);
    setShowBgFlash(true);
    const tFlash = setTimeout(() => setShowBgFlash(false), 1200);
    return () => clearTimeout(tFlash);
  }, [visible, segmentType]);

  if (!visible && !fadingOut) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: `radial-gradient(ellipse at center, ${segmentColor}33 0%, rgba(0,0,0,0.92) 65%)`,
        animation: fadingOut
          ? "catRevealFadeOut 0.5s ease-in forwards"
          : undefined,
      }}
    >
      {/* Color flash */}
      {showBgFlash && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: segmentColor,
            animation: "catBgFlash 1.2s ease-out forwards",
          }}
        />
      )}

      {/* Main content */}
      <div
        className="relative flex flex-col items-center gap-6 px-8 text-center"
        style={{
          animation: "catRevealBounceIn 0.7s cubic-bezier(0.22,1,0.36,1) both",
        }}
      >
        {/* Emoji */}
        <div
          className="text-8xl leading-none select-none"
          style={{ animation: "catEmojiFloat 2.2s ease-in-out infinite" }}
        >
          {segmentEmoji}
        </div>

        {/* Giant neon label */}
        <div
          className="font-black uppercase tracking-wider leading-none"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: "clamp(2.2rem, 8vw, 5rem)",
            color: "#fff",
            WebkitTextStroke: `2px ${segmentColor}`,
            textShadow: `
              0 0 20px ${segmentColor},
              0 0 40px ${segmentColor}88,
              0 0 80px ${segmentColor}44
            `,
            animation: "catTextBlink 2.4s ease-in-out infinite",
          }}
        >
          {segmentLabel ?? segmentType?.replace(/_/g, " ") ?? "GO!"}
        </div>

        {/* Subtitle: segment type tag */}
        {segmentType && (
          <div
            className="px-5 py-2 rounded-full text-sm font-bold tracking-widest uppercase"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              background: `${segmentColor}22`,
              border: `1.5px solid ${segmentColor}88`,
              color: segmentColor,
              textShadow: `0 0 10px ${segmentColor}`,
              boxShadow: `0 0 20px ${segmentColor}33`,
              animation: "catSubtitleSlide 0.5s cubic-bezier(0.22,1,0.36,1) 0.35s both",
            }}
          >
            {segmentType.replace(/_/g, " ")}
          </div>
        )}
      </div>

      {/* Decorative corner rays */}
      {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos) => (
        <div
          key={pos}
          className={`absolute ${pos} w-32 h-32 pointer-events-none`}
          style={{
            background: `radial-gradient(ellipse at ${pos.includes("right") ? "100% " : "0% "}${pos.includes("bottom") ? "100%" : "0%"}, ${segmentColor}22 0%, transparent 70%)`,
          }}
        />
      ))}
    </div>
  );
}
