import { useState } from "react";

interface TriviaPanelProps {
  content: string; // formatted as "Q: ...\nA) ...\nB) ...\nC) ...\nD) ...\nAnswer: X"
  isActive: boolean; // only active player can answer
}

interface ParsedTrivia {
  question: string;
  options: { key: string; text: string }[];
  answer: string;
}

function parseTrivia(content: string): ParsedTrivia {
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean);
  const question = lines.find(l => l.startsWith("Q:"))?.replace(/^Q:\s*/, "") ?? content;
  const options: { key: string; text: string }[] = [];
  for (const key of ["A", "B", "C", "D"]) {
    const line = lines.find(l => l.startsWith(`${key})`));
    if (line) {
      options.push({ key, text: line.replace(/^[A-D]\)\s*/, "") });
    }
  }
  const answerLine = lines.find(l => l.toLowerCase().startsWith("answer:"));
  const answer = answerLine?.replace(/^answer:\s*/i, "").trim().charAt(0).toUpperCase() ?? "";
  return { question, options, answer };
}

export default function TriviaPanel({ content, isActive }: TriviaPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const trivia = parseTrivia(content);

  // If we can't parse 4 options, just show raw content
  if (trivia.options.length < 2) {
    return (
      <div className="text-white/90 text-base leading-relaxed italic border-l-4 border-cyan-500 pl-4 py-2">
        {content}
      </div>
    );
  }

  function handleSelect(key: string) {
    if (selected) return; // already answered
    setSelected(key);
  }

  function getButtonStyle(key: string): string {
    if (!selected) {
      return "bg-white/10 border border-white/20 text-white hover:bg-white/20 active:scale-95";
    }
    if (key === trivia.answer) {
      return "bg-green-500/30 border border-green-400 text-green-300";
    }
    if (key === selected && key !== trivia.answer) {
      return "bg-red-500/30 border border-red-400 text-red-300";
    }
    return "bg-white/5 border border-white/10 text-white/40";
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Question */}
      <div className="text-white font-semibold text-base leading-snug">
        {trivia.question}
      </div>

      {/* Answer grid */}
      <div className="grid grid-cols-2 gap-2">
        {trivia.options.map(opt => (
          <button
            key={opt.key}
            onClick={() => handleSelect(opt.key)}
            disabled={!!selected || !isActive}
            className={`
              min-h-[56px] rounded-xl px-3 py-2 text-sm font-semibold text-left
              transition-all duration-200 cursor-pointer
              ${getButtonStyle(opt.key)}
              ${!isActive && !selected ? "opacity-60 cursor-not-allowed" : ""}
            `}
          >
            <span className="font-orbitron text-xs opacity-60 mr-1">{opt.key})</span>
            {opt.text}
          </button>
        ))}
      </div>

      {/* Result feedback */}
      {selected && (
        <div className={`text-center text-sm font-bold font-orbitron py-1 ${selected === trivia.answer ? "text-green-400" : "text-red-400"}`}>
          {selected === trivia.answer
            ? "✓ CORRECT! Points awarded!"
            : `✗ WRONG — correct answer: ${trivia.answer}`}
        </div>
      )}

      {!isActive && !selected && (
        <div className="text-center text-xs text-gray-500 italic">
          Waiting for active player to answer...
        </div>
      )}
    </div>
  );
}
