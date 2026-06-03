/**
 * useRoomRealtime
 *
 * Subscribes to a Supabase Realtime Broadcast channel for a given room code.
 * When the server broadcasts a "room_update" event, this hook calls `onUpdate`
 * so callers can invalidate their tRPC cache for an instant UI update.
 *
 * Uses getSupabaseClient() (lazy init) so the hook is safe to call even when
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing — it simply becomes
 * a no-op and the polling fallback handles sync.
 */
import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RoomBroadcastPayload = {
  event: "room_update" | "game_started" | "game_ended" | "player_joined" | "chat_message" | "vote_update" | "spin_committed" | "phase_update";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
};

interface UseRoomRealtimeOptions {
  roomCode: string;
  onUpdate: (payload: RoomBroadcastPayload) => void;
  enabled?: boolean;
}

export function useRoomRealtime({ roomCode, onUpdate, enabled = true }: UseRoomRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep ref fresh without re-subscribing on every render
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!enabled || !roomCode || !client) return;

    const channelName = `room:${roomCode}`;

    // Clean up any previous subscription for this code
    if (channelRef.current) {
      client.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = client.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "room_update" }, ({ payload }) => {
        onUpdateRef.current({ event: "room_update", data: payload as Record<string, unknown> });
      })
      .on("broadcast", { event: "game_started" }, ({ payload }) => {
        onUpdateRef.current({ event: "game_started", data: payload as Record<string, unknown> });
      })
      .on("broadcast", { event: "game_ended" }, ({ payload }) => {
        onUpdateRef.current({ event: "game_ended", data: payload as Record<string, unknown> });
      })
      .on("broadcast", { event: "player_joined" }, ({ payload }) => {
        onUpdateRef.current({ event: "player_joined", data: payload as Record<string, unknown> });
      })
      .on("broadcast", { event: "chat_message" }, ({ payload }) => {
        onUpdateRef.current({ event: "chat_message", data: payload as Record<string, unknown> });
      })
      .on("broadcast", { event: "vote_update" }, ({ payload }) => {
        onUpdateRef.current({ event: "vote_update", data: payload as Record<string, unknown> });
      })
      .on("broadcast", { event: "spin_committed" }, ({ payload }) => {
        onUpdateRef.current({ event: "spin_committed", data: payload as Record<string, unknown> });
      })
      .on("broadcast", { event: "phase_update" }, ({ payload }) => {
        // Alias: old "phase_update" events are forwarded as "spin_committed" for backward compatibility
        onUpdateRef.current({ event: "spin_committed", data: payload as Record<string, unknown> });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.debug(`[Realtime] Subscribed to ${channelName}`);
        } else if (status === "CHANNEL_ERROR") {
          console.warn(`[Realtime] Channel error on ${channelName}`);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        client.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomCode, enabled]);
}
