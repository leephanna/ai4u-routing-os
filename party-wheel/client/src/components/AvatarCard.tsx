import { useEffect, useRef, useState } from "react";
import { type AvatarState } from "../../../shared/gameTypes";

const AVATAR_CONFIGS = [
  { emoji: "🤖", name: "Glitch Bot", color: "from-violet-600 to-indigo-600" },
  { emoji: "👾", name: "Pixel Ghost", color: "from-cyan-600 to-blue-600" },
  { emoji: "🦾", name: "Cyber Arm", color: "from-pink-600 to-rose-600" },
  { emoji: "🧠", name: "Big Brain", color: "from-yellow-500 to-orange-500" },
  { emoji: "⚡", name: "Zap King", color: "from-amber-500 to-yellow-500" },
  { emoji: "🔮", name: "Oracle", color: "from-purple-600 to-violet-600" },
  { emoji: "🎭", name: "Drama Bot", color: "from-teal-500 to-cyan-500" },
  { emoji: "🔥", name: "Inferno", color: "from-red-600 to-orange-600" },
  { emoji: "❄️", name: "Ice Core", color: "from-sky-500 to-blue-500" },
  { emoji: "🌀", name: "Vortex", color: "from-indigo-500 to-purple-500" },
  { emoji: "💀", name: "Skull.exe", color: "from-gray-600 to-slate-600" },
  { emoji: "🎲", name: "Chaos Die", color: "from-green-500 to-emerald-500" },
];

interface AvatarCardProps {
  avatarIndex: number;
  name: string;
  score: number;
  streak: number;
  shields: number;
  chaosMultiplier: number;
  isCurrentTurn?: boolean;
  isHost?: boolean;
  state?: AvatarState;
  compact?: boolean;
}

// Inline keyframe styles injected once
const KEYFRAMES = `
@keyframes avatarBounce {
  0%,100% { transform: translateY(0); }
  25% { transform: translateY(-18px); }
  75% { transform: translateY(-8px); }
}
@keyframes avatarShake {
  0%,100% { transform: translateX(0); }
  15% { transform: translateX(-8px); }
  35% { transform: translateX(8px); }
  55% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}
@keyframes avatarSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes avatarBob {
  0%,100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-6px) scale(1.05); }
}
@keyframes floatScore {
  0%   { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-40px); }
}
@keyframes avatarShrink {
  0%,100% { transform: scale(0.9); filter: grayscale(0.7); }
  50% { transform: scale(0.88); filter: grayscale(0.9); }
}
`;

let keyframesInjected = false;
function injectKeyframes() {
  if (keyframesInjected) return;
  keyframesInjected = true;
  const style = document.createElement("style");
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

function getStateStyle(state: AvatarState): React.CSSProperties {
  switch (state) {
    case "celebrate":
      return { animation: "avatarBounce 0.6s ease-in-out 3", filter: "drop-shadow(0 0 12px gold)" };
    case "shocked":
      return { animation: "avatarShake 0.5s ease-in-out 2" };
    case "defeated":
      return { animation: "avatarShrink 1.2s ease-in-out infinite", filter: "hue-rotate(0deg) saturate(0.4)" };
    case "spinning":
      return { animation: "avatarSpin 0.3s linear infinite" };
    case "winner":
      return { animation: "avatarBounce 0.5s ease-in-out 4", filter: "drop-shadow(0 0 16px gold)", transform: "scale(1.2)" };
    case "loser":
      return { transform: "scale(0.9)", filter: "grayscale(0.8)" };
    case "voting":
      return { animation: "avatarBob 1.2s ease-in-out infinite" };
    case "watching":
      return { opacity: 0.7 };
    default:
      return {};
  }
}

function getStateBadge(state: AvatarState): string | null {
  switch (state) {
    case "winner": return "🏆";
    case "voting": return "💭";
    case "defeated": return "😵";
    case "shocked": return "😱";
    default: return null;
  }
}

export default function AvatarCard({
  avatarIndex,
  name,
  score,
  streak,
  shields,
  chaosMultiplier,
  isCurrentTurn,
  isHost,
  state = "idle",
  compact = false,
}: AvatarCardProps) {
  useEffect(() => { injectKeyframes(); }, []);

  const config = AVATAR_CONFIGS[avatarIndex % AVATAR_CONFIGS.length] ?? AVATAR_CONFIGS[0]!;
  const avatarStyle = getStateStyle(state);
  const badge = getStateBadge(state);

  // Floating score change animation
  const prevScore = useRef(score);
  const [floatDelta, setFloatDelta] = useState<number | null>(null);
  useEffect(() => {
    if (prevScore.current !== score) {
      const delta = score - prevScore.current;
      prevScore.current = score;
      setFloatDelta(delta);
      const t = setTimeout(() => setFloatDelta(null), 1200);
      return () => clearTimeout(t);
    }
  }, [score]);

  if (compact) {
    return (
      <div className={`
        relative flex items-center gap-2 p-2 rounded-xl transition-all duration-300
        ${isCurrentTurn
          ? "bg-white/15 border border-violet-400/50 shadow-lg shadow-violet-900/30"
          : "bg-white/5 border border-white/10"
        }
      `}>
        <div
          className={`w-8 h-8 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center text-sm relative`}
          style={avatarStyle}
        >
          {config.emoji}
          {badge && (
            <span className="absolute -top-2 -right-2 text-xs">{badge}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-white truncate">{name}</span>
            {isHost && <span className="text-[10px] text-yellow-400">👑</span>}
            {isCurrentTurn && <span className="text-[10px] text-violet-400 animate-pulse">▶</span>}
          </div>
          <div className="text-xs text-violet-300 font-orbitron">{score.toLocaleString()} pts</div>
        </div>
        {shields > 0 && <span className="text-xs">🛡️{shields}</span>}
        {streak >= 3 && <span className="text-xs text-orange-400">🔥{streak}</span>}
        {/* Floating score delta */}
        {floatDelta !== null && (
          <span
            className={`absolute -top-4 right-1 text-xs font-bold font-orbitron pointer-events-none`}
            style={{
              color: floatDelta >= 0 ? "#4ade80" : "#f87171",
              animation: "floatScore 1.2s ease-out forwards",
            }}
          >
            {floatDelta >= 0 ? "+" : ""}{floatDelta}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`
      relative flex flex-col items-center gap-3 p-4 rounded-2xl transition-all duration-300
      ${isCurrentTurn
        ? "bg-gradient-to-b from-violet-900/60 to-indigo-900/60 border border-violet-400/60 shadow-xl shadow-violet-900/40 scale-105"
        : "bg-white/5 border border-white/10"
      }
    `}>
      {isCurrentTurn && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-violet-500 text-white text-[10px] font-bold font-orbitron px-2 py-0.5 rounded-full">
          SPINNING
        </div>
      )}

      {/* Avatar */}
      <div className="relative">
        <div
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${config.color} flex items-center justify-center text-3xl shadow-lg ${isCurrentTurn ? "shadow-violet-500/50" : ""}`}
          style={avatarStyle}
        >
          {config.emoji}
        </div>
        {badge && (
          <span className="absolute -top-3 -right-3 text-xl">{badge}</span>
        )}
        {/* Floating score delta */}
        {floatDelta !== null && (
          <span
            className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-bold font-orbitron pointer-events-none whitespace-nowrap"
            style={{
              color: floatDelta >= 0 ? "#4ade80" : "#f87171",
              animation: "floatScore 1.2s ease-out forwards",
            }}
          >
            {floatDelta >= 0 ? "+" : ""}{floatDelta}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="text-sm font-bold text-white">{name}</span>
          {isHost && <span className="text-xs">👑</span>}
        </div>
      </div>

      {/* Score */}
      <div className="text-center">
        <div className="text-xl font-black font-orbitron text-white">{score.toLocaleString()}</div>
        <div className="text-xs text-gray-400">HYPE PTS</div>
      </div>

      {/* Status badges */}
      <div className="flex gap-2 flex-wrap justify-center">
        {streak >= 3 && (
          <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">
            🔥 {streak} streak
          </span>
        )}
        {shields > 0 && (
          <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
            🛡️ {shields}
          </span>
        )}
        {chaosMultiplier > 1 && (
          <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">
            ×{chaosMultiplier.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

export { AVATAR_CONFIGS };
