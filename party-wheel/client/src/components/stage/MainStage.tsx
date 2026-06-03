import { ReactNode } from "react";

interface MainStageProps {
  phase: string;
  children: ReactNode;
  segmentType?: string | null;
  segmentColor?: string;
}

const SPINNING_PHASES = new Set(["spinning", "spin_preview", "landing", "landing_closeup"]);
const CONTENT_PHASES = new Set(["result", "category_reveal", "challenge", "voting", "scoring"]);

function getRimColor(segmentType: string | null | undefined, segmentColor?: string): string {
  if (segmentColor) return segmentColor;
  if (!segmentType) return "#a020f0";
  return "#a020f0";
}

const MAIN_STAGE_KEYFRAMES = `
@keyframes rimGlow {
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 1; }
}
@keyframes contentSlideIn {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
`;

let mainStageKFInjected = false;
if (typeof document !== "undefined" && !mainStageKFInjected) {
  mainStageKFInjected = true;
  const s = document.createElement("style");
  s.textContent = MAIN_STAGE_KEYFRAMES;
  document.head.appendChild(s);
}

export default function MainStage({
  phase,
  children,
  segmentType,
  segmentColor,
}: MainStageProps) {
  const isWheelPhase = SPINNING_PHASES.has(phase);
  const isContentPhase = CONTENT_PHASES.has(phase);
  const rimColor = getRimColor(segmentType, segmentColor);

  return (
    <div
      className="relative flex-1 flex flex-col items-center justify-center"
      style={{ minHeight: 0 }}
    >
      {/* Neon rim border */}
      <div
        className="relative flex flex-col items-center justify-center w-full h-full"
        style={{
          flex: 1,
          margin: "12px",
          borderRadius: "20px",
          border: `1.5px solid ${rimColor}55`,
          boxShadow: `0 0 24px ${rimColor}33, 0 0 60px ${rimColor}14, inset 0 0 30px rgba(0,0,0,0.5)`,
          background: isContentPhase
            ? `radial-gradient(ellipse at 50% 40%, ${rimColor}0a 0%, rgba(0,0,0,0.6) 100%)`
            : "rgba(0,0,0,0.3)",
          transition: "box-shadow 0.8s ease, background 0.8s ease, border-color 0.8s ease",
          animation: "rimGlow 3s ease-in-out infinite",
        }}
      >
        {/* Corner accents */}
        {["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"].map((pos) => (
          <div
            key={pos}
            className={`absolute ${pos} w-4 h-4 pointer-events-none`}
            style={{
              borderColor: `${rimColor}88`,
              borderStyle: "solid",
              borderWidth:
                pos.includes("top") && pos.includes("left")
                  ? "2px 0 0 2px"
                  : pos.includes("top") && pos.includes("right")
                  ? "2px 2px 0 0"
                  : pos.includes("bottom") && pos.includes("left")
                  ? "0 0 2px 2px"
                  : "0 2px 2px 0",
              borderRadius:
                pos.includes("top-left") || pos.includes("top") && pos.includes("left")
                  ? "4px 0 0 0"
                  : pos.includes("top") && pos.includes("right")
                  ? "0 4px 0 0"
                  : pos.includes("bottom") && pos.includes("left")
                  ? "0 0 0 4px"
                  : "0 0 4px 0",
            }}
          />
        ))}

        {/* Content */}
        <div
          className="relative w-full h-full flex flex-col items-center justify-center p-4"
          style={
            isContentPhase
              ? { animation: "contentSlideIn 0.45s cubic-bezier(0.22,1,0.36,1) both" }
              : undefined
          }
        >
          {children}
        </div>

        {/* Phase label ribbon */}
        {isWheelPhase && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 text-[9px] font-black tracking-widest uppercase px-3 py-1 rounded-full"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              background: `${rimColor}22`,
              border: `1px solid ${rimColor}55`,
              color: rimColor,
              textShadow: `0 0 8px ${rimColor}`,
              pointerEvents: "none",
            }}
          >
            {phase.replace(/_/g, " ")}
          </div>
        )}
      </div>
    </div>
  );
}
