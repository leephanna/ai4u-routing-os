/**
 * Phase 11: Recency/Repetition Control
 * Tracks recently used content and prevents repetition within a session
 */

interface ContentRecord {
  content: string;
  segmentType: string;
  timestamp: number;
  roomId: number;
}

// In-memory cache of recently used content (cleared on server restart)
const recentContentCache = new Map<number, ContentRecord[]>();

const RECENCY_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_RECENT_PER_ROOM = 50; // Track last 50 pieces of content per room

/**
 * Record content as used in a room
 */
export function recordContentUsage(
  roomId: number,
  segmentType: string,
  content: string
): void {
  if (!recentContentCache.has(roomId)) {
    recentContentCache.set(roomId, []);
  }

  const records = recentContentCache.get(roomId)!;
  records.push({
    content,
    segmentType,
    timestamp: Date.now(),
    roomId,
  });

  // Keep only recent content (within recency window)
  const cutoff = Date.now() - RECENCY_WINDOW_MS;
  const filtered = records.filter((r) => r.timestamp > cutoff);

  // Keep only last N records
  if (filtered.length > MAX_RECENT_PER_ROOM) {
    filtered.splice(0, filtered.length - MAX_RECENT_PER_ROOM);
  }

  recentContentCache.set(roomId, filtered);
}

/**
 * Check if content has been used recently in a room
 */
export function hasContentBeenUsedRecently(
  roomId: number,
  content: string,
  segmentType?: string
): boolean {
  const records = recentContentCache.get(roomId) ?? [];
  const cutoff = Date.now() - RECENCY_WINDOW_MS;

  return records.some((r) => {
    const isRecent = r.timestamp > cutoff;
    const contentMatches = r.content.toLowerCase().trim() === content.toLowerCase().trim();
    const segmentMatches = !segmentType || r.segmentType === segmentType;

    return isRecent && contentMatches && segmentMatches;
  });
}

/**
 * Get count of recent content for a room
 */
export function getRecentContentCount(roomId: number): number {
  const records = recentContentCache.get(roomId) ?? [];
  const cutoff = Date.now() - RECENCY_WINDOW_MS;
  return records.filter((r) => r.timestamp > cutoff).length;
}

/**
 * Clear content cache for a room (e.g., when game ends)
 */
export function clearRoomContentCache(roomId: number): void {
  recentContentCache.delete(roomId);
}

/**
 * Get statistics on content usage
 */
export function getContentStats(): {
  totalRooms: number;
  totalRecords: number;
  averageRecordsPerRoom: number;
} {
  let totalRecords = 0;
  recentContentCache.forEach((records) => {
    totalRecords += records.length;
  });

  return {
    totalRooms: recentContentCache.size,
    totalRecords,
    averageRecordsPerRoom: recentContentCache.size > 0 ? totalRecords / recentContentCache.size : 0,
  };
}
