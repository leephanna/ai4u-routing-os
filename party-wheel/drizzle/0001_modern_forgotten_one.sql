CREATE TABLE `game_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`playerId` int NOT NULL,
	`roundNumber` int NOT NULL,
	`segmentType` varchar(32) NOT NULL,
	`segmentLabel` varchar(64) NOT NULL,
	`content` text,
	`spinVelocity` float,
	`outcome` text,
	`pointsDelta` int NOT NULL DEFAULT 0,
	`isFunny` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`userId` int,
	`guestName` varchar(32),
	`avatarIndex` int NOT NULL DEFAULT 0,
	`score` int NOT NULL DEFAULT 0,
	`shields` int NOT NULL DEFAULT 0,
	`streak` int NOT NULL DEFAULT 0,
	`chaosMultiplier` float NOT NULL DEFAULT 1,
	`isHost` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`turnOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `replay_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`shareToken` varchar(32) NOT NULL,
	`winnerName` varchar(64),
	`winnerScore` int,
	`totalRounds` int,
	`playerCount` int,
	`funnySummary` text,
	`statsJson` json,
	`storageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `replay_cards_id` PRIMARY KEY(`id`),
	CONSTRAINT `replay_cards_shareToken_unique` UNIQUE(`shareToken`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(6) NOT NULL,
	`hostId` int NOT NULL,
	`status` enum('waiting','playing','ended') NOT NULL DEFAULT 'waiting',
	`intensity` enum('house_party','after_dark','chaos_mode') NOT NULL DEFAULT 'house_party',
	`currentTurn` int NOT NULL DEFAULT 0,
	`currentPlayerId` int,
	`roundNumber` int NOT NULL DEFAULT 1,
	`maxPlayers` int NOT NULL DEFAULT 8,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `rooms_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`gameEventId` int NOT NULL,
	`playerId` int NOT NULL,
	`choice` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `votes_id` PRIMARY KEY(`id`)
);
