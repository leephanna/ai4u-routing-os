import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { AVATAR_CONFIGS } from "@/components/AvatarCard";
import { Trophy, Share2, Crown, Zap, Shield, ArrowLeft, Calendar } from "lucide-react";
import { useState } from "react";

export default function ReplayCard() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);

  const replayQuery = trpc.replay.get.useQuery(
    { shareToken: token ?? "" },
    { enabled: !!token, retry: false }
  );

  const card = replayQuery.data;

  // Parse player stats
  const playerStats: Array<{ name: string | null; score: number | null; streak: number | null; shields: number | null }> =
    card?.statsJson
      ? (typeof card.statsJson === "string"
          ? JSON.parse(card.statsJson)
          : card.statsJson) as Array<{ name: string | null; score: number | null; streak: number | null; shields: number | null }>
      : [];

  const sortedStats = [...playerStats].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  };

  const getRankEmoji = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  const getAvatarConfig = (index: number) => {
    return AVATAR_CONFIGS[index % AVATAR_CONFIGS.length];
  };

  if (replayQuery.isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-violet-400 font-orbitron animate-pulse text-sm">LOADING REPLAY...</div>
      </div>
    );
  }

  if (replayQuery.isError || !card) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 font-orbitron text-sm">REPLAY NOT FOUND</div>
        <button
          onClick={() => navigate("/")}
          className="text-gray-500 hover:text-white font-orbitron text-xs transition-colors"
        >
          ← BACK TO HOME
        </button>
      </div>
    );
  }

  const createdAt = card.createdAt ? new Date(card.createdAt).toLocaleDateString() : "";

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-violet-950/30 via-black to-black" />

      {/* Glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-gray-500 hover:text-white font-orbitron text-xs transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> HOME
          </button>
          {createdAt && (
            <div className="flex items-center gap-1 text-gray-600 text-xs font-orbitron">
              <Calendar className="w-3 h-3" /> {createdAt}
            </div>
          )}
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border border-violet-500/30 rounded-full px-4 py-1 mb-3">
            <span className="text-xs font-orbitron text-violet-300">AI4U PARTY WHEEL</span>
          </div>
          <h1 className="text-2xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-violet-400 to-cyan-400">
            REPLAY CARD
          </h1>
        </div>

        {/* Winner card */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-violet-500/20 to-cyan-500/20 rounded-2xl blur-xl" />
          <div className="relative bg-gradient-to-br from-yellow-950/60 via-violet-950/60 to-cyan-950/60 border border-yellow-500/30 rounded-2xl p-6 text-center">
            <Crown className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
            <div className="text-xs font-orbitron text-yellow-400/70 mb-1 tracking-widest">WINNER</div>
            <div className="text-3xl font-orbitron font-black text-yellow-300 mb-1">
              {card.winnerName}
            </div>
            <div className="text-4xl font-orbitron font-black text-white mb-3">
              {(card.winnerScore ?? 0).toLocaleString()}
              <span className="text-yellow-400/70 text-xl ml-2">pts</span>
            </div>
            {card.funnySummary && (
              <div className="bg-black/30 rounded-xl p-3 border border-white/10">
                <p className="text-sm text-gray-300 italic leading-relaxed">
                  "{card.funnySummary}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Game stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl mb-1">🎮</div>
            <div className="text-xl font-orbitron font-black text-white">{card.totalRounds}</div>
            <div className="text-xs text-gray-500 font-orbitron">ROUNDS</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-2xl mb-1">👥</div>
            <div className="text-xl font-orbitron font-black text-white">{card.playerCount}</div>
            <div className="text-xs text-gray-500 font-orbitron">PLAYERS</div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
            <div className="text-xl font-orbitron font-black text-white">{(card.winnerScore ?? 0).toLocaleString()}</div>
            <div className="text-xs text-gray-500 font-orbitron">TOP SCORE</div>
          </div>
        </div>

        {/* Player standings */}
        {sortedStats.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-orbitron text-gray-500 uppercase tracking-widest">Final Standings</h2>
            {sortedStats.map((player, index) => {
              const avatarCfg = getAvatarConfig(index);
              const isWinner = index === 0;
              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    isWinner
                      ? "bg-yellow-950/30 border-yellow-500/30"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="text-xl w-8 text-center font-bold">{getRankEmoji(index)}</div>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 bg-gradient-to-br ${avatarCfg?.color ?? "from-violet-600 to-indigo-600"}`}
                  >
                    {avatarCfg?.emoji ?? "🤖"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-orbitron font-bold text-sm truncate ${isWinner ? "text-yellow-300" : "text-white"}`}>
                      {player.name ?? "Player"}
                    </div>
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

        {/* Share button */}
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-orbitron font-bold text-sm bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 transition-all active:scale-95 shadow-lg shadow-violet-900/30"
        >
          <Share2 className="w-4 h-4" />
          {copied ? "LINK COPIED! 🎉" : "SHARE THIS REPLAY"}
        </button>

        {/* Play again CTA */}
        <button
          onClick={() => navigate("/")}
          className="text-center text-gray-600 hover:text-gray-400 font-orbitron text-xs transition-colors"
        >
          PLAY YOUR OWN GAME →
        </button>

        {/* Watermark */}
        <div className="text-center text-gray-700 text-xs font-orbitron pb-4">
          AI4U PARTY WHEEL: GLITCH AFTER DARK
        </div>
      </div>
    </div>
  );
}
