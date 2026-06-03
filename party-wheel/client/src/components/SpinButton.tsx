import { useState, useRef, useCallback, useEffect } from "react";
import { Zap } from "lucide-react";

interface SpinButtonProps {
  onSpin: (velocity: number) => void;
  disabled?: boolean;
  isMyTurn?: boolean;
}

const MIN_VELOCITY = 8;
const MAX_VELOCITY = 45;
const CHARGE_DURATION = 2500; // ms to reach max charge

export default function SpinButton({ onSpin, disabled, isMyTurn }: SpinButtonProps) {
  const [charging, setCharging] = useState(false);
  const [chargeLevel, setChargeLevel] = useState(0); // 0-1
  const pressStartRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const chargeIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const startCharge = useCallback(() => {
    if (disabled || !isMyTurn) return;
    pressStartRef.current = Date.now();
    setCharging(true);
    setChargeLevel(0);

    chargeIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - pressStartRef.current;
      const level = Math.min(elapsed / CHARGE_DURATION, 1);
      setChargeLevel(level);
    }, 16);
  }, [disabled, isMyTurn]);

  const releaseCharge = useCallback(() => {
    if (!charging) return;
    clearInterval(chargeIntervalRef.current);

    const elapsed = Date.now() - pressStartRef.current;
    const level = Math.min(elapsed / CHARGE_DURATION, 1);
    const velocity = MIN_VELOCITY + level * (MAX_VELOCITY - MIN_VELOCITY);

    setCharging(false);
    setChargeLevel(0);
    onSpin(Math.round(velocity));
  }, [charging, onSpin]);

  useEffect(() => {
    return () => {
      clearInterval(chargeIntervalRef.current);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const chargeColor = chargeLevel < 0.33
    ? "from-cyan-500 to-blue-500"
    : chargeLevel < 0.66
    ? "from-yellow-400 to-orange-500"
    : "from-red-500 to-pink-500";

  const chargeLabel = chargeLevel < 0.33 ? "SOFT" : chargeLevel < 0.66 ? "MEDIUM" : "HARD";

  if (!isMyTurn) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-32 h-32 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="text-gray-500 text-xs font-orbitron text-center px-4">WAITING FOR YOUR TURN</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Charge indicator */}
      <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${chargeColor} transition-all duration-75 rounded-full`}
          style={{ width: `${chargeLevel * 100}%` }}
        />
      </div>

      {charging && (
        <div className={`text-sm font-bold font-orbitron bg-gradient-to-r ${chargeColor} bg-clip-text text-transparent animate-pulse`}>
          {chargeLabel} SPIN — {Math.round(chargeLevel * 100)}%
        </div>
      )}

      {/* Main spin button */}
      <button
        onMouseDown={startCharge}
        onMouseUp={releaseCharge}
        onMouseLeave={releaseCharge}
        onTouchStart={(e) => { e.preventDefault(); startCharge(); }}
        onTouchEnd={(e) => { e.preventDefault(); releaseCharge(); }}
        disabled={disabled}
        className={`
          relative w-32 h-32 rounded-full font-orbitron font-black text-white
          flex items-center justify-center flex-col gap-1
          transition-all duration-150 select-none touch-none
          ${disabled
            ? "bg-gray-700 cursor-not-allowed opacity-50"
            : charging
            ? `bg-gradient-to-br ${chargeColor} scale-110 shadow-2xl shadow-violet-500/50`
            : "bg-gradient-to-br from-violet-600 to-cyan-600 hover:scale-105 active:scale-95 shadow-xl shadow-violet-900/50 cursor-pointer"
          }
        `}
        style={{
          boxShadow: charging
            ? `0 0 ${30 + chargeLevel * 40}px rgba(139,92,246,${0.4 + chargeLevel * 0.4})`
            : undefined,
        }}
      >
        <Zap
          className={`w-8 h-8 ${charging ? "animate-bounce" : ""}`}
          fill={charging ? "currentColor" : "none"}
        />
        <span className="text-xs tracking-widest">
          {charging ? "HOLD!" : "TAP/HOLD"}
        </span>
        <span className="text-[10px] tracking-wider opacity-70">TO SPIN</span>
      </button>

      <p className="text-gray-500 text-xs text-center">
        Tap for soft spin · Hold for hard spin
      </p>
    </div>
  );
}
