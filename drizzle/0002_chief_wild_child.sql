CREATE TABLE `markdownImports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`importedByUserId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`sourceKey` varchar(500),
	`sourceUrl` varchar(700),
	`ownersCreated` int NOT NULL DEFAULT 0,
	`patientsCreated` int NOT NULL DEFAULT 0,
	`recordsCreated` int NOT NULL DEFAULT 0,
	`warnings` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `markdownImports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `medicalRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`patientId` int NOT NULL,
	`veterinarianUserId` int,
	`recordDate` timestamp,
	`title` varchar(180),
	`content` text NOT NULL,
	`sourceType` enum('veterinarian','owner','markdown_import') NOT NULL DEFAULT 'veterinarian',
	`originalContent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `medicalRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ownerAddresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`ownerId` int NOT NULL,
	`label` varchar(80) NOT NULL DEFAULT 'Residência',
	`postalCode` varchar(20),
	`state` varchar(80),
	`city` varchar(120),
	`neighborhood` varchar(120),
	`street` varchar(180),
	`number` varchar(30),
	`complement` varchar(120),
	`reference` text,
	`accessInstructions` text,
	`isPrimary` enum('yes','no') NOT NULL DEFAULT 'yes',
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ownerAddresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `owners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`phone` varchar(40),
	`email` varchar(320),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `owners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patientAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`patientId` int NOT NULL,
	`medicalRecordId` int,
	`uploadedByUserId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`fileSize` int NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`storageUrl` varchar(700) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `patientAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`species` varchar(80),
	`breed` varchar(120),
	`sex` enum('male','female','unknown'),
	`birthDate` timestamp,
	`notes` text,
	`importSource` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `patients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP INDEX `organizations_owner_index` ON `organizations`;--> statement-breakpoint
DROP INDEX `subscription_events_subscription_index` ON `subscriptionEvents`;--> statement-breakpoint
DROP INDEX `subscriptions_external_index` ON `subscriptions`;--> statement-breakpoint
DROP INDEX `veterinarian_profiles_user_index` ON `veterinarianProfiles`;--> statement-breakpoint
CREATE INDEX `medical_records_patient_date_index` ON `medicalRecords` (`patientId`,`recordDate`);--> statement-breakpoint
CREATE INDEX `owner_addresses_owner_index` ON `ownerAddresses` (`ownerId`);--> statement-breakpoint
CREATE INDEX `owners_org_name_index` ON `owners` (`organizationId`,`name`);--> statement-breakpoint
CREATE INDEX `patient_attachments_patient_index` ON `patientAttachments` (`patientId`);--> statement-breakpoint
CREATE INDEX `patients_owner_name_index` ON `patients` (`ownerId`,`name`);--> statement-breakpoint
CREATE INDEX `patients_organization_index` ON `patients` (`organizationId`);