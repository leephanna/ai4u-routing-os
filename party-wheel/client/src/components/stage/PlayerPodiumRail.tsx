import { useEffect, useRef, useState } from "react";

const AVATAR_EMOJIS = [
  "🤖", "👾", "🦾", "🧠", "⚡", "🔮", "🎭", "🔥", "❄️", "🌀", "💀", "🎲",
];

interface PodiumPlayer {
  id: number;
  name: string;
  avatarIndex: number;
  score: number;
  isBot: boolean;
  turnOrder: number;
}

interface PlayerPodiumRailProps {
  players: PodiumPlayer[];
  currentPlayerId: number | null | undefined;
  myPlayerId: number | null | undefined;
}

const PODIUM_KEYFRAMES = `
@keyframes podiumGlow {
  0%, 100% { box-shadow: 0 0 12px rgba(255,20,160,0.6), 0 0 30px rgba(255,20,160,0.25); }
  50%       { box-shadow: 0 0 20px rgba(255,20,160,0.9), 0 0 50px rgba(255,20,160,0.4); }
}
@keyframes activeBadgePulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
@keyframes floatPodiumScore {
  0%   { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-32px); }
}
`;

let podiumKFInjected = false;
function injectPodiumKeyframes() {
  if (podiumKFInjected) return;
  podiumKFInjected = true;
  const s = document.createElement("style");
  s.textContent = PODIUM_KEYFRAMES;
  document.head.appendChild(s);
}

function getRankLabel(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

function FloatingDelta({ delta }: { delta: number }) {
  return (
    <span
      className="absolute right-1 -top-4 text-xs font-black pointer-events-none"
      style={{
        fontFamily: "'Orbitron', sans-serif",
        color: delta >= 0 ? "#4ade80" : "#f87171",
        textShadow:
          delta >= 0
            ? "0 0 8px rgba(74,222,128,0.8)"
            : "0 0 8px rgba(248,113,113,0.8)",
        animation: "floatPodiumScore 1.2s ease-out forwards",
      }}
    >
      {delta >= 0 ? "+" : ""}{delta}
    </span>
  );
}

function PodiumEntry({
  player,
  rank,
  isActive,
  isMe,
}: {
  player: PodiumPlayer;
  rank: number;
  isActive: boolean;
  isMe: boolean;
}) {
  const emoji = AVATAR_EMOJIS[player.avatarIndex % AVATAR_EMOJIS.length] ?? "🤖";
  const prevScore = useRef(player.score);
  const [floatDelta, setFloatDelta] = useState<number | null>(null);

  useEffect(() => {
    if (prevScore.current !== player.score) {
      const delta = player.score - prevScore.current;
      prevScore.current = player.score;
      setFloatDelta(delta);
      const t = setTimeout(() => setFloatDelta(null), 1200);
      return () => clearTimeout(t);
    }
  }, [player.score]);

  return (
    <div
      className="relative flex items-center gap-2 px-2 py-2 rounded-xl transition-all duration-300"
      style={{
        background: isActive
          ? "linear-gradient(135deg, rgba(255,20,160,0.18) 0%, rgba(100,0,80,0.25) 100%)"
          : isMe
          ? "rgba(40,20,80,0.55)"
          : "rgba(10,0,30,0.55)",
        border: isActive
          ? "1px solid rgba(255,20,160,0.7)"
          : isMe
          ? "1px solid rgba(120,60,200,0.5)"
          : "1px solid rgba(60,20,100,0.35)",
        animation: isActive ? "podiumGlow 1.6s ease-in-out infinite" : undefined,
        transform: isActive ? "scale(1.03)" : "scale(1)",
      }}
    >
      {/* Rank badge */}
      <div
        className="text-[10px] font-black w-6 text-center flex-shrink-0"
        style={{
          fontFamily: "'Orbitron', sans-serif",
          color:
            rank === 1
              ? "#ffd700"
              : rank === 2
              ? "#c0c0c0"
              : rank === 3
              ? "#cd7f32"
              : "rgba(160,100,220,0.7)",
          textShadow:
            rank === 1
              ? "0 0 8px rgba(255,215,0,0.7)"
              : rank === 2
              ? "0 0 6px rgba(192,192,192,0.6)"
              : undefined,
        }}
      >
        {getRankLabel(rank)}
      </div>

      {/* Avatar */}
      <div
        className="text-xl flex-shrink-0 relative"
        style={
          isActive
            ? { filter: "drop-shadow(0 0 8px rgba(255,20,160,0.9))" }
            : undefined
        }
      >
        {emoji}
      </div>

      {/* Name + score */}
      <div className="flex-1 min-w-0">
        <div
          className="text-xs font-bold truncate flex items-center gap-1"
          style={{
            color: isActive ? "#ff40c0" : isMe ? "#d090ff" : "#a060e0",
            fontFamily: "'Orbitron', sans-serif",
            fontSize: "10px",
          }}
        >
          {player.name}
          {player.isBot && (
            <span style={{ color: "rgba(100,200,255,0.6)", fontSize: "9px" }}>BOT</span>
          )}
        </div>
        <div
          className="text-sm font-black tabular-nums relative"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            color: isActive ? "#ff80d8" : "#8040c0",
            textShadow: isActive ? "0 0 8px rgba(255,120,200,0.6)" : undefined,
          }}
        >
          {player.score.toLocaleString()}
          {floatDelta !== null && <FloatingDelta delta={floatDelta} />}
        </div>
      </div>

      {/* Active badge */}
      {isActive && (
        <div
          className="text-[9px] font-black px-1 py-0.5 rounded flex-shrink-0"
          style={{
            background: "rgba(255,20,160,0.25)",
            border: "1px solid rgba(255,20,160,0.6)",
            color: "#ff40c0",
            fontFamily: "'Orbitron', sans-serif",
            animation: "activeBadgePulse 1s ease-in-out infinite",
          }}
        >
          ◄ ON
        </div>
      )}
    </div>
  );
}

export default function PlayerPodiumRail({
  players,
  currentPlayerId,
  myPlayerId,
}: PlayerPodiumRailProps) {
  useEffect(() => { injectPodiumKeyframes(); }, []);

  // Sort by score descending for rank calculation
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const rankOf = Object.fromEntries(ranked.map((p, i) => [p.id, i + 1]));

  // Display in turn order
  const displayed = [...players].sort((a, b) => a.turnOrder - b.turnOrder);

  return (
    <div
      className="flex flex-col gap-1.5 p-2"
      style={{
        width: "160px",
        minWidth: "140px",
        background: "rgba(8,0,20,0.7)",
        borderRight: "1px solid rgba(100,20,180,0.3)",
      }}
    >
      {/* Header */}
      <div
        className="text-[9px] font-black tracking-widest uppercase text-center pb-1"
        style={{
          fontFamily: "'Orbitron', sans-serif",
          color: "#7030c0",
          borderBottom: "1px solid rgba(100,20,180,0.3)",
        }}
      >
        Players
      </div>

      {displayed.map((player) => (
        <PodiumEntry
          key={player.id}
          player={player}
          rank={rankOf[player.id] ?? displayed.length}
          isActive={player.id === currentPlayerId}
          isMe={player.id === myPlayerId}
        />
      ))}
    </div>
  );
}
