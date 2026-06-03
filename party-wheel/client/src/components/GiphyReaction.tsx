import { useEffect, useState } from "react";

interface GiphyGif {
  id: string;
  images: {
    downsized_medium: { url: string; width: string; height: string };
    fixed_height: { url: string; width: string; height: string };
  };
  title: string;
}

interface GiphySearchResponse {
  data: GiphyGif[];
  meta: { status: number };
}

/** Search tags per segment type */
const SEGMENT_GIPHY_TAGS: Record<string, string[]> = {
  holo_drama: ["dramatic reaction", "shocked face", "oh no reaction", "drama queen", "gasp reaction"],
  after_dark: ["spicy reaction", "flirty wink", "hot reaction", "scandalous", "naughty reaction"],
  robot_slapdown: ["robot attack", "zap", "electric shock reaction", "ouch reaction"],
  system_crash: ["explosion reaction", "mind blown", "chaos reaction", "everything is fine fire"],
  crowd_override: ["crowd cheering", "voting reaction", "crowd reaction", "democracy"],
  steal_the_signal: ["sneaky reaction", "thief reaction", "gotcha reaction", "snatched"],
  firewall_bonus: ["winner reaction", "bonus points", "jackpot reaction", "celebration"],
  braincell_check: ["thinking hard", "big brain", "genius reaction", "smart reaction"],
  truth_cache: ["truth reaction", "confession reaction", "honest reaction", "spill the tea"],
  glitch_dare: ["dare reaction", "challenge accepted", "nervous reaction", "gulp reaction"],
  prompt_duel: ["battle reaction", "versus reaction", "fight reaction", "duel reaction"],
};

const DEFAULT_TAG = "funny reaction";
const API_KEY = import.meta.env.VITE_GIPHY_API_KEY as string | undefined;

async function fetchRandomGif(segmentType: string): Promise<string | null> {
  if (!API_KEY) return null;

  const tags = SEGMENT_GIPHY_TAGS[segmentType] ?? [DEFAULT_TAG];
  // Pick a random tag from the list for variety
  const tag = tags[Math.floor(Math.random() * tags.length)];
  const offset = Math.floor(Math.random() * 20); // random offset for variety

  try {
    const url = new URL("https://api.giphy.com/v1/gifs/search");
    url.searchParams.set("api_key", API_KEY);
    url.searchParams.set("q", tag);
    url.searchParams.set("limit", "10");
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("rating", "r");
    url.searchParams.set("lang", "en");

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const json: GiphySearchResponse = await res.json();
    if (!json.data?.length) return null;

    // Pick a random result from the returned batch
    const gif = json.data[Math.floor(Math.random() * json.data.length)];
    return gif.images.fixed_height?.url ?? gif.images.downsized_medium?.url ?? null;
  } catch {
    return null;
  }
}

interface GiphyReactionProps {
  /** The game segment type — determines which search tags are used */
  segmentType: string;
  /** Whether to show the GIF (triggers fetch on mount/change) */
  visible: boolean;
  /** Optional CSS class for the container */
  className?: string;
  /** Auto-hide after this many ms (default: 6000) */
  autoHideMs?: number;
  /** Called when the GIF is dismissed */
  onDismiss?: () => void;
}

export default function GiphyReaction({
  segmentType,
  visible,
  className = "",
  autoHideMs = 6000,
  onDismiss,
}: GiphyReactionProps) {
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);

  // Fetch a new GIF whenever segmentType+visible changes
  useEffect(() => {
    if (!visible) {
      setShown(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setGifUrl(null);

    fetchRandomGif(segmentType).then((url) => {
      if (cancelled) return;
      setGifUrl(url);
      setLoading(false);
      if (url) setShown(true);
    });

    return () => { cancelled = true; };
  }, [segmentType, visible]);

  // Auto-hide timer
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => {
      setShown(false);
      onDismiss?.();
    }, autoHideMs);
    return () => clearTimeout(t);
  }, [shown, autoHideMs, onDismiss]);

  if (!visible || !shown || !gifUrl) return null;

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border-2 border-violet-500/60 shadow-2xl shadow-violet-900/60 bg-black/40 ${className}`}
      style={{ animation: "fadeInScale 0.35s ease-out" }}
    >
      {/* Powered by GIPHY badge */}
      <div className="absolute top-2 right-2 z-10 bg-black/70 rounded px-1.5 py-0.5 flex items-center gap-1">
        <span className="text-[9px] text-gray-400 font-medium tracking-wide">Powered by</span>
        <span className="text-[10px] font-bold text-white tracking-wider">GIPHY</span>
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => { setShown(false); onDismiss?.(); }}
        className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-black/70 text-gray-300 hover:text-white flex items-center justify-center text-xs leading-none"
        aria-label="Dismiss GIF"
      >
        ✕
      </button>

      {loading ? (
        <div className="w-full h-40 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <img
          src={gifUrl}
          alt={`Reaction GIF for ${segmentType}`}
          className="w-full max-h-56 object-cover"
          loading="eager"
        />
      )}
    </div>
  );
}
