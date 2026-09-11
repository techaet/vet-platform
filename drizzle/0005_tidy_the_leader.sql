CREATE TABLE `appointmentReminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentId` int NOT NULL,
	`channel` enum('telegram','whatsapp','email') NOT NULL,
	`reminderType` enum('vet_30m','owner_1d') NOT NULL,
	`scheduledFor` timestamp NOT NULL,
	`sentAt` timestamp,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `appointmentReminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `appointments` ADD `calendarEventId` varchar(255);--> statement-breakpoint
CREATE INDEX `appointment_reminders_due_index` ON `appointmentReminders` (`status`,`scheduledFor`);