ALTER TABLE `prescriptionTemplates` ADD `letterheadKey` varchar(500);--> statement-breakpoint
ALTER TABLE `prescriptionTemplates` ADD `letterheadUrl` varchar(700);--> statement-breakpoint
ALTER TABLE `prescriptions` ADD `content` text;