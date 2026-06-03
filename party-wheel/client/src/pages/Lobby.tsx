import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { AVATAR_CONFIGS } from "@/components/AvatarCard";
import { Users, Copy, Check, Crown, Play, Zap, Bot } from "lucide-react";
import { toast } from "sonner";
import { resumeAudio } from "@/lib/audio";
import type { Intensity } from "../../../shared/gameTypes";
import { BOT_PERSONALITIES, type BotPersonalityKey } from "../../../shared/gameTypes";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import type { RoomBroadcastPayload } from "@/hooks/useRoomRealtime";
import { GameChat } from "@/components/GameChat";
import type { ChatMessagePayload } from "../../../shared/gameTypes";
import CopyrightFooter from "@/components/CopyrightFooter";

const INTENSITY_OPTIONS: { mode: Intensity; label: string; desc: string; emoji: string; color: string }[] = [
  { mode: "house_party", label: "House Party", desc: "Fun for everyone, keep it clean-ish", emoji: "🎉", color: "from-green-600 to-emerald-600" },
  { mode: "after_dark", label: "After Dark", desc: "Adult themes, spicy truths, edgy dares", emoji: "🌙", color: "from-violet-600 to-purple-600" },
  { mode: "chaos_mode", label: "Chaos Mode", desc: "No rules. Pure mayhem. You asked for it.", emoji: "💀", color: "from-red-600 to-orange-600" },
];

export default function Lobby() {
  const params = useParams<{ code: string }>();
  const roomCode = (params.code ?? "").toUpperCase();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [playerName, setPlayerName] = useState(user?.name ?? "Player");
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const [liveMessages, setLiveMessages] = useState<ChatMessagePayload[]>([]);
  const roomCodeRef = useRef(roomCode);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);

  // Part 5: Full Realtime event dispatcher for Lobby
  const handleRoomUpdate = useCallback((payload: RoomBroadcastPayload) => {
    switch (payload.event) {
      case "player_joined":
      case "room_update":
      case "game_started":
        void utils.room.get.invalidate({ code: roomCodeRef.current });
        break;
      case "chat_message": {
        const msg = payload.data as ChatMessagePayload;
        if (msg?.message) {
          setLiveMessages((prev) => [...prev.slice(-99), msg]);
        }
        break;
      }
      default:
        void utils.room.get.invalidate({ code: roomCodeRef.current });
    }
  }, [utils]);

  useRoomRealtime({
    roomCode,
    onUpdate: handleRoomUpdate,
    enabled: !!roomCode,
  });

  // Fallback poll every 3s in case Realtime is unavailable
  const roomQuery = trpc.room.get.useQuery(
    { code: roomCode },
    { refetchInterval: 3000 }
  );

  const joinMutation = trpc.room.join.useMutation({
    onSuccess: (data) => {
      const me = data.players.find((p) => p.userId === user?.id);
      if (me) setMyPlayerId(me.id);
      toast.success("Joined room!");
      roomQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const setIntensityMutation = trpc.room.setIntensity.useMutation({
    onSuccess: () => {
      toast.success("Intensity updated!");
      roomQuery.refetch();
    },
  });

  const addBotMutation = trpc.bot.add.useMutation({
    onSuccess: () => {
      roomQuery.refetch();
      toast.success("Bot player added!");
    },
    onError: (e) => toast.error(e.message),
  });

  const [selectedBotPersonality, setSelectedBotPersonality] = useState<BotPersonalityKey>("CHAOS_GREMLIN");

  const startGameMutation = trpc.game.start.useMutation({
    onSuccess: () => {
      resumeAudio();
      navigate(`/room/${roomCode}/play`);
    },
    onError: (e) => toast.error(e.message),
  });

  const room = roomQuery.data;
  const players = room?.players ?? [];
  // Bug 1: use server-computed myPlayerId so guests can identify themselves
  const guestSessionIdLobby = localStorage.getItem("ai4u_guest_session_id");
  const myPlayer = room?.myPlayerId
    ? players.find((p) => p.id === room.myPlayerId)
    : players.find((p) =>
        (user?.id && p.userId === user.id) ||
        (guestSessionIdLobby && p.guestSessionId === guestSessionIdLobby)
      );
  const isHost = myPlayer?.isHost === true || room?.hostId === user?.id;
  const botPlayers = players.filter((p) => p.isBot);
  const canStart = isHost && players.length >= 2;
  const canAddBot = isHost && players.length < 8;

  useEffect(() => {
    if (room?.status === "playing") {
      navigate(`/room/${roomCode}/play`);
    }
  }, [room?.status, roomCode, navigate]);

  // Bug 2: Auto-solo — if localStorage flag is set, add 2 bots and start game
  useEffect(() => {
    const autoSolo = localStorage.getItem("ai4u_auto_solo");
    if (!autoSolo || !isHost || !room || room.status !== "waiting") return;
    if (players.length !== 1) return; // wait until only host is present

    localStorage.removeItem("ai4u_auto_solo");

    let cancelled = false;
    const run = async () => {
      try {
        await addBotMutation.mutateAsync({ roomId: room.id, personality: "HYPE_BOT" });
        await addBotMutation.mutateAsync({ roomId: room.id, personality: "CHAOS_GREMLIN" });
        if (!cancelled) startGameMutation.mutate({ roomId: room.id });
      } catch (e) {
        console.error("Auto-solo failed:", e);
      }
    };
    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.status, isHost, players.length]);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = () => {
    if (!user) {
      toast.error("Please sign in to join");
      return;
    }
    joinMutation.mutate({
      code: roomCode,
      playerName: playerName.trim() || user.name || "Player",
      avatarIndex: selectedAvatar,
    });
  };

  if (roomQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-violet-400 font-orbitron animate-pulse">LOADING ROOM...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <div className="text-red-400 font-orbitron text-xl">ROOM NOT FOUND</div>
          <Button onClick={() => navigate("/")} variant="outline" className="border-white/20 text-white bg-transparent">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="text-xs text-violet-400 font-orbitron tracking-widest uppercase">Room Code</div>
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-black font-orbitron tracking-widest text-white">{roomCode}</span>
            <button onClick={handleCopy} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
          <p className="text-gray-500 text-sm">Share this code with friends to join</p>
        </div>

        {/* Players list */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-bold font-orbitron text-violet-300">PLAYERS</span>
            </div>
            <span className="text-xs text-gray-500">{players.length}/8</span>
          </div>

          {players.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">Waiting for players...</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {players.map((p) => {
                const config = AVATAR_CONFIGS[p.avatarIndex % AVATAR_CONFIGS.length] ?? AVATAR_CONFIGS[0]!;
                return (
                  <div key={p.id} className="flex items-center gap-2 bg-white/5 rounded-xl p-2">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center text-sm`}>
                      {config.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-white truncate">{p.guestName}</span>
                        {p.userId === room.hostId && <Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                      </div>
                      <span className="text-[10px] text-green-400">● Online</span>
                    </div>
                  </div>
                );
              })}
              {players.length < 8 && (
                <div className="flex items-center justify-center border border-dashed border-white/10 rounded-xl p-2 text-gray-600 text-xs">
                  + Waiting...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Join form (if not yet joined) */}
        {!myPlayer && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
            <div className="text-sm font-bold font-orbitron text-violet-300">JOIN AS</div>
            <input
              type="text"
              value={playerName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlayerName(e.target.value)}
              placeholder="Your name"
              maxLength={20}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-400 transition-colors"
            />
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_CONFIGS.slice(0, 12).map((cfg, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedAvatar(i)}
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.color} flex items-center justify-center text-lg transition-all duration-150 ${selectedAvatar === i ? "ring-2 ring-violet-400 scale-110" : "opacity-60 hover:opacity-100"}`}
                >
                  {cfg.emoji}
                </button>
              ))}
            </div>
            <Button
              onClick={handleJoin}
              disabled={joinMutation.isPending || !playerName.trim()}
              className="w-full h-12 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 font-orbitron font-bold border-0 rounded-xl"
            >
              {joinMutation.isPending ? "JOINING..." : "JOIN ROOM"}
            </Button>
          </div>
        )}

        {/* Add Bot section (host only) */}
        {isHost && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold font-orbitron text-purple-300">ADD AI BOT PLAYER</span>
            </div>
            <p className="text-xs text-gray-500">Add a bot if you don't have enough players. Bots spin, vote, and chat automatically.</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(BOT_PERSONALITIES) as [BotPersonalityKey, typeof BOT_PERSONALITIES[BotPersonalityKey]][]).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => setSelectedBotPersonality(key)}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                    selectedBotPersonality === key
                      ? "border-purple-500 bg-purple-900/30"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <span className="text-xl">{p.chatQuips.beforeSpin[0]?.slice(0, 2) ?? "🤖"}</span>
                  <div>
                    <div className="text-xs font-bold text-white">{p.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">{p.chatQuips.beforeSpin[0] ?? ""}</div>
                  </div>
                </button>
              ))}
            </div>
            <Button
              onClick={() => room && addBotMutation.mutate({ roomId: room.id, personality: selectedBotPersonality })}
              disabled={!canAddBot || addBotMutation.isPending}
              className="w-full h-10 bg-purple-700 hover:bg-purple-600 disabled:opacity-40 font-orbitron text-sm font-bold border-0 rounded-xl"
            >
              {addBotMutation.isPending ? "ADDING..." : `ADD ${BOT_PERSONALITIES[selectedBotPersonality].name.toUpperCase()}`}
            </Button>
            {botPlayers.length > 0 && (
              <p className="text-xs text-purple-400 text-center">{botPlayers.length} bot{botPlayers.length > 1 ? "s" : ""} in room</p>
            )}
          </div>
        )}

        {/* Intensity selector (host only) */}
        {isHost && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="text-sm font-bold font-orbitron text-violet-300">INTENSITY MODE</div>
            <div className="space-y-2">
              {INTENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.mode}
                  onClick={() => room && setIntensityMutation.mutate({ roomId: room.id, intensity: opt.mode })}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 ${room?.intensity === opt.mode ? `bg-gradient-to-r ${opt.color} border-transparent shadow-lg` : "bg-white/5 border-white/10 hover:border-white/20"}`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <div className="text-left">
                    <div className="text-sm font-bold text-white">{opt.label}</div>
                    <div className="text-xs text-white/70">{opt.desc}</div>
                  </div>
                  {room?.intensity === opt.mode && <Check className="w-4 h-4 text-white ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Start button (host only) */}
        {isHost && (
          <Button
            onClick={() => room && startGameMutation.mutate({ roomId: room.id })}
            disabled={!canStart || startGameMutation.isPending}
            className={`w-full h-16 text-lg font-black font-orbitron border-0 rounded-2xl transition-all duration-200 ${canStart ? "bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 shadow-xl shadow-violet-900/50 hover:scale-[1.02]" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}
          >
            {startGameMutation.isPending ? (
              <span className="flex items-center gap-2"><Zap className="w-5 h-5 animate-spin" /> STARTING...</span>
            ) : canStart ? (
              <span className="flex items-center gap-2"><Play className="w-5 h-5" /> START GAME</span>
            ) : "NEED 2+ PLAYERS"}
          </Button>
        )}

        {!isHost && myPlayer && (
          <div className="text-center text-gray-500 text-sm font-orbitron animate-pulse">
            Waiting for host to start the game...
          </div>
        )}
      </div>
      <CopyrightFooter />
      {/* Real-time chat */}
      {room && myPlayerId && (
        <GameChat
          roomId={room.id}
          roomCode={roomCode}
          myPlayerId={myPlayerId}
          myPlayerName={myPlayer?.guestName ?? "Player"}
          myAvatarIndex={myPlayer?.avatarIndex ?? 0}
          liveMessages={liveMessages}
        />
      )}
    </div>
  );
}
