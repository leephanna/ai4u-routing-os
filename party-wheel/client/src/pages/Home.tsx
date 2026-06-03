import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { AVATAR_CONFIGS } from "@/components/AvatarCard";
import AgeGate from "@/components/AgeGate";
import { Zap, Users, Plus, ArrowRight, Loader2, Shield, ExternalLink, Bot } from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import WheelPreview from "@/components/WheelPreview";

/** Phase A: Generate or retrieve a persistent guest session ID from localStorage */
function getOrCreateGuestSessionId(): string {
  const key = "ai4u_guest_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = nanoid(24);
    localStorage.setItem(key, id);
  }
  return id;
}

const WHEEL_IMAGE =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663029491972/ZMnvJNTTjnmfJ7Sacrr6SU/party-wheel-hero-FptGoy6r3a3f6ryGopFEno.webp";

const INTENSITY_OPTIONS = [
  {
    value: "house_party" as const,
    label: "House Party",
    desc: "Fun & family-friendly",
    emoji: "🎉",
    color: "from-green-600 to-emerald-600",
    border: "border-green-500/40",
  },
  {
    value: "after_dark" as const,
    label: "After Dark",
    desc: "Adults only, edgy",
    emoji: "🌙",
    color: "from-violet-600 to-purple-600",
    border: "border-violet-500/40",
  },
  {
    value: "chaos_mode" as const,
    label: "Chaos Mode",
    desc: "Wildly unhinged",
    emoji: "💀",
    color: "from-red-600 to-orange-600",
    border: "border-red-500/40",
  },
];

export default function Home() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [ageVerified, setAgeVerified] = useState(() => {
    return localStorage.getItem("age_verified") === "true";
  });

  const [hostName, setHostName] = useState(user?.name ?? "");
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [intensity, setIntensity] = useState<"house_party" | "after_dark" | "chaos_mode">("house_party");
  const [showCreate, setShowCreate] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState(user?.name ?? "");
  const [joinAvatar, setJoinAvatar] = useState(3);
  const [showJoin, setShowJoin] = useState(false);
  // Phase A: guest join state (for unauthenticated users)
  const [guestJoinCode, setGuestJoinCode] = useState("");
  const [guestJoinName, setGuestJoinName] = useState("");
  const [guestJoinAvatar, setGuestJoinAvatar] = useState(0);
  const [showGuestJoin, setShowGuestJoin] = useState(false);

  const createRoom = trpc.room.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Room ${data.code} created!`);
      navigate(`/room/${data.code}`);
    },
    onError: (err) => toast.error(err.message ?? "Failed to create room"),
  });
  // Part 1 v13: Atomic solo play — server creates room + bots + starts in one shot
  const createSoloRoom = trpc.game.createSoloRoomAndStart.useMutation({
    onSuccess: (data) => {
      toast.success("Solo game ready! Bots are warming up...");
      navigate(`/room/${data.code}/play`);
    },
    onError: (err) => toast.error(err.message ?? "Failed to start solo game"),
  });

  const joinRoom = trpc.room.join.useMutation({
    onSuccess: (data) => {
      toast.success("Joined room!");
      navigate(`/room/${data.code}`);
    },
    onError: (err) => toast.error(err.message ?? "Failed to join room"),
  });

  const handleGuestJoin = () => {
    if (!guestJoinName.trim()) { toast.error("Enter your name first"); return; }
    if (guestJoinCode.trim().length !== 6) { toast.error("Room code must be 6 characters"); return; }
    const guestSessionId = getOrCreateGuestSessionId();
    joinRoom.mutate({
      code: guestJoinCode.trim().toUpperCase(),
      playerName: guestJoinName.trim(),
      avatarIndex: guestJoinAvatar,
      guestSessionId,
    });
  };

  const handleAgeVerified = () => {
    localStorage.setItem("age_verified", "true");
    setAgeVerified(true);
  };

  if (!ageVerified) return <AgeGate onConfirm={handleAgeVerified} />;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col">
        {/* Cosmic grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/30 via-black to-black" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center flex-1 px-4 pt-10 pb-6">
          {/* Brand header */}
          <div className="flex flex-col items-center gap-1 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-orbitron font-bold text-violet-400 tracking-[0.3em] uppercase">AI4U, LLC</span>
              <span className="text-violet-600">·</span>
              <a href="https://AI4Utech.com" target="_blank" rel="noopener noreferrer"
                className="text-xs font-orbitron text-violet-400/70 hover:text-violet-300 transition-colors flex items-center gap-1">
                AI4Utech.com <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <h1 className="text-5xl sm:text-6xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-cyan-300 to-violet-400 tracking-tight leading-none">
              AI4U PARTY
            </h1>
            <h1 className="text-5xl sm:text-6xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-violet-300 to-cyan-400 tracking-tight leading-none">
              WHEEL
            </h1>
            <div className="mt-2 inline-flex items-center gap-2 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border border-violet-500/30 rounded-full px-4 py-1">
              <span className="text-xs font-orbitron text-violet-300 tracking-[0.2em]">GLITCH AFTER DARK</span>
            </div>
          </div>

          {/* Hero wheel — animated live preview */}
          <div className="relative flex justify-center mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/30 to-cyan-600/30 rounded-full blur-3xl scale-75 animate-pulse" style={{ animationDuration: "4s" }} />
            <div className="relative z-10">
              <WheelPreview size={280} speed={0.35} />
            </div>
          </div>

          {/* Tagline + feature pills */}
          <h2 className="text-lg sm:text-xl font-orbitron font-bold text-center text-cyan-300 mb-2 tracking-wide">
            The AI-Powered Party Game for Adults
          </h2>
          <p className="text-gray-400 text-sm text-center mb-4 max-w-xs">
            The AI-powered party game that spins, roasts, and judges your friends in real time.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {[
              { icon: "🎡", text: "43 wheel segments" },
              { icon: "🤖", text: "AI4U robot attacks" },
              { icon: "🗳️", text: "Group voting" },
              { icon: "🏆", text: "Live scoreboard" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs text-gray-400">
                <span>{f.icon}</span> {f.text}
              </div>
            ))}
          </div>

          {/* Guest join form */}
          {showGuestJoin ? (
            <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-orbitron font-bold text-sm text-cyan-300">JOIN AS GUEST</h2>
                <button onClick={() => setShowGuestJoin(false)} className="text-gray-600 hover:text-gray-400 text-xs font-orbitron">✕ BACK</button>
              </div>
              <div>
                <label className="text-xs font-orbitron text-gray-500 mb-1.5 block">ROOM CODE</label>
                <input type="text" value={guestJoinCode} onChange={(e) => setGuestJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="XXXXXX" maxLength={6}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-lg text-white placeholder-gray-700 focus:outline-none focus:border-cyan-500 transition-colors font-orbitron tracking-widest text-center"
                />
              </div>
              <div>
                <label className="text-xs font-orbitron text-gray-500 mb-1.5 block">YOUR NAME</label>
                <input type="text" value={guestJoinName} onChange={(e) => setGuestJoinName(e.target.value)}
                  placeholder="Enter your name..." maxLength={32}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors font-orbitron"
                />
              </div>
              <div>
                <label className="text-xs font-orbitron text-gray-500 mb-1.5 block">CHOOSE AVATAR</label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_CONFIGS.map((cfg, i) => (
                    <button key={i} onClick={() => setGuestJoinAvatar(i)}
                      className={`aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
                        guestJoinAvatar === i ? `bg-gradient-to-br ${cfg.color} scale-110 shadow-lg` : "bg-white/5 border border-white/10 hover:bg-white/10"
                      }`}>
                      {cfg.emoji}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleGuestJoin} disabled={joinRoom.isPending}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-orbitron font-bold text-sm bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                {joinRoom.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> JOINING...</> : <><ArrowRight className="w-4 h-4" /> JOIN ROOM</>}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full max-w-sm">
              <button onClick={() => setShowGuestJoin(true)}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-orbitron font-bold text-base bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 transition-all shadow-xl shadow-cyan-900/40 active:scale-95">
                <Users className="w-5 h-5" />
                JOIN AS GUEST
              </button>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs font-orbitron text-gray-600">OR</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              {typeof window !== "undefined" && window.location.hostname.includes("ai4uparty.manus.space") && (
                <a href={getLoginUrl()}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-orbitron font-bold text-sm bg-white/10 hover:bg-white/15 border border-white/20 transition-all active:scale-95">
                  <Zap className="w-4 h-4" />
                  SIGN IN TO HOST
                </a>
              )}
            </div>
          )}
          <p className="text-gray-700 text-xs mt-3">2–8 players · 18+ only</p>
        </div>

        {/* Copyright footer */}
        <footer className="relative z-10 border-t border-white/5 py-4 px-4 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-gray-700 text-[11px] font-orbitron">
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>18+ ONLY · PLAY RESPONSIBLY</span>
            </div>
            <span className="hidden sm:block text-gray-800">·</span>
            <span>© AI4U, LLC. <a href="https://AI4Utech.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 transition-colors">AI4Utech.com</a> · Lee Hanna-Owner</span>
          </div>
        </footer>
      </div>
    );
  }

  const handleCreate = () => {
    if (!hostName.trim()) { toast.error("Enter your name first"); return; }
    createRoom.mutate({ hostName: hostName.trim(), avatarIndex: selectedAvatar, intensity });
  };

  const handleJoin = () => {
    if (!joinName.trim()) { toast.error("Enter your name first"); return; }
    if (joinCode.trim().length !== 6) { toast.error("Room code must be 6 characters"); return; }
    joinRoom.mutate({ code: joinCode.trim().toUpperCase(), playerName: joinName.trim(), avatarIndex: joinAvatar });
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 via-black to-black" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-8 flex flex-col gap-6 flex-1">

        {/* Brand header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xs font-orbitron font-bold text-violet-400 tracking-[0.3em] uppercase">AI4U, LLC</span>
            <span className="text-violet-600">·</span>
            <a href="https://AI4Utech.com" target="_blank" rel="noopener noreferrer"
              className="text-xs font-orbitron text-violet-400/70 hover:text-violet-300 transition-colors flex items-center gap-1">
              AI4Utech.com <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <h1 className="text-4xl sm:text-5xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-cyan-300 to-violet-400 leading-none">
            AI4U PARTY
          </h1>
          <h1 className="text-4xl sm:text-5xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-violet-300 to-cyan-400 leading-none mb-2">
            WHEEL
          </h1>
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 border border-violet-500/30 rounded-full px-4 py-1">
            <span className="text-xs font-orbitron text-violet-300 tracking-[0.2em]">GLITCH AFTER DARK</span>
          </div>
          <p className="text-gray-500 text-sm mt-2">
            Signed in as <span className="text-violet-400">{user?.name}</span>
          </p>
        </div>

        {/* Hero wheel — animated live preview, only shown when no form is open */}
        {!showCreate && !showJoin && (
          <div className="relative flex justify-center">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/25 to-cyan-600/25 rounded-full blur-3xl scale-75 animate-pulse" style={{ animationDuration: "4s" }} />
            <div className="relative z-10">
              <WheelPreview size={240} speed={0.35} />
            </div>
          </div>
        )}

        {/* H2 tagline for SEO */}
        {!showCreate && !showJoin && (
          <h2 className="text-base sm:text-lg font-orbitron font-bold text-center text-cyan-300 tracking-wide -mb-2">
            The AI-Powered Party Game for Adults
          </h2>
        )}

        {/* Feature pills */}
        {!showCreate && !showJoin && (
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { icon: "🎡", text: "43 segments" },
              { icon: "🤖", text: "AI4U attacks" },
              { icon: "🗳️", text: "Group voting" },
              { icon: "🏆", text: "Scoreboard" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs text-gray-400">
                <span>{f.icon}</span> {f.text}
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {!showCreate && !showJoin && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-orbitron font-bold text-base bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 transition-all active:scale-95 shadow-lg shadow-violet-900/30"
            >
              <Plus className="w-5 h-5" />
              HOST A GAME
            </button>
            <button
              onClick={() => setShowJoin(true)}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-orbitron font-bold text-base bg-white/10 hover:bg-white/15 border border-white/20 transition-all active:scale-95"
            >
              <Users className="w-5 h-5" />
              JOIN A GAME
            </button>
            {/* Part 1 v13: Atomic solo play — one server call, no lobby */}
            <button
              onClick={() => {
                if (!isAuthenticated) { toast.error("Sign in to play solo"); return; }
                createSoloRoom.mutate();
              }}
              disabled={createSoloRoom.isPending}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-orbitron font-bold text-sm bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/30 transition-all active:scale-95 disabled:opacity-50"
            >
              {createSoloRoom.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> CREATING...</> : <><Bot className="w-4 h-4" /> PLAY SOLO (vs Bots)</>}
            </button>
          </div>
        )}

        {/* Create room form */}
        {showCreate && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-orbitron font-bold text-sm text-violet-300">HOST A GAME</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-600 hover:text-gray-400 text-xs font-orbitron">✕ CANCEL</button>
            </div>
            <div>
              <label className="text-xs font-orbitron text-gray-500 mb-1.5 block">YOUR NAME</label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={32}
                className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors font-orbitron"
              />
            </div>
            <div>
              <label className="text-xs font-orbitron text-gray-500 mb-1.5 block">CHOOSE AVATAR</label>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_CONFIGS.map((cfg, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedAvatar(i)}
                    className={`aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
                      selectedAvatar === i
                        ? `bg-gradient-to-br ${cfg.color} scale-110 shadow-lg`
                        : "bg-white/5 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {cfg.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-orbitron text-gray-500 mb-1.5 block">INTENSITY</label>
              <div className="grid grid-cols-3 gap-2">
                {INTENSITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setIntensity(opt.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all text-center ${
                      intensity === opt.value
                        ? `bg-gradient-to-br ${opt.color} ${opt.border} scale-105`
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="text-[10px] font-orbitron font-bold text-white">{opt.label}</span>
                    <span className="text-[9px] text-gray-400">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={createRoom.isPending}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-orbitron font-bold text-sm bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createRoom.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> CREATING...</>
              ) : (
                <><Plus className="w-4 h-4" /> CREATE ROOM</>
              )}
            </button>
          </div>
        )}

        {/* Join room form */}
        {showJoin && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-orbitron font-bold text-sm text-cyan-300">JOIN A GAME</h2>
              <button onClick={() => setShowJoin(false)} className="text-gray-600 hover:text-gray-400 text-xs font-orbitron">✕ CANCEL</button>
            </div>
            <div>
              <label className="text-xs font-orbitron text-gray-500 mb-1.5 block">ROOM CODE</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="XXXXXX"
                maxLength={6}
                className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-lg text-white placeholder-gray-700 focus:outline-none focus:border-cyan-500 transition-colors font-orbitron tracking-widest text-center"
              />
            </div>
            <div>
              <label className="text-xs font-orbitron text-gray-500 mb-1.5 block">YOUR NAME</label>
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={32}
                className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors font-orbitron"
              />
            </div>
            <div>
              <label className="text-xs font-orbitron text-gray-500 mb-1.5 block">CHOOSE AVATAR</label>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_CONFIGS.map((cfg, i) => (
                  <button
                    key={i}
                    onClick={() => setJoinAvatar(i)}
                    className={`aspect-square rounded-xl flex items-center justify-center text-xl transition-all ${
                      joinAvatar === i
                        ? `bg-gradient-to-br ${cfg.color} scale-110 shadow-lg`
                        : "bg-white/5 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {cfg.emoji}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleJoin}
              disabled={joinRoom.isPending}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-orbitron font-bold text-sm bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joinRoom.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> JOINING...</>
              ) : (
                <><ArrowRight className="w-4 h-4" /> JOIN ROOM</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Copyright footer */}
      <footer className="relative z-10 border-t border-white/5 py-4 px-4 text-center mt-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 text-gray-700 text-[11px] font-orbitron">
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span>18+ ONLY · PLAY RESPONSIBLY</span>
          </div>
          <span className="hidden sm:block text-gray-800">·</span>
          <span>
            © AI4U, LLC.{" "}
            <a href="https://AI4Utech.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 transition-colors">
              AI4Utech.com
            </a>{" "}
            · Lee Hanna-Owner
          </span>
        </div>
      </footer>
    </div>
  );
}
