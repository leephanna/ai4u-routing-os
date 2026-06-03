/**
 * TruthResponsePanel — v13 Interaction Contract
 *
 * Active player:
 *   1. Sees the truth question.
 *   2. Types their answer in a text box.
 *   3. Submits → answer saved via trpc.challenge.submitResponse.
 *   4. After submission, sees "Waiting for crowd to vote…"
 *
 * Passive players:
 *   - Before answer submitted: "Waiting for [name] to answer…"
 *   - After answer submitted: see the answer text + YES / NO vote buttons.
 *
 * Voting choices: YES / NO only (never Option A / Option B).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { MessageSquare, CheckCircle, Clock } from "lucide-react";

interface TruthResponsePanelProps {
  roomId: number;
  gameEventId: number;
  myPlayerId: number | null;
  activePlayerId: number;
  content: string;           // The truth prompt
  isActive: boolean;         // Is this the active player?
  playerName: string;        // Active player's display name
  submittedAnswer?: string;  // Once submitted, show it (from challenge_responses)
  voteCounts?: Record<string, number>;
  totalVoters?: number;
  myVote?: string;
  onVote?: (choice: "yes" | "no") => void;
  timeLeft?: number;
  phase: "result" | "voting" | "answer_submission";
}

export default function TruthResponsePanel({
  roomId,
  gameEventId,
  myPlayerId,
  content,
  isActive,
  playerName,
  submittedAnswer,
  voteCounts = {},
  totalVoters = 0,
  myVote,
  onVote,
  timeLeft,
  phase,
}: TruthResponsePanelProps) {
  const [answer, setAnswer] = useState("");
  const [localSubmitted, setLocalSubmitted] = useState(false);

  const submitMutation = trpc.challenge.submitResponse.useMutation({
    onSuccess: () => setLocalSubmitted(true),
  });

  const handleSubmit = () => {
    if (!answer.trim() || !myPlayerId || submitMutation.isPending) return;
    submitMutation.mutate({
      roomId,
      gameEventId,
      playerId: myPlayerId,
      segmentType: "truth_cache",
      responseType: "truth_answer",
      textResponse: answer.trim(),
    });
  };

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const yesCount = voteCounts["yes"] ?? 0;
  const noCount = voteCounts["no"] ?? 0;
  const yesPct = totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 0;
  const noPct = totalVotes > 0 ? Math.round((noCount / totalVotes) * 100) : 0;

  // The answer to display: from server (submittedAnswer) or local optimistic state
  const displayAnswer = submittedAnswer ?? (localSubmitted ? answer : undefined);
  const hasSubmitted = !!displayAnswer;

  return (
    <div className="space-y-3">
      {/* Truth prompt */}
      <div className="bg-pink-950/40 border border-pink-500/30 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-pink-400" />
          <span className="text-xs font-orbitron text-pink-400 font-bold">TRUTH CACHE</span>
        </div>
        <div className="text-sm text-white font-semibold leading-snug">{content}</div>
      </div>

      {/* Active player: answer input */}
      {isActive && !hasSubmitted && (
        <div className="space-y-2">
          <div className="text-xs font-orbitron text-gray-400">YOUR ANSWER:</div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your truth here..."
            maxLength={300}
            rows={3}
            className="w-full bg-black/50 border border-pink-500/30 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-pink-400 transition-colors resize-none"
          />
          <Button
            onClick={handleSubmit}
            disabled={!answer.trim() || submitMutation.isPending}
            className="w-full h-10 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 font-orbitron font-bold border-0 rounded-xl text-sm"
          >
            {submitMutation.isPending ? "SUBMITTING…" : "SUBMIT TRUTH"}
          </Button>
        </div>
      )}

      {/* Active player: waiting after submit */}
      {isActive && hasSubmitted && phase !== "voting" && (
        <div className="bg-black/40 border border-pink-400/30 rounded-xl p-3 text-center">
          <p className="text-xs font-orbitron text-pink-400 mb-1">YOUR ANSWER</p>
          <p className="text-sm text-white italic">"{displayAnswer}"</p>
          <p className="text-xs text-gray-500 mt-2 animate-pulse">Waiting for the crowd to vote…</p>
        </div>
      )}

      {/* Passive player: waiting for answer */}
      {!isActive && !hasSubmitted && (
        <div className="flex items-center gap-2 text-sm text-gray-500 font-orbitron py-2">
          <Clock className="w-4 h-4 animate-pulse" />
          Waiting for {playerName} to answer...
        </div>
      )}

      {/* Submitted answer — visible to all once submitted */}
      {hasSubmitted && (!isActive || phase === "voting") && (
        <div className="bg-black/40 border border-pink-400/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-pink-400" />
            <span className="text-xs font-orbitron text-pink-400">{playerName}'s answer:</span>
          </div>
          <div className="text-sm text-white italic leading-snug">"{displayAnswer}"</div>
        </div>
      )}

      {/* Crowd vote — YES / NO only */}
      {phase === "voting" && hasSubmitted && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-orbitron text-yellow-400">DID THEY TELL THE TRUTH?</span>
            {timeLeft !== undefined && (
              <span className={`text-xs font-orbitron font-bold ${timeLeft <= 10 ? "text-red-400 animate-pulse" : "text-gray-400"}`}>
                ⏱ {timeLeft}s
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["yes", "no"] as const).map((choice) => {
              const count = choice === "yes" ? yesCount : noCount;
              const pct = choice === "yes" ? yesPct : noPct;
              const isMyChoice = myVote === choice;
              const hasVoted = !!myVote;
              return (
                <button
                  key={choice}
                  onClick={() => !hasVoted && onVote?.(choice)}
                  disabled={hasVoted}
                  className={`relative overflow-hidden rounded-xl p-3 border transition-all ${
                    isMyChoice
                      ? "border-yellow-400/60 bg-yellow-900/40"
                      : hasVoted
                      ? "border-white/10 bg-white/5 cursor-default"
                      : "border-white/10 bg-white/5 hover:border-yellow-400/40 cursor-pointer"
                  }`}
                >
                  {hasVoted && (
                    <div
                      className="absolute inset-0 bg-yellow-600/20 rounded-xl transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  )}
                  <div className="relative text-center">
                    <div className="text-lg">{choice === "yes" ? "✅" : "❌"}</div>
                    <div className={`text-xs font-orbitron font-bold ${isMyChoice ? "text-yellow-300" : "text-gray-300"}`}>
                      {choice.toUpperCase()}
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
            <p className="text-center text-xs text-gray-500">Did {playerName} really tell the truth?</p>
          )}
          {myVote && (
            <p className="text-center text-xs text-yellow-400">✓ Voted — waiting for others... ({totalVotes}/{totalVoters})</p>
          )}
        </div>
      )}
    </div>
  );
}
