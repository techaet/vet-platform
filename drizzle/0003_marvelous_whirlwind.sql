CREATE TABLE `prescriptionItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`prescriptionId` int NOT NULL,
	`medication` varchar(180) NOT NULL,
	`concentration` varchar(120),
	`presentation` varchar(120),
	`dose` varchar(160),
	`route` varchar(100),
	`frequency` varchar(120),
	`duration` varchar(120),
	`quantity` varchar(80),
	`instructions` text,
	CONSTRAINT `prescriptionItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prescriptionTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`veterinarianUserId` int NOT NULL,
	`businessName` varchar(180),
	`professionalName` varchar(180),
	`registration` varchar(80),
	`phone` varchar(40),
	`professionalAddress` text,
	`headerText` text,
	`footerText` text,
	`primaryColor` varchar(20) NOT NULL DEFAULT '#087f70',
	`logoKey` varchar(500),
	`logoUrl` varchar(700),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prescriptionTemplates_id` PRIMARY KEY(`id`),
	CONSTRAINT `prescription_templates_vet_unique` UNIQUE(`organizationId`,`veterinarianUserId`)
);
--> statement-breakpoint
CREATE TABLE `prescriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`patientId` int NOT NULL,
	`veterinarianUserId` int NOT NULL,
	`medicalRecordId` int,
	`notes` text,
	`pdfKey` varchar(500),
	`pdfUrl` varchar(700),
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prescriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `veterinarianAdminDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`veterinarianUserId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`storageKey` varchar(500),
	`storageUrl` varchar(700),
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `veterinarianAdminDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `prescriptions_patient_index` ON `prescriptions` (`patientId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `vet_admin_documents_vet_index` ON `veterinarianAdminDocuments` (`veterinarianUserId`,`organizationId`);