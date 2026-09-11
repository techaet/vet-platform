CREATE TABLE `organizationMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('admin','veterinarian','collaborator') NOT NULL DEFAULT 'veterinarian',
	`status` enum('active','invited','suspended') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizationMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `organization_members_org_user_unique` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`description` text,
	`ownerUserId` int NOT NULL,
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`monthlyAmountCents` int NOT NULL DEFAULT 0,
	`includedVeterinarians` int NOT NULL DEFAULT 1,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptionEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscriptionId` int NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`externalEventId` varchar(180),
	`payload` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscriptionEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`planId` int,
	`status` enum('trialing','active','past_due','suspended','canceled') NOT NULL DEFAULT 'trialing',
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`externalCustomerId` varchar(180),
	`externalSubscriptionId` varchar(180),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `veterinarianProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(180),
	`phone` varchar(40),
	`professionalRegistration` varchar(80),
	`bio` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `veterinarianProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `veterinarian_profiles_org_user_unique` UNIQUE(`organizationId`,`userId`)
);
--> statement-breakpoint
CREATE INDEX `organization_members_user_index` ON `organizationMembers` (`userId`);--> statement-breakpoint
CREATE INDEX `organization_members_organization_index` ON `organizationMembers` (`organizationId`);--> statement-breakpoint
CREATE INDEX `organizations_owner_index` ON `organizations` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `subscription_events_subscription_index` ON `subscriptionEvents` (`subscriptionId`);--> statement-breakpoint
CREATE INDEX `subscriptions_organization_index` ON `subscriptions` (`organizationId`);--> statement-breakpoint
CREATE INDEX `subscriptions_external_index` ON `subscriptions` (`externalSubscriptionId`);--> statement-breakpoint
CREATE INDEX `veterinarian_profiles_user_index` ON `veterinarianProfiles` (`userId`);