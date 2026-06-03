/**
 * DuelResponsePanel — v13 Interaction Contract
 *
 * Active player AND opponent:
 *   1. Both see the duel prompt.
 *   2. Both type their answer in a text box.
 *   3. Both submit via trpc.challenge.submitResponse (responseType: "duel_answer").
 *   4. After both submit, all players see BOTH answer texts side by side.
 *
 * Passive players:
 *   - While answers pending: "Waiting for players to answer…"
 *   - After both submitted: see both answer texts.
 *
 * Voting:
 *   - Vote buttons show ACTUAL answer text, not just player names.
 *   - Vote IDs: "player_a" (active player) / "player_b" (opponent).
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Swords, Clock } from "lucide-react";

interface DuelResponsePanelProps {
  roomId: number;
  gameEventId: number;
  myPlayerId: number | null;
  activePlayerId: number;
  content: string;
  isActive: boolean;
  isDuelOpponent: boolean;
  activeName: string;
  opponentName: string;
  /** From challenge_responses: active player's submitted answer */
  activeAnswer?: string;
  /** From challenge_responses: opponent's submitted answer */
  opponentAnswer?: string;
  voteCounts?: Record<string, number>;
  totalVoters?: number;
  myVote?: string;
  onVote?: (choice: "player_a" | "player_b") => void;
  timeLeft?: number;
  phase: "result" | "voting" | "answer_submission";
}

export default function DuelResponsePanel({
  roomId,
  gameEventId,
  myPlayerId,
  content,
  isActive,
  isDuelOpponent,
  activeName,
  opponentName,
  activeAnswer,
  opponentAnswer,
  voteCounts = {},
  totalVoters = 0,
  myVote,
  onVote,
  timeLeft,
  phase,
}: DuelResponsePanelProps) {
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
      segmentType: "prompt_duel",
      responseType: "duel_answer",
      textResponse: answer.trim(),
    });
  };

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const aCount = voteCounts["player_a"] ?? 0;
  const bCount = voteCounts["player_b"] ?? 0;
  const aPct = totalVotes > 0 ? Math.round((aCount / totalVotes) * 100) : 0;
  const bPct = totalVotes > 0 ? Math.round((bCount / totalVotes) * 100) : 0;

  // Determine my submitted answer (optimistic or from server)
  const myLocalAnswer = localSubmitted ? answer : undefined;
  const myServerAnswer = isActive ? activeAnswer : isDuelOpponent ? opponentAnswer : undefined;
  const hasSubmitted = !!(myServerAnswer ?? myLocalAnswer);
  const canSubmit = (isActive || isDuelOpponent) && !hasSubmitted;

  const bothAnswered = !!(activeAnswer && opponentAnswer);

  return (
    <div className="space-y-3">
      {/* Duel prompt */}
      <div className="bg-green-950/40 border border-green-500/30 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Swords className="w-3.5 h-3.5 text-green-400" />
          <span className="text-xs font-orbitron text-green-400 font-bold">PROMPT DUEL</span>
          <span className="text-xs text-gray-500 ml-auto">{activeName} vs {opponentName}</span>
        </div>
        <div className="text-sm text-white font-semibold leading-snug">{content}</div>
      </div>

      {/* Input for active player or opponent */}
      {canSubmit && (
        <div className="space-y-2">
          <div className="text-xs font-orbitron text-gray-400">
            YOUR ANSWER ({isActive ? activeName : opponentName}):
          </div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer..."
            maxLength={300}
            rows={3}
            className="w-full bg-black/50 border border-green-500/30 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-400 transition-colors resize-none"
          />
          <Button
            onClick={handleSubmit}
            disabled={!answer.trim() || submitMutation.isPending}
            className="w-full h-10 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 font-orbitron font-bold border-0 rounded-xl text-sm"
          >
            {submitMutation.isPending ? "SUBMITTING…" : "SUBMIT ANSWER"}
          </Button>
        </div>
      )}

      {/* Active/opponent: submitted, waiting for other side */}
      {hasSubmitted && !bothAnswered && (
        <div className="bg-black/40 border border-green-400/30 rounded-xl p-3 text-center">
          <p className="text-xs font-orbitron text-green-400 mb-1">YOUR ANSWER</p>
          <p className="text-sm text-white italic">"{myServerAnswer ?? myLocalAnswer}"</p>
          <p className="text-xs text-gray-500 mt-2 animate-pulse">Waiting for the other player…</p>
        </div>
      )}

      {/* Passive player: waiting for both answers */}
      {!isActive && !isDuelOpponent && !bothAnswered && (
        <div className="flex items-center gap-2 text-sm text-gray-500 font-orbitron py-2">
          <Clock className="w-4 h-4 animate-pulse" />
          Waiting for players to answer...
        </div>
      )}

      {/* Both answers side by side — shown to everyone once both submitted */}
      {(activeAnswer || opponentAnswer) && (
        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-xl p-2.5 border ${activeAnswer ? "bg-green-950/30 border-green-500/30" : "bg-white/5 border-white/10"}`}>
            <div className="text-xs font-orbitron text-green-400 mb-1">{activeName}</div>
            {activeAnswer
              ? <div className="text-xs text-white italic">"{activeAnswer}"</div>
              : <div className="text-xs text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3 animate-pulse" /> Typing...</div>
            }
          </div>
          <div className={`rounded-xl p-2.5 border ${opponentAnswer ? "bg-blue-950/30 border-blue-500/30" : "bg-white/5 border-white/10"}`}>
            <div className="text-xs font-orbitron text-blue-400 mb-1">{opponentName}</div>
            {opponentAnswer
              ? <div className="text-xs text-white italic">"{opponentAnswer}"</div>
              : <div className="text-xs text-gray-600 flex items-center gap-1"><Clock className="w-3 h-3 animate-pulse" /> Typing...</div>
            }
          </div>
        </div>
      )}

      {/* Crowd vote — shows ACTUAL answer text, IDs are player_a / player_b */}
      {phase === "voting" && (activeAnswer || opponentAnswer) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-orbitron text-green-400">WHOSE ANSWER WAS BETTER?</span>
            {timeLeft !== undefined && (
              <span className={`text-xs font-orbitron font-bold ${timeLeft <= 10 ? "text-red-400 animate-pulse" : "text-gray-400"}`}>
                ⏱ {timeLeft}s
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["player_a", "player_b"] as const).map((voteChoice) => {
              const isA = voteChoice === "player_a";
              const count = isA ? aCount : bCount;
              const pct = isA ? aPct : bPct;
              const isMyChoice = myVote === voteChoice;
              const hasVoted = !!myVote;
              const name = isA ? activeName : opponentName;
              const answerText = isA ? activeAnswer : opponentAnswer;
              return (
                <button
                  key={voteChoice}
                  onClick={() => !hasVoted && onVote?.(voteChoice)}
                  disabled={hasVoted}
                  className={`relative overflow-hidden rounded-xl p-3 border transition-all text-left ${
                    isMyChoice
                      ? "border-green-400/60 bg-green-900/40"
                      : hasVoted
                      ? "border-white/10 bg-white/5 cursor-default"
                      : "border-white/10 bg-white/5 hover:border-green-400/40 cursor-pointer"
                  }`}
                >
                  {hasVoted && (
                    <div
                      className="absolute inset-0 bg-green-600/20 rounded-xl transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  )}
                  <div className="relative">
                    <div className="text-xs font-orbitron font-bold text-gray-300 mb-1">{name}</div>
                    {answerText && (
                      <div className="text-xs text-white/80 italic leading-snug">"{answerText}"</div>
                    )}
                    {hasVoted && (
                      <div className="text-xs text-gray-400 mt-1">{count} vote{count !== 1 ? "s" : ""} · {pct}%</div>
                    )}
                    {isMyChoice && <div className="text-xs text-green-300 mt-0.5">✓ Your vote</div>}
                  </div>
                </button>
              );
            })}
          </div>
          {!myVote && (
            <p className="text-center text-xs text-gray-500">Vote for the best answer!</p>
          )}
          {myVote && (
            <p className="text-center text-xs text-green-400">✓ Voted — waiting for others... ({totalVotes}/{totalVoters})</p>
          )}
        </div>
      )}
    </div>
  );
}
