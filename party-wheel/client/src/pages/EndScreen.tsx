import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AVATAR_CONFIGS } from "@/components/AvatarCard";
import { Trophy, Share2, RotateCcw, Crown, Zap, Shield, TrendingUp } from "lucide-react";
import { playCelebrationSound } from "@/lib/audio";
import { Button } from "@/components/ui/button";
import CopyrightFooter from "@/components/CopyrightFooter";

// ── Confetti + animation keyframes ────────────────────────────────────────────
const CONFETTI_CSS = `
@keyframes confettiFall {
  0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
}
@keyframes winnerReveal {
  0%   { transform: scale(0.3) rotate(-5deg); opacity: 0; }
  60%  { transform: scale(1.15) rotate(2deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes rankSlide {
  from { transform: translateX(-30px); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}
@keyframes goldGlow {
  0%, 100% { text-shadow: 0 0 10px rgba(251,191,36,0.4); }
  50%       { text-shadow: 0 0 30px rgba(251,191,36,0.9), 0 0 60px rgba(251,191,36,0.4); }
}
`;

let confettiInjected = false;
function injectConfettiCSS() {
  if (confettiInjected) return;
  confettiInjected = true;
  const s = document.createElement("style");
  s.textContent = CONFETTI_CSS;
  document.head.appendChild(s);
}

const CONFETTI_COLORS = ["#7c3aed", "#06b6d4", "#f59e0b", "#ec4899", "#22c55e", "#ef4444", "#a78bfa", "#fbbf24"];

const RANK_TITLES: Record<number, string> = {
  1: "🏆 Champion",
  2: "🥈 Runner-Up",
  3: "🥉 Third Place",
};
function getRankTitle(rank: number): string {
  return RANK_TITLES[rank] ?? "💀 Needs Practice";
}

interface ConfettiPiece {
  id: number;
  left: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  shape: "rect" | "circle";
}

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
    delay: Math.random() * 2.5,
    duration: 2.5 + Math.random() * 2.5,
    size: 6 + Math.random() * 10,
    shape: Math.random() > 0.5 ? "rect" : "circle",
  }));
}

export default function EndScreen() {
  injectConfettiCSS();

  const { code } = useParams<{ code: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [confetti] = useState(() => generateConfetti(70));
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const celebratedRef = useRef(false);

  // Get room data
  const roomQuery = trpc.room.get.useQuery({ code: code ?? "" }, {
    enabled: !!code,
    retry: false,
  });

  const room = roomQuery.data;
  const roomId = room?.id;

  // Get replay card
  const replayQuery = trpc.replay.getByRoom.useQuery(
    { roomId: roomId ?? 0 },
    { enabled: !!roomId, retry: false }
  );

  const replayCard = replayQuery.data;

  // Parse player stats from replay card
  const playerStats: Array<{ name: string | null; score: number | null; streak: number | null; shields: number | null; avatarIndex?: number }> =
    replayCard?.statsJson
      ? (typeof replayCard.statsJson === "string"
          ? JSON.parse(replayCard.statsJson)
          : replayCard.statsJson) as Array<{ name: string | null; score: number | null; streak: number | null; shields: number | null; avatarIndex?: number }>
      : [];

  const sortedStats = [...playerStats].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const winner = sortedStats[0];

  useEffect(() => {
    if ((replayCard || room) && !celebratedRef.current) {
      celebratedRef.current = true;
      playCelebrationSound();
      if (replayCard?.shareToken) setShareToken(replayCard.shareToken);
      setTimeout(() => setShowScoreboard(true), 1800);
    }
  }, [replayCard, room]);

  const handleShare = async () => {
    const url = shareToken
      ? `${window.location.origin}/replay/${shareToken}`
      : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePlayAgain = () => navigate("/");

  const getRankEmoji = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 via-black to-black pointer-events-none" />

      {/* Confetti layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        {confetti.map((p) => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              top: "-20px",
              left: `${p.left}%`,
              width: p.size,
              height: p.shape === "rect" ? p.size * 0.5 : p.size,
              borderRadius: p.shape === "circle" ? "50%" : "2px",
              backgroundColor: p.color,
              animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
            }}
          />
        ))}
      </div>

      <div className="relative z-20 flex flex-col flex-1 max-w-lg mx-auto w-full px-4 py-6 gap-6">

        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <h1 className="text-3xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-violet-400 to-cyan-400">
              GAME OVER
            </h1>
            <Trophy className="w-8 h-8 text-yellow-400" />
          </div>
          <p className="text-gray-500 text-xs font-orbitron">ROOM {code}</p>
        </div>

        {/* Winner Spotlight */}
        {(replayCard || winner) && (
          <div
            className="relative"
            style={{ animation: "winnerReveal 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-violet-500/20 to-cyan-500/20 rounded-2xl blur-xl" />
            <div className="relative bg-gradient-to-br from-yellow-950/60 via-violet-950/60 to-cyan-950/60 border border-yellow-500/30 rounded-2xl p-6 text-center">
              <Crown className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
              <div className="text-xs font-orbitron text-yellow-400/70 mb-1">WINNER</div>
              {/* Winner avatar */}
              <div className="text-5xl mb-2">
                {AVATAR_CONFIGS[(winner?.avatarIndex ?? 0) % AVATAR_CONFIGS.length]?.emoji ?? "🤖"}
              </div>
              <div
                className="text-2xl font-orbitron font-black text-yellow-300 mb-1"
                style={{ animation: "goldGlow 2s ease-in-out infinite" }}
              >
                {replayCard?.winnerName ?? winner?.name ?? "Champion"}
              </div>
              <div className="text-3xl font-orbitron font-black text-white">
                {(replayCard?.winnerScore ?? winner?.score ?? 0).toLocaleString()}{" "}
                <span className="text-yellow-400/70 text-lg">pts</span>
              </div>
              {replayCard?.funnySummary && (
                <p className="mt-3 text-sm text-gray-300 italic leading-relaxed">
                  "{replayCard.funnySummary}"
                </p>
              )}
            </div>
          </div>
        )}

        {/* Scoreboard */}
        {showScoreboard && sortedStats.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-orbitron text-gray-500 uppercase tracking-widest">Final Standings</h2>
            {sortedStats.map((player, index) => {
              const rank = index + 1;
              const isWinner = rank === 1;
              const avatarCfg = AVATAR_CONFIGS[(player.avatarIndex ?? index) % AVATAR_CONFIGS.length]!;
              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isWinner
                      ? "bg-yellow-950/30 border-yellow-500/30"
                      : "bg-white/5 border-white/10"
                  }`}
                  style={{ animation: `rankSlide 0.4s ${index * 0.1}s ease-out both` }}
                >
                  <div className="text-xl w-8 text-center">{getRankEmoji(index)}</div>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 bg-gradient-to-br ${avatarCfg.color}`}
                  >
                    {avatarCfg.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-orbitron font-bold text-sm truncate ${isWinner ? "text-yellow-300" : "text-white"}`}>
                        {player.name ?? "Player"}
                      </span>
                      {player.name === user?.name && (
                        <span className="text-xs text-violet-400 font-orbitron">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-orbitron">{getRankTitle(rank)}</div>
                    <div className="flex gap-3 mt-0.5">
                      {(player.streak ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-orange-400">
                          <Zap className="w-3 h-3" /> {player.streak}
                        </span>
                      )}
                      {(player.shields ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-cyan-400">
                          <Shield className="w-3 h-3" /> {player.shields}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`font-orbitron font-black text-lg ${isWinner ? "text-yellow-300" : "text-white"}`}>
                    {(player.score ?? 0).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats row */}
        {showScoreboard && replayCard && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <TrendingUp className="w-5 h-5 text-violet-400 mx-auto mb-1" />
              <div className="text-lg font-orbitron font-black text-white">{replayCard.totalRounds}</div>
              <div className="text-xs text-gray-500">ROUNDS</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">👥</div>
              <div className="text-lg font-orbitron font-black text-white">{replayCard.playerCount}</div>
              <div className="text-xs text-gray-500">PLAYERS</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <Crown className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
              <div className="text-lg font-orbitron font-black text-white">{replayCard.winnerScore?.toLocaleString()}</div>
              <div className="text-xs text-gray-500">TOP SCORE</div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {showScoreboard && (
          <div className="flex flex-col gap-3">
            {shareToken && (
              <button
                onClick={() => navigate(`/replay/${shareToken}`)}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-orbitron font-bold text-sm bg-white/10 hover:bg-white/15 border border-white/20 transition-all active:scale-95"
              >
                VIEW REPLAY CARD
              </button>
            )}
            <Button
              onClick={handleShare}
              className="w-full h-12 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 font-orbitron font-bold border-0 rounded-xl"
            >
              <Share2 className="w-4 h-4 mr-2" />
              {copied ? "✓ LINK COPIED!" : shareToken ? "SHARE REPLAY CARD" : "SHARE RESULTS"}
            </Button>
            <Button
              onClick={handlePlayAgain}
              variant="outline"
              className="w-full h-12 font-orbitron font-bold rounded-xl border-white/20 bg-white/5 hover:bg-white/10 text-white"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              PLAY AGAIN
            </Button>
            {/* Part 7: Invite Friends CTA */}
            <div className="mt-2 p-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 text-center">
              <div className="text-xs font-orbitron text-gray-400 mb-2">WANT MORE CHAOS?</div>
              <div className="text-sm font-orbitron text-white font-bold mb-3">Invite friends and play again 🎡</div>
              <button
                onClick={() => {
                  const winnerName = replayCard?.winnerName ?? sortedStats[0]?.name ?? "Someone";
                  const msg = `I just played AI4U Party Wheel and ${winnerName} destroyed everyone 🎡💀\n\nPlay free at https://ai4uparty.manus.space`;
                  if (navigator.share) {
                    navigator.share({ title: "AI4U Party Wheel", text: msg }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(msg).then(() => {
                      const el = document.createElement("textarea");
                      el.value = msg;
                      document.body.appendChild(el);
                      el.select();
                      document.execCommand("copy");
                      document.body.removeChild(el);
                    }).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  }
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 font-orbitron font-bold text-sm text-white hover:opacity-90 transition-opacity"
              >
                📱 INVITE FRIENDS
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {roomQuery.isLoading && (
          <div className="text-center text-gray-500 font-orbitron text-sm animate-pulse">
            LOADING RESULTS...
          </div>
        )}

        {/* Copyright footer */}
        <CopyrightFooter />
      </div>
    </div>
  );
}
