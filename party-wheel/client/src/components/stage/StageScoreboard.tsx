import { useEffect } from "react";

interface ScoreboardPlayer {
  id: number;
  name: string;
  avatarIndex: number;
  score: number;
  isBot: boolean;
  streak?: number;
}

interface StageScoreboardProps {
  players: ScoreboardPlayer[];
  roundNumber: number;
  maxRounds: number;
}

const AVATAR_EMOJIS = [
  "🤖", "👾", "🦾", "🧠", "⚡", "🔮", "🎭", "🔥", "❄️", "🌀", "💀", "🎲",
];

const SCOREBOARD_KEYFRAMES = `
@keyframes scoreBarGrow {
  from { width: 0%; }
  to   { width: var(--bar-width); }
}
@keyframes crownFloat {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  50%       { transform: translateY(-4px) rotate(5deg); }
}
@keyframes goldenGlow {
  0%, 100% { box-shadow: 0 0 10px rgba(255,215,0,0.4), 0 0 24px rgba(255,215,0,0.15); }
  50%       { box-shadow: 0 0 20px rgba(255,215,0,0.7), 0 0 40px rgba(255,215,0,0.3); }
}
@keyframes streakFlicker {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}
`;

let scoreboardKFInjected = false;
function injectScoreboardKeyframes() {
  if (scoreboardKFInjected) return;
  scoreboardKFInjected = true;
  const s = document.createElement("style");
  s.textContent = SCOREBOARD_KEYFRAMES;
  document.head.appendChild(s);
}

const NEON_COLORS = [
  "#ff0080", // hot pink – 1st
  "#00ffcc", // cyan – 2nd
  "#c840ff", // violet – 3rd
  "#ffaa00", // amber – 4th+
];

function getRankColor(rank: number): string {
  return NEON_COLORS[Math.min(rank - 1, NEON_COLORS.length - 1)] ?? NEON_COLORS[NEON_COLORS.length - 1]!;
}

export default function StageScoreboard({
  players,
  roundNumber,
  maxRounds,
}: StageScoreboardProps) {
  useEffect(() => { injectScoreboardKeyframes(); }, []);

  const ranked = [...players].sort((a, b) => b.score - a.score);
  const maxScore = Math.max(...ranked.map((p) => p.score), 1);
  const roundProgress = Math.min(roundNumber / Math.max(maxRounds, 1), 1);

  return (
    <div
      className="flex flex-col gap-1.5 p-2"
      style={{
        width: "168px",
        minWidth: "148px",
        background: "rgba(4,0,16,0.78)",
        borderLeft: "1px solid rgba(100,20,180,0.3)",
        fontFamily: "'Orbitron', sans-serif",
      }}
    >
      {/* Header */}
      <div
        className="text-[9px] font-black tracking-widest uppercase text-center pb-1"
        style={{
          color: "#7030c0",
          borderBottom: "1px solid rgba(100,20,180,0.3)",
        }}
      >
        Scoreboard
      </div>

      {/* Round progress */}
      <div className="px-1 pb-1">
        <div
          className="flex justify-between text-[9px] mb-0.5"
          style={{ color: "rgba(160,80,240,0.7)" }}
        >
          <span>Round</span>
          <span>{roundNumber}/{maxRounds}</span>
        </div>
        <div
          className="w-full h-1 rounded-full overflow-hidden"
          style={{ background: "rgba(100,20,180,0.25)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${roundProgress * 100}%`,
              background: "linear-gradient(90deg, #c840ff, #ff0080)",
              boxShadow: "0 0 6px #c840ff",
            }}
          />
        </div>
      </div>

      {/* Player rows */}
      {ranked.map((player, idx) => {
        const rank = idx + 1;
        const isFirst = rank === 1;
        const barPct = maxScore > 0 ? Math.round((player.score / maxScore) * 100) : 0;
        const rankColor = getRankColor(rank);
        const emoji = AVATAR_EMOJIS[player.avatarIndex % AVATAR_EMOJIS.length] ?? "🤖";
        const hasStreak = (player.streak ?? 0) >= 3;

        return (
          <div
            key={player.id}
            className="relative flex flex-col gap-0.5 px-2 py-1.5 rounded-lg"
            style={{
              background: isFirst
                ? "linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(80,40,0,0.2) 100%)"
                : "rgba(10,0,30,0.5)",
              border: isFirst
                ? "1px solid rgba(255,215,0,0.4)"
                : "1px solid rgba(80,20,140,0.3)",
              animation: isFirst ? "goldenGlow 2.4s ease-in-out infinite" : undefined,
            }}
          >
            {/* Top row: rank, emoji, name */}
            <div className="flex items-center gap-1.5">
              {/* Rank number */}
              <span
                className="text-[10px] font-black w-5 text-center flex-shrink-0"
                style={{
                  color:
                    rank === 1
                      ? "#ffd700"
                      : rank === 2
                      ? "#c0c0c0"
                      : rank === 3
                      ? "#cd7f32"
                      : "rgba(140,80,200,0.7)",
                  textShadow: rank === 1 ? "0 0 8px rgba(255,215,0,0.7)" : undefined,
                }}
              >
                {rank}
              </span>

              {/* Crown for first + avatar */}
              <div className="relative flex-shrink-0">
                <span className="text-base leading-none">{emoji}</span>
                {isFirst && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs"
                    style={{ animation: "crownFloat 2s ease-in-out infinite" }}
                  >
                    👑
                  </span>
                )}
              </div>

              {/* Name */}
              <span
                className="text-[10px] font-bold truncate flex-1"
                style={{ color: isFirst ? "#ffe060" : "#a060d0" }}
              >
                {player.name}
              </span>

              {/* Streak fire */}
              {hasStreak && (
                <span
                  className="text-xs flex-shrink-0"
                  style={{ animation: "streakFlicker 0.8s ease-in-out infinite" }}
                >
                  🔥
                </span>
              )}
            </div>

            {/* Score */}
            <div
              className="text-sm font-black tabular-nums"
              style={{
                color: rankColor,
                textShadow: `0 0 8px ${rankColor}88`,
              }}
            >
              {player.score.toLocaleString()}
              <span
                className="text-[8px] font-normal ml-1"
                style={{ color: "rgba(140,80,200,0.7)" }}
              >
                pts
              </span>
            </div>

            {/* Score bar */}
            <div
              className="w-full h-1 rounded-full overflow-hidden"
              style={{ background: "rgba(60,10,100,0.4)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${barPct}%`,
                  background: `linear-gradient(90deg, ${rankColor}88, ${rankColor})`,
                  boxShadow: `0 0 4px ${rankColor}`,
                  transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
