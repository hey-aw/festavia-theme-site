PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_theme_candidates` (
	`id` text NOT NULL,
	`poll_date` text NOT NULL,
	`preference_rank` integer NOT NULL,
	`observance_name` text NOT NULL,
	`observance_synopsis` text NOT NULL,
	`source_url` text NOT NULL,
	`palette_json` text NOT NULL,
	`mode` text NOT NULL,
	`effect` text NOT NULL,
	`lighting_synopsis` text NOT NULL,
	`fallback_palette_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`poll_date`, `id`),
	FOREIGN KEY (`poll_date`) REFERENCES `polls`(`date`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_theme_candidates`("id", "poll_date", "preference_rank", "observance_name", "observance_synopsis", "source_url", "palette_json", "mode", "effect", "lighting_synopsis", "fallback_palette_json", "created_at", "updated_at") SELECT "id", "poll_date", "preference_rank", "observance_name", "observance_synopsis", "source_url", "palette_json", "mode", "effect", "lighting_synopsis", "fallback_palette_json", "created_at", "updated_at" FROM `theme_candidates`;--> statement-breakpoint
DROP TABLE `theme_candidates`;--> statement-breakpoint
ALTER TABLE `__new_theme_candidates` RENAME TO `theme_candidates`;--> statement-breakpoint
CREATE UNIQUE INDEX `theme_candidates_poll_rank_idx` ON `theme_candidates` (`poll_date`,`preference_rank`);--> statement-breakpoint
CREATE INDEX `theme_candidates_poll_idx` ON `theme_candidates` (`poll_date`);--> statement-breakpoint
CREATE TABLE `__new_votes` (
	`poll_date` text NOT NULL,
	`voter_hash` text NOT NULL,
	`candidate_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`poll_date`, `voter_hash`),
	FOREIGN KEY (`poll_date`) REFERENCES `polls`(`date`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poll_date`,`candidate_id`) REFERENCES `theme_candidates`(`poll_date`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_votes`("poll_date", "voter_hash", "candidate_id", "created_at", "updated_at") SELECT "poll_date", "voter_hash", "candidate_id", "created_at", "updated_at" FROM `votes`;--> statement-breakpoint
DROP TABLE `votes`;--> statement-breakpoint
ALTER TABLE `__new_votes` RENAME TO `votes`;--> statement-breakpoint
CREATE INDEX `votes_poll_candidate_idx` ON `votes` (`poll_date`,`candidate_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
