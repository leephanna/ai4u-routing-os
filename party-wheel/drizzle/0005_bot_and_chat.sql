-- Add isBot flag and botPersonality to players table
ALTER TABLE players ADD COLUMN isBot TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN botPersonality VARCHAR(32) DEFAULT NULL;

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  roomId INT NOT NULL,
  playerId INT NOT NULL,
  playerName VARCHAR(32) NOT NULL,
  avatarIndex INT NOT NULL DEFAULT 0,
  message TEXT NOT NULL,
  isBot TINYINT(1) NOT NULL DEFAULT 0,
  reactionEmoji VARCHAR(8) DEFAULT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_room (roomId, createdAt)
);
