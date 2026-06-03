-- Migration: Add unique constraint to votes table to prevent duplicate votes
-- One vote per player per game event (upsert semantics enforced at DB level)
ALTER TABLE votes ADD UNIQUE INDEX unique_vote (gameEventId, playerId);
