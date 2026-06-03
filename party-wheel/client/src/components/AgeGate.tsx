import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle } from "lucide-react";

interface AgeGateProps {
  onConfirm: () => void;
}

export default function AgeGate({ onConfirm }: AgeGateProps) {
  const [denied, setDenied] = useState(false);

  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center space-y-4 p-8">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto" />
          <h2 className="text-2xl font-bold text-white font-orbitron">Access Denied</h2>
          <p className="text-gray-400">You must be 18 or older to access this content.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />

      {/* Glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 text-center space-y-8 p-8 max-w-md mx-auto">
        {/* Logo */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-3">
            <Shield className="w-10 h-10 text-violet-400" />
            <span className="text-4xl font-black font-orbitron bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              AI4U
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white font-orbitron tracking-wider">
            Party Wheel
          </h1>
          <p className="text-violet-300 text-sm tracking-widest uppercase">Glitch After Dark</p>
        </div>

        {/* Age gate card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6 shadow-2xl shadow-violet-900/30">
          <div className="space-y-2">
            <div className="text-6xl font-black font-orbitron text-white">18+</div>
            <p className="text-gray-300 text-lg">This content is intended for adults only.</p>
            <p className="text-gray-500 text-sm">By entering, you confirm you are 18 years of age or older.</p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={onConfirm}
              className="w-full h-14 text-lg font-bold font-orbitron bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 border-0 rounded-xl shadow-lg shadow-violet-900/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              I AM 18+ — ENTER
            </Button>
            <Button
              variant="outline"
              onClick={() => setDenied(true)}
              className="w-full h-12 text-gray-400 border-white/10 bg-transparent hover:bg-white/5 rounded-xl"
            >
              I am under 18 — Exit
            </Button>
          </div>
        </div>

        <p className="text-gray-600 text-xs">
          AI4U Party Wheel contains mature themes, adult humor, and party game content.
        </p>
      </div>
    </div>
  );
}
