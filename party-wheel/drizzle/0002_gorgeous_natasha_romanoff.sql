ALTER TABLE `players` ADD `guestSessionId` varchar(64);--> statement-breakpoint
ALTER TABLE `rooms` ADD `currentEventId` int;--> statement-breakpoint
ALTER TABLE `rooms` ADD `currentPhase` varchar(32) DEFAULT 'waiting' NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `lastSpinResultJson` json;--> statement-breakpoint
ALTER TABLE `rooms` ADD `lastSpinVelocity` float;--> statement-breakpoint
ALTER TABLE `rooms` ADD `spinId` varchar(36);--> statement-breakpoint
ALTER TABLE `rooms` ADD `spinStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `rooms` ADD `spinDurationMs` int;--> statement-breakpoint
ALTER TABLE `rooms` ADD `finalAngle` float;--> statement-breakpoint
ALTER TABLE `rooms` ADD `segmentIndex` int;