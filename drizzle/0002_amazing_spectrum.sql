CREATE TABLE `vote_notification_events` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_date` text NOT NULL,
	`voter_hash` text NOT NULL,
	`candidate_id` text NOT NULL,
	`created_at` text NOT NULL,
	`delivered_at` text,
	FOREIGN KEY (`poll_date`) REFERENCES `polls`(`date`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poll_date`,`candidate_id`) REFERENCES `theme_candidates`(`poll_date`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vote_notification_events_voter_idx` ON `vote_notification_events` (`poll_date`,`voter_hash`);--> statement-breakpoint
CREATE INDEX `vote_notification_events_pending_idx` ON `vote_notification_events` (`poll_date`,`delivered_at`,`created_at`);