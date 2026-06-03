import { ReactNode, useEffect } from "react";

interface GameStageShellProps {
  children: ReactNode;
  phase: string;
  roomCode: string;
  roundNumber: number;
  timeLeft?: number | null;
}

const STAGE_KEYFRAMES = `
@keyframes scanline {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
@keyframes spotlightPulse {
  0%, 100% { opacity: 0.08; }
  50%       { opacity: 0.14; }
}
@keyframes timerPulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.12); }
}
`;

let stageKFInjected = false;
function injectStageKeyframes() {
  if (stageKFInjected) return;
  stageKFInjected = true;
  const s = document.createElement("style");
  s.textContent = STAGE_KEYFRAMES;
  document.head.appendChild(s);
}

export default function GameStageShell({
  children,
  phase,
  roomCode,
  roundNumber,
  timeLeft,
}: GameStageShellProps) {
  useEffect(() => { injectStageKeyframes(); }, []);

  const isTimerWarning = timeLeft != null && timeLeft <= 10;

  return (
    <div
      className="relative w-full min-h-screen overflow-hidden flex flex-col"
      style={{
        background: "radial-gradient(ellipse at 50% 0%, #1a0030 0%, #000011 60%, #000 100%)",
        fontFamily: "'Orbitron', sans-serif",
      }}
    >
      {/* Spotlight beam from top */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: "420px",
          height: "65vh",
          background:
            "linear-gradient(to bottom, rgba(180,60,255,0.18) 0%, rgba(100,20,200,0.06) 60%, transparent 100%)",
          clipPath: "polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)",
          animation: "spotlightPulse 4s ease-in-out infinite",
          zIndex: 1,
        }}
      />

      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ zIndex: 2, overflow: "hidden" }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background:
              "linear-gradient(transparent 0%, rgba(180,60,255,0.18) 50%, transparent 100%)",
            animation: "scanline 6s linear infinite",
          }}
        />
      </div>

      {/* Top bar */}
      <header
        className="relative z-10 flex items-center justify-between px-4 py-3"
        style={{
          background:
            "linear-gradient(90deg, rgba(26,0,48,0.95) 0%, rgba(10,0,30,0.92) 100%)",
          borderBottom: "1px solid rgba(160,40,255,0.35)",
          boxShadow: "0 2px 24px rgba(160,40,255,0.22), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        {/* Branding */}
        <div className="flex flex-col leading-tight">
          <span
            className="text-xs font-black tracking-[0.25em] uppercase"
            style={{
              color: "#c060ff",
              textShadow: "0 0 10px #c060ff, 0 0 22px rgba(192,96,255,0.5)",
              fontFamily: "'Orbitron', sans-serif",
            }}
          >
            AI4U
          </span>
          <span
            className="text-[10px] tracking-[0.18em] uppercase"
            style={{ color: "#7030c0", fontFamily: "'Orbitron', sans-serif" }}
          >
            Party Wheel
          </span>
        </div>

        {/* Phase indicator */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] tracking-widest uppercase px-2 py-1 rounded"
            style={{
              background: "rgba(160,40,255,0.15)",
              border: "1px solid rgba(160,40,255,0.3)",
              color: "#d080ff",
              fontFamily: "'Orbitron', sans-serif",
            }}
          >
            {phase.replace(/_/g, " ")}
          </span>
        </div>

        {/* Right: room code, round, timer */}
        <div className="flex items-center gap-4">
          {/* Round */}
          <div className="text-center hidden sm:block">
            <div
              className="text-[9px] tracking-widest uppercase"
              style={{ color: "#7030c0", fontFamily: "'Orbitron', sans-serif" }}
            >
              Round
            </div>
            <div
              className="text-lg font-black"
              style={{
                color: "#e0a0ff",
                textShadow: "0 0 8px rgba(192,96,255,0.6)",
                fontFamily: "'Orbitron', sans-serif",
                lineHeight: 1,
              }}
            >
              {roundNumber}
            </div>
          </div>

          {/* Timer */}
          {timeLeft != null && (
            <div className="text-center">
              <div
                className="text-[9px] tracking-widest uppercase"
                style={{ color: "#7030c0", fontFamily: "'Orbitron', sans-serif" }}
              >
                Time
              </div>
              <div
                className="text-lg font-black tabular-nums"
                style={{
                  color: isTimerWarning ? "#ff4060" : "#40ffcc",
                  textShadow: isTimerWarning
                    ? "0 0 10px rgba(255,60,80,0.8)"
                    : "0 0 8px rgba(64,255,200,0.6)",
                  fontFamily: "'Orbitron', sans-serif",
                  animation: isTimerWarning ? "timerPulse 0.6s ease-in-out infinite" : undefined,
                  lineHeight: 1,
                }}
              >
                {timeLeft}
              </div>
            </div>
          )}

          {/* Room code */}
          <div className="text-center">
            <div
              className="text-[9px] tracking-widest uppercase"
              style={{ color: "#7030c0", fontFamily: "'Orbitron', sans-serif" }}
            >
              Room
            </div>
            <div
              className="text-sm font-black tracking-widest"
              style={{
                color: "#ffcc40",
                textShadow: "0 0 8px rgba(255,200,64,0.7)",
                fontFamily: "'Orbitron', sans-serif",
                lineHeight: 1,
              }}
            >
              {roomCode}
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="relative z-10 flex-1 flex flex-col">
        {children}
      </main>

      {/* Grid floor effect at bottom */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0"
        style={{
          height: "160px",
          zIndex: 1,
          perspective: "400px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "-50%",
            right: "-50%",
            height: "300px",
            backgroundImage: `
              linear-gradient(rgba(160,40,255,0.22) 1px, transparent 1px),
              linear-gradient(90deg, rgba(160,40,255,0.22) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
            transform: "rotateX(70deg) translateZ(-40px)",
            transformOrigin: "bottom center",
            maskImage: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );
}
