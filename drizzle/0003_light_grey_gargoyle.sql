CREATE TABLE `completeness_tracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`sessionId` int,
	`businessModel` int NOT NULL DEFAULT 0,
	`financials` int NOT NULL DEFAULT 0,
	`operations` int NOT NULL DEFAULT 0,
	`organization` int NOT NULL DEFAULT 0,
	`technology` int NOT NULL DEFAULT 0,
	`overall` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `completeness_tracking_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_completeness_company_session` UNIQUE(`tenantId`,`companyId`,`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `digital_twin` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int,
	`dimension` enum('businessModel','financials','operations','organization','technology') NOT NULL,
	`summary` text NOT NULL,
	`structured` json,
	`confidence` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `digital_twin_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_twin_company_dimension` UNIQUE(`tenantId`,`companyId`,`dimension`)
);
--> statement-breakpoint
CREATE TABLE `strategy_kpi` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int,
	`label` varchar(255) NOT NULL,
	`target` float,
	`current` float,
	`unit` varchar(32),
	`category` enum('operational','market','financial','organizational') NOT NULL DEFAULT 'operational',
	`status` enum('on-track','at-risk','off-track','unknown') NOT NULL DEFAULT 'unknown',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategy_kpi_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategy_milestone` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`quarter` varchar(16),
	`fiscalYear` varchar(16),
	`status` enum('planned','in-progress','done','missed') NOT NULL DEFAULT 'planned',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategy_milestone_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `strategy_risk` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`probability` int NOT NULL DEFAULT 0,
	`impact` int NOT NULL DEFAULT 0,
	`riskScore` int NOT NULL DEFAULT 0,
	`mitigation` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategy_risk_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_completeness_company` ON `completeness_tracking` (`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `idx_twin_company` ON `digital_twin` (`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `idx_kpi_company_project` ON `strategy_kpi` (`tenantId`,`companyId`,`projectId`);--> statement-breakpoint
CREATE INDEX `idx_milestone_company_project` ON `strategy_milestone` (`tenantId`,`companyId`,`projectId`);--> statement-breakpoint
CREATE INDEX `idx_risk_company_project` ON `strategy_risk` (`tenantId`,`companyId`,`projectId`);