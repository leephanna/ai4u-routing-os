CREATE TABLE `challenge_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`gameEventId` int NOT NULL,
	`playerId` int NOT NULL,
	`segmentType` varchar(32) NOT NULL,
	`responseType` varchar(32) NOT NULL,
	`textResponse` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `challenge_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_challenge_response` UNIQUE(`gameEventId`,`playerId`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`playerId` int NOT NULL,
	`playerName` varchar(32) NOT NULL,
	`avatarIndex` int NOT NULL DEFAULT 0,
	`message` text NOT NULL,
	`isBot` boolean NOT NULL DEFAULT false,
	`reactionEmoji` varchar(8),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `players` ADD `isBot` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `botPersonality` varchar(32);--> statement-breakpoint
ALTER TABLE `votes` ADD CONSTRAINT `unique_vote` UNIQUE(`gameEventId`,`playerId`);