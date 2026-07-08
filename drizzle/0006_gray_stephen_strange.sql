DROP INDEX `idx_outcome_prediction` ON `outcome`;--> statement-breakpoint
ALTER TABLE `outcome` ADD CONSTRAINT `uq_outcome_prediction` UNIQUE(`predictionId`);