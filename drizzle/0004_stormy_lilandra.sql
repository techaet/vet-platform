CREATE TABLE `appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`ownerId` int NOT NULL,
	`patientId` int NOT NULL,
	`veterinarianUserId` int NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`addressText` text,
	`notes` text,
	`status` enum('scheduled','confirmed','completed','canceled') NOT NULL DEFAULT 'scheduled',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ownerObservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`patientId` int NOT NULL,
	`veterinarianUserId` int NOT NULL,
	`content` text NOT NULL,
	`originalAudioKey` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ownerObservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegramMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramChatId` varchar(80) NOT NULL,
	`telegramMessageId` int,
	`organizationId` int,
	`veterinarianUserId` int,
	`direction` enum('inbound','outbound') NOT NULL,
	`messageType` varchar(40) NOT NULL,
	`text` text,
	`rawPayload` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telegramMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegramSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramChatId` varchar(80) NOT NULL,
	`organizationId` int,
	`veterinarianUserId` int,
	`mode` enum('idle','appointment','record','owner_observation') NOT NULL DEFAULT 'idle',
	`ownerId` int,
	`patientId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegramSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegramSessions_telegramChatId_unique` UNIQUE(`telegramChatId`)
);
--> statement-breakpoint
ALTER TABLE `veterinarianProfiles` ADD `telegramChatId` varchar(80);--> statement-breakpoint
CREATE INDEX `appointments_vet_date_index` ON `appointments` (`veterinarianUserId`,`scheduledAt`);--> statement-breakpoint
CREATE INDEX `telegram_messages_chat_index` ON `telegramMessages` (`telegramChatId`,`createdAt`);