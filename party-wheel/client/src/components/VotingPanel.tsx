import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle } from "lucide-react";

interface VoteOption {
  id: string;
  label: string;
}

interface VotingPanelProps {
  options: VoteOption[];
  onVote: (choice: string) => void;
  voteCounts?: Record<string, number>;
  totalVoters?: number;
  myVote?: string;
  timeLeft?: number;
  title?: string;
}

export default function VotingPanel({
  options,
  onVote,
  voteCounts = {},
  totalVoters = 0,
  myVote,
  timeLeft,
  title = "CROWD VOTE",
}: VotingPanelProps) {
  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const hasVoted = !!myVote;

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-bold font-orbitron text-violet-300">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {timeLeft !== undefined && (
            <span className={`text-sm font-orbitron font-bold ${timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-gray-400"}`}>
              {timeLeft}s
            </span>
          )}
          <span className="text-xs text-gray-500">{totalVotes}/{totalVoters} voted</span>
        </div>
      </div>

      {/* Vote options */}
      <div className="space-y-2">
        {options.map((opt) => {
          const count = voteCounts[opt.id] ?? 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isMyChoice = myVote === opt.id;

          return (
            <button
              key={opt.id}
              onClick={() => !hasVoted && onVote(opt.id)}
              disabled={hasVoted}
              className={`
                relative w-full text-left p-3 rounded-xl border transition-all duration-200 overflow-hidden
                ${isMyChoice
                  ? "border-violet-400/60 bg-violet-900/40"
                  : hasVoted
                  ? "border-white/10 bg-white/5 cursor-default"
                  : "border-white/10 bg-white/5 hover:border-violet-400/40 hover:bg-white/10 cursor-pointer"
                }
              `}
            >
              {/* Progress bar background */}
              {hasVoted && (
                <div
                  className="absolute inset-0 bg-violet-600/20 rounded-xl transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              )}

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isMyChoice && <CheckCircle className="w-4 h-4 text-violet-400 flex-shrink-0" />}
                  <span className={`text-sm font-medium ${isMyChoice ? "text-white" : "text-gray-300"}`}>
                    {opt.label}
                  </span>
                </div>
                {hasVoted && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{count} votes</span>
                    <span className="text-xs font-bold font-orbitron text-violet-300">{pct}%</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {!hasVoted && (
        <p className="text-center text-xs text-gray-500">Tap to cast your vote</p>
      )}
      {hasVoted && (
        <p className="text-center text-xs text-violet-400">✓ Vote cast — waiting for others...</p>
      )}
    </div>
  );
}
