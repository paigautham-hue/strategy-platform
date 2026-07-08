CREATE TABLE `analysis_run` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`companyId` int NOT NULL,
	`projectId` int,
	`kind` enum('diagnosis','research','frameworks','options','red_team','war_game','pre_mortem','briefing','brainstorm','decompose') NOT NULL,
	`inputSummary` varchar(512) NOT NULL,
	`result` json NOT NULL,
	`model` varchar(128),
	`costUsd` float,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysis_run_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_analysis_company_kind` ON `analysis_run` (`tenantId`,`companyId`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_analysis_created` ON `analysis_run` (`createdAt`);