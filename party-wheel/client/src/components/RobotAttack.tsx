import { useEffect, useState } from "react";
import { playRobotAttackSound } from "../lib/audio";

interface RobotAttackProps {
  active: boolean;
  targetName?: string;
  onComplete?: () => void;
}

export default function RobotAttack({ active, targetName, onComplete }: RobotAttackProps) {
  const [phase, setPhase] = useState<"hidden" | "entering" | "attacking" | "exiting">("hidden");
  const [glitchText, setGlitchText] = useState("AI4U");

  useEffect(() => {
    if (!active) {
      setPhase("hidden");
      return;
    }

    setPhase("entering");
    playRobotAttackSound();

    // Glitch text animation
    const glitchChars = "!@#$%^&*<>?/|\\[]{}0123456789ABCDEF";
    let glitchInterval: ReturnType<typeof setInterval>;
    let glitchCount = 0;

    glitchInterval = setInterval(() => {
      if (glitchCount < 15) {
        setGlitchText(
          Array.from("AI4U").map(() =>
            glitchChars[Math.floor(Math.random() * glitchChars.length)]
          ).join("")
        );
        glitchCount++;
      } else {
        setGlitchText("AI4U");
        clearInterval(glitchInterval);
      }
    }, 80);

    const attackTimer = setTimeout(() => setPhase("attacking"), 400);
    const exitTimer = setTimeout(() => setPhase("exiting"), 2500);
    const doneTimer = setTimeout(() => {
      setPhase("hidden");
      onComplete?.();
    }, 3200);

    return () => {
      clearTimeout(attackTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
      clearInterval(glitchInterval);
    };
  }, [active, onComplete]);

  if (phase === "hidden") return null;

  return (
    <div className={`
      fixed inset-0 z-50 flex items-center justify-center
      transition-all duration-300
      ${phase === "entering" ? "opacity-0 scale-50" : ""}
      ${phase === "attacking" ? "opacity-100 scale-100" : ""}
      ${phase === "exiting" ? "opacity-0 scale-150" : ""}
    `}>
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Red scan lines */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(239,68,68,0.05)_2px,rgba(239,68,68,0.05)_4px)]" />

      {/* Robot card */}
      <div className="relative z-10 text-center space-y-6 p-8 max-w-sm mx-auto">
        {/* Robot avatar */}
        <div className="relative mx-auto w-32 h-32">
          <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-red-900 to-red-700 border-2 border-red-500 flex items-center justify-center shadow-2xl shadow-red-900/80">
            <span className="text-6xl" style={{ filter: "drop-shadow(0 0 12px rgba(239,68,68,0.8))" }}>
              🤖
            </span>
          </div>
          {/* Zap effects */}
          <div className="absolute -top-3 -right-3 text-2xl animate-bounce">⚡</div>
          <div className="absolute -bottom-3 -left-3 text-2xl animate-bounce delay-150">⚡</div>
        </div>

        {/* Robot name */}
        <div>
          <div className="text-4xl font-black font-orbitron text-red-400 tracking-widest"
            style={{ textShadow: "0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4)" }}>
            {glitchText}
          </div>
          <div className="text-sm text-red-300 font-orbitron tracking-widest mt-1">ROBOT SLAPDOWN</div>
        </div>

        {/* Attack message */}
        <div className="bg-red-900/40 border border-red-500/40 rounded-xl p-4">
          <p className="text-white font-bold text-lg">
            {targetName ? `${targetName} has been SLAPDOWN'd!` : "SLAPDOWN INITIATED!"}
          </p>
          <p className="text-red-300 text-sm mt-1">
            The AI4U robot detected a logic error. Points deducted!
          </p>
        </div>

        {/* Glitch bars */}
        <div className="space-y-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-1 bg-red-500/60 rounded animate-pulse"
              style={{
                width: `${60 + Math.random() * 40}%`,
                animationDelay: `${i * 0.1}s`,
                marginLeft: `${Math.random() * 20}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
