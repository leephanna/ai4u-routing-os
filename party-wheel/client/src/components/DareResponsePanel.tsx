/**
 * DareResponsePanel — v13 Interaction Contract
 *
 * Active player:
 *   1. Sees the dare challenge text.
 *   2. Chooses ACCEPT or SKIP.
 *   3. Choice submitted via trpc.challenge.submitResponse.
 *      - SKIP → server immediately sets phase to "result" (no voting).
 *      - ACCEPT → server keeps phase in "voting" with PASS / FAIL choices.
 *
 * Passive players:
 *   - Before choice: "Waiting for [name] to decide…"
 *   - After ACCEPT: PASS / FAIL vote buttons.
 *   - After SKIP: "Skipped — no vote needed."
 *
 * Voting choices: PASS / FAIL only (never Option A / Option B).
 */
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Zap, Clock, CheckCircle } from "lucide-react";

interface DareResponsePanelProps {
  roomId: number;
  gameEventId: number;
  myPlayerId: number | null;
  activePlayerId: number;
  content: string;
  isActive: boolean;
  playerName: string;
  /** From challenge_responses: "dare_accept" | "dare_skip" | undefined */
  dareChoice?: string;
  voteCounts?: Record<string, number>;
  totalVoters?: number;
  myVote?: string;
  onVote?: (choice: "pass" | "fail") => void;
  timeLeft?: number;
  phase: "result" | "voting" | "answer_submission";
}

export default function DareResponsePanel({
  roomId,
  gameEventId,
  myPlayerId,
  content,
  isActive,
  playerName,
  dareChoice,
  voteCounts = {},
  totalVoters = 0,
  myVote,
  onVote,
  timeLeft,
  phase,
}: DareResponsePanelProps) {
  const submitMutation = trpc.challenge.submitResponse.useMutation();

  const handleAccept = () => {
    if (!myPlayerId || submitMutation.isPending) return;
    submitMutation.mutate({
      roomId,
      gameEventId,
      playerId: myPlayerId,
      segmentType: "glitch_dare",
      responseType: "dare_accept",
    });
  };

  const handleSkip = () => {
    if (!myPlayerId || submitMutation.isPending) return;
    submitMutation.mutate({
      roomId,
      gameEventId,
      playerId: myPlayerId,
      segmentType: "glitch_dare",
      responseType: "dare_skip",
    });
  };

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const passCount = voteCounts["pass"] ?? 0;
  const failCount = voteCounts["fail"] ?? 0;
  const passPct = totalVotes > 0 ? Math.round((passCount / totalVotes) * 100) : 0;
  const failPct = totalVotes > 0 ? Math.round((failCount / totalVotes) * 100) : 0;

  const accepted = dareChoice === "dare_accept";
  const skipped = dareChoice === "dare_skip";
  const hasChosen = accepted || skipped;

  // Fallback for result phase with no dareChoice
  if (phase === "result" && !dareChoice && !isActive) {
    return (
      <div className="text-center text-sm font-orbitron text-gray-500 py-4">
        Challenge complete. Waiting for next turn...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Dare challenge */}
      <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-orbitron text-amber-400 font-bold">GLITCH DARE</span>
        </div>
        <div className="text-sm text-white font-semibold leading-snug">{content}</div>
      </div>

      {/* Active player: choose to accept or skip */}
      {isActive && !hasChosen && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleAccept}
            disabled={submitMutation.isPending}
            className="h-12 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 font-orbitron font-bold border-0 rounded-xl text-sm"
          >
            ⚡ ACCEPT
          </Button>
          <Button
            onClick={handleSkip}
            disabled={submitMutation.isPending}
            variant="outline"
            className="h-12 border-white/20 text-gray-400 hover:text-white bg-transparent font-orbitron font-bold rounded-xl text-sm"
          >
            🐔 SKIP
          </Button>
        </div>
      )}

      {/* Passive player: waiting for choice */}
      {!isActive && !hasChosen && (
        <div className="flex items-center gap-2 text-sm text-gray-500 font-orbitron py-2">
          <Clock className="w-4 h-4 animate-pulse" />
          Waiting for {playerName} to decide...
        </div>
      )}

      {/* Choice revealed */}
      {hasChosen && (
        <div className={`flex items-center gap-2 rounded-xl p-3 border ${
          accepted ? "bg-amber-900/30 border-amber-500/30" : "bg-gray-900/40 border-gray-600/30"
        }`}>
          <CheckCircle className={`w-4 h-4 ${accepted ? "text-amber-400" : "text-gray-500"}`} />
          <span className={`text-sm font-orbitron font-bold ${accepted ? "text-amber-300" : "text-gray-400"}`}>
            {playerName} {accepted ? "ACCEPTED the dare!" : "SKIPPED 🐔"}
          </span>
        </div>
      )}

      {/* Skipped — no voting */}
      {skipped && (
        <p className="text-center text-xs text-gray-500">No vote — dare was skipped.</p>
      )}

      {/* Crowd vote — PASS / FAIL only (only if accepted) */}
      {phase === "voting" && accepted && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-orbitron text-amber-400">DID THEY COMPLETE IT?</span>
            {timeLeft !== undefined && (
              <span className={`text-xs font-orbitron font-bold ${timeLeft <= 10 ? "text-red-400 animate-pulse" : "text-gray-400"}`}>
                ⏱ {timeLeft}s
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["pass", "fail"] as const).map((voteChoice) => {
              const count = voteChoice === "pass" ? passCount : failCount;
              const pct = voteChoice === "pass" ? passPct : failPct;
              const isMyChoice = myVote === voteChoice;
              const hasVoted = !!myVote;
              return (
                <button
                  key={voteChoice}
                  onClick={() => !hasVoted && onVote?.(voteChoice)}
                  disabled={hasVoted}
                  className={`relative overflow-hidden rounded-xl p-3 border transition-all ${
                    isMyChoice
                      ? "border-amber-400/60 bg-amber-900/40"
                      : hasVoted
                      ? "border-white/10 bg-white/5 cursor-default"
                      : "border-white/10 bg-white/5 hover:border-amber-400/40 cursor-pointer"
                  }`}
                >
                  {hasVoted && (
                    <div
                      className="absolute inset-0 bg-amber-600/20 rounded-xl transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  )}
                  <div className="relative text-center">
                    <div className="text-lg">{voteChoice === "pass" ? "🏆" : "💀"}</div>
                    <div className={`text-xs font-orbitron font-bold ${isMyChoice ? "text-amber-300" : "text-gray-300"}`}>
                      {voteChoice === "pass" ? "PASS ✓" : "FAIL ✗"}
                    </div>
                    {hasVoted && (
                      <div className="text-xs text-gray-400">{count} · {pct}%</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {!myVote && (
            <p className="text-center text-xs text-gray-500">Did {playerName} actually do it?</p>
          )}
          {myVote && (
            <p className="text-center text-xs text-amber-400">✓ Voted — waiting for others... ({totalVotes}/{totalVoters})</p>
          )}
        </div>
      )}
    </div>
  );
}
