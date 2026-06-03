import { useEffect, useState } from "react";

interface PointerCloseupProps {
  segmentType: string | null;
  segmentLabel: string | null;
  segmentColor: string;
  visible: boolean;
}

const POINTER_KEYFRAMES = `
@keyframes pointerSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes pointerTick {
  0%, 100% { transform: rotate(0deg) scaleY(1); }
  50%       { transform: rotate(6deg) scaleY(1.08); }
}
@keyframes pCloseupFadeIn {
  from { opacity: 0; transform: scale(1.08); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes pCloseupFadeOut {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.92); }
}
@keyframes labelReveal {
  0%   { opacity: 0; transform: translateY(20px) scale(0.85); }
  60%  { opacity: 1; transform: translateY(-4px) scale(1.05); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes rimRotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(-360deg); }
}
@keyframes tickMarkPulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 1; }
}
`;

let pointerKFInjected = false;
function injectPointerKeyframes() {
  if (pointerKFInjected) return;
  pointerKFInjected = true;
  const s = document.createElement("style");
  s.textContent = POINTER_KEYFRAMES;
  document.head.appendChild(s);
}

// Generate tick marks around the circle
function TickMarks({ color }: { color: string }) {
  const ticks = Array.from({ length: 24 }, (_, i) => i);
  return (
    <svg
      viewBox="0 0 200 200"
      className="absolute inset-0 w-full h-full"
      style={{ animation: "rimRotate 8s linear infinite" }}
    >
      {ticks.map((i) => {
        const angle = (i / 24) * 360;
        const rad = (angle * Math.PI) / 180;
        const isMajor = i % 6 === 0;
        const r1 = isMajor ? 82 : 86;
        const r2 = 92;
        const x1 = 100 + r1 * Math.sin(rad);
        const y1 = 100 - r1 * Math.cos(rad);
        const x2 = 100 + r2 * Math.sin(rad);
        const y2 = 100 - r2 * Math.cos(rad);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={isMajor ? 3 : 1.5}
            strokeOpacity={isMajor ? 0.9 : 0.45}
          />
        );
      })}
    </svg>
  );
}

export default function PointerCloseup({
  segmentType,
  segmentLabel,
  segmentColor,
  visible,
}: PointerCloseupProps) {
  useEffect(() => { injectPointerKeyframes(); }, []);

  // Track whether we've started fading out (after 3 seconds)
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (!visible) {
      setFadingOut(false);
      return;
    }
    setFadingOut(false);
    const t = setTimeout(() => setFadingOut(true), 3000);
    return () => clearTimeout(t);
  }, [visible, segmentType]);

  if (!visible && !fadingOut) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: `radial-gradient(ellipse at center, ${segmentColor}22 0%, rgba(0,0,0,0.88) 70%)`,
        animation: fadingOut ? "pCloseupFadeOut 0.5s ease-in forwards" : "pCloseupFadeIn 0.4s ease-out both",
      }}
    >
      {/* Pointer dial */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: "240px", height: "240px" }}
      >
        {/* Outer rim */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `3px solid ${segmentColor}`,
            boxShadow: `0 0 20px ${segmentColor}, 0 0 50px ${segmentColor}55, inset 0 0 30px rgba(0,0,0,0.5)`,
          }}
        />

        {/* Tick marks */}
        <TickMarks color={segmentColor} />

        {/* Inner dark circle */}
        <div
          className="absolute rounded-full"
          style={{
            inset: "16px",
            background: "radial-gradient(ellipse at 40% 35%, rgba(30,0,60,0.9) 0%, rgba(0,0,0,0.97) 100%)",
            border: `1px solid ${segmentColor}44`,
          }}
        />

        {/* Pointer needle */}
        <div
          className="absolute"
          style={{
            width: "8px",
            height: "80px",
            bottom: "50%",
            left: "calc(50% - 4px)",
            transformOrigin: "bottom center",
            animation: "pointerTick 0.18s ease-in-out infinite",
          }}
        >
          {/* Needle body */}
          <div
            className="w-full rounded-t-full"
            style={{
              height: "68px",
              background: `linear-gradient(to top, ${segmentColor}, #fff)`,
              boxShadow: `0 0 10px ${segmentColor}, 0 0 20px ${segmentColor}88`,
            }}
          />
          {/* Needle tip */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderBottom: `12px solid ${segmentColor}`,
              filter: `drop-shadow(0 0 6px ${segmentColor})`,
            }}
          />
        </div>

        {/* Center pivot dot */}
        <div
          className="absolute rounded-full z-10"
          style={{
            width: "18px",
            height: "18px",
            background: `radial-gradient(circle, #fff 30%, ${segmentColor} 100%)`,
            boxShadow: `0 0 12px ${segmentColor}, 0 0 24px ${segmentColor}`,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      {/* Segment label */}
      <div
        className="mt-8 text-center px-6"
        style={{ animation: "labelReveal 0.6s cubic-bezier(0.22,1,0.36,1) 0.2s both" }}
      >
        <div
          className="text-xs font-black tracking-widest uppercase mb-2"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            color: `${segmentColor}cc`,
            textShadow: `0 0 10px ${segmentColor}`,
          }}
        >
          Landing on...
        </div>
        <div
          className="text-3xl font-black tracking-wider uppercase"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            color: "#fff",
            textShadow: `0 0 16px ${segmentColor}, 0 0 32px ${segmentColor}88`,
            WebkitTextStroke: `1px ${segmentColor}`,
          }}
        >
          {segmentLabel ?? segmentType?.replace(/_/g, " ") ?? "—"}
        </div>
      </div>
    </div>
  );
}
