CREATE TABLE `googleConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`googleEmail` varchar(320) NOT NULL,
	`accessTokenEncrypted` text NOT NULL,
	`refreshTokenEncrypted` text,
	`expiresAt` timestamp,
	`scopes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `googleConnections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `google_connections_user_org_index` ON `googleConnections` (`userId`,`organizationId`);