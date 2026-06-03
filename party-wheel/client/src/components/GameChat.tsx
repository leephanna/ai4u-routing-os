import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { AVATAR_CONFIGS } from "@/components/AvatarCard";

interface ChatMessage {
  id: number;
  roomId: number;
  playerId: number;
  playerName: string;
  avatarIndex: number;
  message: string;
  isBot: boolean;
  createdAt: string;
}

interface GameChatProps {
  roomId: number;
  roomCode: string;
  myPlayerId: number | null;
  myPlayerName: string;
  myAvatarIndex: number;
  liveMessages?: ChatMessage[];
}

export function GameChat({ roomId, roomCode, myPlayerId, myPlayerName, myAvatarIndex, liveMessages = [] }: GameChatProps) {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const recentQuery = trpc.chat.getRecent.useQuery(
    { roomId, limit: 50 },
    { enabled: !!roomId, refetchInterval: isOpen ? false : 15000 }
  );

  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      recentQuery.refetch();
    },
  });

  // Merge DB messages with live Realtime messages
  const dbMessages: ChatMessage[] = (recentQuery.data ?? []).map((m: any) => ({
    ...m,
    id: m.id ?? 0,
    isBot: m.isBot ?? false,
    avatarIndex: m.avatarIndex ?? 0,
  }));

  // Deduplicate by id, preferring live messages
  const allById = new Map<number, ChatMessage>();
  for (const m of dbMessages) allById.set(m.id, m);
  for (const m of liveMessages) if (m.id) allById.set(m.id, m);
  const allMessages = Array.from(allById.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Track unread when closed
  useEffect(() => {
    if (!isOpen && allMessages.length > prevCountRef.current) {
      setUnread(prev => prev + (allMessages.length - prevCountRef.current));
    }
    prevCountRef.current = allMessages.length;
  }, [allMessages.length, isOpen]);

  // Auto-scroll to bottom when open
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnread(0);
    }
  }, [isOpen, allMessages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || !myPlayerId) return;
    setInput("");
    try {
      await sendMutation.mutateAsync({
        roomId,
        roomCode,
        playerId: myPlayerId,
        playerName: myPlayerName,
        avatarIndex: myAvatarIndex,
        message: msg,
        isBot: false,
      });
    } catch {
      // Ignore send errors
    }
  };

  const avatarConfig = (idx: number) => AVATAR_CONFIGS[idx % AVATAR_CONFIGS.length];

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Chat panel */}
      {isOpen && (
        <div className="w-80 h-96 bg-gray-900/95 border border-cyan-500/30 rounded-xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/20 bg-gray-800/50">
            <span className="text-cyan-400 font-bold text-sm tracking-wide">💬 CHAT</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
            {allMessages.length === 0 && (
              <p className="text-gray-500 text-xs text-center mt-4">No messages yet. Say something! 👋</p>
            )}
            {allMessages.map((msg) => {
              const cfg = avatarConfig(msg.avatarIndex);
              const isMe = msg.playerId === myPlayerId;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 border"
                    style={{ background: cfg.color, borderColor: cfg.color }}
                  >
                    {cfg.emoji}
                  </div>
                  {/* Bubble */}
                  <div className={`max-w-[75%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                    <span className="text-xs text-gray-400 px-1">
                      {msg.playerName}{msg.isBot ? " 🤖" : ""}
                    </span>
                    <div
                      className={`px-2.5 py-1.5 rounded-xl text-sm break-words ${
                        isMe
                          ? "bg-cyan-600 text-white rounded-tr-sm"
                          : msg.isBot
                          ? "bg-purple-800/60 text-purple-100 rounded-tl-sm border border-purple-500/30"
                          : "bg-gray-700 text-gray-100 rounded-tl-sm"
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="flex gap-2 p-2 border-t border-cyan-500/20 bg-gray-800/50">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message..."
              maxLength={200}
              className="flex-1 bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none border border-gray-600 focus:border-cyan-500 placeholder-gray-500 min-w-0"
            />
            <button
              type="submit"
              disabled={!input.trim() || sendMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm px-3 py-2 rounded-lg font-bold transition-colors"
            >
              ➤
            </button>
          </form>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="relative w-12 h-12 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-lg flex items-center justify-center text-xl transition-all active:scale-95"
      >
        💬
        {unread > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}
