CREATE TABLE `connector_credential` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`connectorType` enum('linear','notion','jira') NOT NULL,
	`credential` text NOT NULL,
	`config` json,
	`status` enum('disconnected','connected','error') NOT NULL DEFAULT 'disconnected',
	`lastTestedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `connector_credential_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_connector_company_type` UNIQUE(`tenantId`,`companyId`,`connectorType`)
);
--> statement-breakpoint
CREATE TABLE `connector_link` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`connectorType` enum('linear','notion','jira') NOT NULL,
	`localKey` varchar(512) NOT NULL,
	`externalId` varchar(128) NOT NULL,
	`externalUrl` text,
	`externalState` varchar(64),
	`lastSyncedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `connector_link_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_connector_company` ON `connector_credential` (`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `idx_connector_link_company` ON `connector_link` (`tenantId`,`companyId`);