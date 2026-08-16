ALTER TABLE `vote_notification_events` RENAME TO `discord_notification_events`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_discord_notification_events` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_date` text NOT NULL,
	`event_type` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`voter_hash` text,
	`candidate_id` text,
	`created_at` text NOT NULL,
	`claimed_at` text,
	`claim_token` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`delivered_at` text,
	`discord_message_id` text,
	`last_error_code` text,
	FOREIGN KEY (`poll_date`) REFERENCES `polls`(`date`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`poll_date`,`candidate_id`) REFERENCES `theme_candidates`(`poll_date`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_discord_notification_events`(
	"id", "poll_date", "event_type", "dedupe_key", "voter_hash",
	"candidate_id", "created_at", "claimed_at", "claim_token",
	"attempt_count", "delivered_at", "discord_message_id", "last_error_code"
)
SELECT
	"id", "poll_date", 'vote_cast',
	'vote_cast:' || "poll_date" || ':' || "voter_hash",
	"voter_hash", "candidate_id", "created_at", NULL, NULL, 0,
	"delivered_at", NULL, NULL
FROM `discord_notification_events`;--> statement-breakpoint
DROP TABLE `discord_notification_events`;--> statement-breakpoint
ALTER TABLE `__new_discord_notification_events` RENAME TO `discord_notification_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `discord_notification_events_dedupe_idx` ON `discord_notification_events` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `discord_notification_events_pending_idx` ON `discord_notification_events` (`delivered_at`,`claimed_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `discord_notification_events_poll_idx` ON `discord_notification_events` (`poll_date`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
