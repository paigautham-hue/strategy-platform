CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int,
	`projectId` int,
	`sessionId` int,
	`userId` int,
	`action` varchar(128) NOT NULL,
	`resourceType` varchar(64) NOT NULL,
	`resourceId` varchar(64),
	`confidentialityTier` varchar(32) NOT NULL DEFAULT 'standard',
	`ipAddress` varchar(64),
	`userAgent` text,
	`traceId` varchar(64),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `company` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`industry` varchar(128),
	`description` text,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contradiction` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`aId` int NOT NULL,
	`bId` int NOT NULL,
	`status` enum('open','resolved_in_favor_of_a','resolved_in_favor_of_b','both_valid_with_scope') NOT NULL DEFAULT 'open',
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contradiction_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_contradiction_pair` UNIQUE(`aId`,`bId`)
);
--> statement-breakpoint
CREATE TABLE `decision` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int,
	`sessionId` int,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`chosenOption` text NOT NULL,
	`alternativesConsidered` json,
	`rationale` text,
	`linkedPredictionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `decision_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `export_job` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`requestedBy` int NOT NULL,
	`status` enum('pending','processing','complete','failed') NOT NULL DEFAULT 'pending',
	`storageKey` varchar(512),
	`downloadUrl` text,
	`errorMessage` text,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `export_job_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `llm_call_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int,
	`projectId` int,
	`sessionId` int,
	`userId` int,
	`callType` enum('complete','embed','structured') NOT NULL,
	`model` varchar(128) NOT NULL,
	`tokensIn` int NOT NULL DEFAULT 0,
	`tokensOut` int NOT NULL DEFAULT 0,
	`costUsd` float NOT NULL DEFAULT 0,
	`latencyMs` int,
	`traceId` varchar(64),
	`success` boolean NOT NULL DEFAULT true,
	`errorMessage` text,
	`budgetEnforced` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `llm_call_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memory_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int,
	`sessionId` int,
	`rawContent` text NOT NULL,
	`canonicalForm` text NOT NULL,
	`embeddingModelVersion` varchar(64) NOT NULL,
	`embedding` json,
	`validAt` timestamp NOT NULL,
	`invalidAt` timestamp,
	`ingestedAt` timestamp NOT NULL DEFAULT (now()),
	`provenanceClusterId` varchar(64) NOT NULL,
	`sourceUrl` text,
	`sourceDomain` varchar(255),
	`confidence` float NOT NULL DEFAULT 0.5,
	`claimModality` enum('actual','hypothetical','simulated','counterfactual') NOT NULL DEFAULT 'actual',
	`derivationDepth` int NOT NULL DEFAULT 0,
	`quarantined` boolean NOT NULL DEFAULT false,
	`dimMarket` varchar(128),
	`dimSegment` varchar(128),
	`dimProduct` varchar(128),
	`dimGeo` varchar(128),
	`dimChannel` varchar(128),
	`dimTech` varchar(128),
	`dimCapability` varchar(128),
	`dimFramework` varchar(128),
	`dimHorizon` varchar(64),
	`decayClass` enum('permanent','slow','fast','ephemeral') NOT NULL DEFAULT 'slow',
	`visibility` enum('company','portfolio','global') NOT NULL DEFAULT 'company',
	`idempotencyKey` varchar(128) NOT NULL,
	`supersededById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memory_item_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_mi_idempotency` UNIQUE(`tenantId`,`companyId`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `outcome` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`predictionId` int NOT NULL,
	`actualValue` text NOT NULL,
	`measuredAt` timestamp NOT NULL,
	`source` text,
	`errorDelta` float,
	`outcomeClass` enum('real','synthetic') NOT NULL DEFAULT 'real',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `outcome_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prediction` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int,
	`sessionId` int,
	`userId` int NOT NULL,
	`claim` text NOT NULL,
	`confidence` float NOT NULL,
	`framework` varchar(128),
	`model` varchar(128) NOT NULL,
	`horizon` varchar(64),
	`targetDate` timestamp,
	`outcomeClass` enum('real','synthetic') NOT NULL DEFAULT 'real',
	`interventionTaken` boolean NOT NULL DEFAULT false,
	`interventionLink` text,
	`derivationDepth` int NOT NULL DEFAULT 0,
	`outcomeId` int,
	`evidenceLink` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prediction_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255),
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `session_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `source_trust_register` (
	`id` int AUTO_INCREMENT NOT NULL,
	`domain` varchar(255) NOT NULL,
	`trustScore` float NOT NULL DEFAULT 0.5,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `source_trust_register_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_trust_register_domain_unique` UNIQUE(`domain`)
);
--> statement-breakpoint
CREATE TABLE `strategy_project` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `strategy_project_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant` (
	`id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usage_event` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int,
	`projectId` int,
	`sessionId` int,
	`userId` int,
	`role` enum('gp','operator','portco_team','admin'),
	`surface` varchar(64) NOT NULL,
	`action` varchar(64) NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usage_event_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('gp','operator','portco_team','admin') NOT NULL DEFAULT 'portco_team';--> statement-breakpoint
ALTER TABLE `users` ADD `tenantId` varchar(64) DEFAULT 'gp1' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `assignedCompanyIds` json;--> statement-breakpoint
CREATE INDEX `idx_audit_company` ON `audit_log` (`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `idx_audit_user` ON `audit_log` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_company_tenant` ON `company` (`tenantId`);--> statement-breakpoint
CREATE INDEX `idx_contradiction_company` ON `contradiction` (`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `idx_decision_company` ON `decision` (`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `idx_export_company` ON `export_job` (`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `idx_llm_company` ON `llm_call_log` (`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `idx_llm_user` ON `llm_call_log` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_llm_created` ON `llm_call_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_mi_company` ON `memory_item` (`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `idx_mi_project` ON `memory_item` (`tenantId`,`companyId`,`projectId`);--> statement-breakpoint
CREATE INDEX `idx_mi_valid` ON `memory_item` (`validAt`,`invalidAt`);--> statement-breakpoint
CREATE INDEX `idx_mi_embed_version` ON `memory_item` (`companyId`,`embeddingModelVersion`);--> statement-breakpoint
CREATE INDEX `idx_outcome_prediction` ON `outcome` (`predictionId`);--> statement-breakpoint
CREATE INDEX `idx_pred_company` ON `prediction` (`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `idx_pred_project` ON `prediction` (`tenantId`,`companyId`,`projectId`);--> statement-breakpoint
CREATE INDEX `idx_session_project` ON `session` (`tenantId`,`companyId`,`projectId`);--> statement-breakpoint
CREATE INDEX `idx_sp_tenant_company` ON `strategy_project` (`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `idx_usage_company` ON `usage_event` (`tenantId`,`companyId`);--> statement-breakpoint
CREATE INDEX `idx_usage_action` ON `usage_event` (`action`);--> statement-breakpoint
CREATE INDEX `idx_usage_created` ON `usage_event` (`createdAt`);