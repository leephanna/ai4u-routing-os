import { useEffect, useMemo } from "react";

interface ReactionPlayer {
  id: number;
  name: string;
  avatarIndex: number;
  score: number;
  isBot: boolean;
  turnOrder: number;
}

interface AvatarReactionDirectorProps {
  players: ReactionPlayer[];
  currentPlayerId: number | null | undefined;
  phase: string;
  segmentType: string | null;
}

type ReactionKey = "spinning" | "celebrate" | "shocked" | "voting" | "watching" | "winner" | "idle";

const AVATAR_EMOJIS = [
  "🤖", "👾", "🦾", "🧠", "⚡", "🔮", "🎭", "🔥", "❄️", "🌀", "💀", "🎲",
];

const REACTION_EMOJIS: Record<ReactionKey, string> = {
  spinning:  "🌀",
  celebrate: "🎉",
  shocked:   "😱",
  voting:    "🗳️",
  watching:  "👀",
  winner:    "🏆",
  idle:      "😊",
};

const REACTION_KF = `
@keyframes reactionBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  40%       { transform: translateY(-14px) scale(1.15); }
  70%       { transform: translateY(-6px) scale(1.07); }
}
@keyframes reactionSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes reactionShake {
  0%,100% { transform: translateX(0); }
  20%      { transform: translateX(-8px); }
  40%      { transform: translateX(8px); }
  60%      { transform: translateX(-5px); }
  80%      { transform: translateX(5px); }
}
@keyframes reactionPulse {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.1); }
}
@keyframes reactionFadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spotlightGlow {
  0%, 100% { box-shadow: 0 0 14px rgba(255,20,160,0.7), 0 0 32px rgba(255,20,160,0.3); }
  50%       { box-shadow: 0 0 24px rgba(255,20,160,1), 0 0 52px rgba(255,20,160,0.5); }
}
`;

let reactionKFInjected = false;
function injectReactionKeyframes() {
  if (reactionKFInjected) return;
  reactionKFInjected = true;
  const s = document.createElement("style");
  s.textContent = REACTION_KF;
  document.head.appendChild(s);
}

function deriveReaction(
  playerId: number,
  currentPlayerId: number | null | undefined,
  phase: string,
  segmentType: string | null,
): ReactionKey {
  const isActive = playerId === currentPlayerId;
  const isNegative =
    segmentType === "robot_slapdown" || segmentType === "system_crash";

  if ((phase === "spinning" || phase === "spin_preview") && isActive) return "spinning";
  if (phase === "landing_closeup" && isActive) return "spinning";
  if (phase === "result" && isActive && !isNegative) return "celebrate";
  if (phase === "result" && isActive && isNegative) return "shocked";
  if (phase === "result" && !isActive && isNegative) return "shocked";
  if (phase === "result" && !isActive) return "watching";
  if (phase === "voting" || phase === "challenge") return "voting";
  if (phase === "scoring" && isActive) return "celebrate";
  if (phase === "scoring" && !isActive) return "watching";
  if (phase === "game_over") return "winner";
  if (!isActive) return "watching";
  return "idle";
}

function getReactionAnimation(reaction: ReactionKey): React.CSSProperties {
  switch (reaction) {
    case "spinning":
      return { animation: "reactionSpin 0.35s linear infinite" };
    case "celebrate":
      return { animation: "reactionBounce 0.7s ease-in-out 3" };
    case "shocked":
      return { animation: "reactionShake 0.5s ease-in-out 2" };
    case "voting":
      return { animation: "reactionPulse 1.4s ease-in-out infinite" };
    case "winner":
      return { animation: "reactionBounce 0.6s ease-in-out 4", filter: "drop-shadow(0 0 10px gold)" };
    case "watching":
      return { opacity: 0.75 };
    default:
      return {};
  }
}

export default function AvatarReactionDirector({
  players,
  currentPlayerId,
  phase,
  segmentType,
}: AvatarReactionDirectorProps) {
  useEffect(() => { injectReactionKeyframes(); }, []);

  const sorted = useMemo(
    () => [...players].sort((a, b) => a.turnOrder - b.turnOrder),
    [players],
  );

  return (
    <div
      className="relative z-20 flex items-end justify-center gap-3 px-4 py-3"
      style={{
        background:
          "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)",
        animation: "reactionFadeIn 0.5s ease-out both",
      }}
    >
      {sorted.map((player) => {
        const isActive = player.id === currentPlayerId;
        const reaction = deriveReaction(player.id, currentPlayerId, phase, segmentType);
        const reactionEmoji = REACTION_EMOJIS[reaction];
        const avatarEmoji = AVATAR_EMOJIS[player.avatarIndex % AVATAR_EMOJIS.length] ?? "🤖";
        const animStyle = getReactionAnimation(reaction);

        return (
          <div
            key={player.id}
            className="flex flex-col items-center gap-1"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            {/* Reaction badge above avatar */}
            <div
              className="text-lg leading-none"
              style={{
                opacity: reaction === "idle" ? 0.3 : 1,
                transition: "opacity 0.4s ease",
              }}
            >
              {reactionEmoji}
            </div>

            {/* Avatar circle */}
            <div
              className="relative flex items-center justify-center rounded-full"
              style={{
                width: "48px",
                height: "48px",
                background: isActive
                  ? "radial-gradient(circle, rgba(255,20,160,0.3) 0%, rgba(100,0,60,0.6) 100%)"
                  : "rgba(20,5,40,0.7)",
                border: isActive
                  ? "2px solid rgba(255,20,160,0.8)"
                  : "1.5px solid rgba(80,20,140,0.45)",
                animation: isActive ? "spotlightGlow 1.6s ease-in-out infinite" : undefined,
                transition: "border-color 0.4s ease, background 0.4s ease",
              }}
            >
              <span
                className="text-2xl leading-none select-none"
                style={animStyle}
              >
                {avatarEmoji}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                  style={{
                    background: "#ff14a0",
                    boxShadow: "0 0 6px #ff14a0, 0 0 12px #ff14a066",
                    animation: "reactionPulse 0.8s ease-in-out infinite",
                  }}
                />
              )}
            </div>

            {/* Name label */}
            <div
              className="text-[9px] font-bold tracking-wide max-w-[52px] truncate text-center"
              style={{
                color: isActive ? "#ff40c0" : "rgba(140,80,200,0.7)",
                textShadow: isActive ? "0 0 6px #ff40c0" : undefined,
              }}
            >
              {player.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
