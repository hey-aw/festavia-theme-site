CREATE TABLE `polls` (
	`date` text PRIMARY KEY NOT NULL,
	`opens_at` text NOT NULL,
	`closes_at` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `theme_candidates` (
	`id` text PRIMARY KEY NOT NULL,
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
	FOREIGN KEY (`poll_date`) REFERENCES `polls`(`date`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `theme_candidates_poll_rank_idx` ON `theme_candidates` (`poll_date`,`preference_rank`);--> statement-breakpoint
CREATE INDEX `theme_candidates_poll_idx` ON `theme_candidates` (`poll_date`);--> statement-breakpoint
CREATE TABLE `themes` (
	`date` text PRIMARY KEY NOT NULL,
	`observance_name` text NOT NULL,
	`observance_synopsis` text NOT NULL,
	`source_url` text NOT NULL,
	`palette_json` text NOT NULL,
	`mode` text NOT NULL,
	`effect` text NOT NULL,
	`lighting_synopsis` text NOT NULL,
	`public_status` text DEFAULT 'active' NOT NULL,
	`selected_candidate_id` text,
	`selected_vote_count` integer DEFAULT 0 NOT NULL,
	`total_vote_count` integer DEFAULT 0 NOT NULL,
	`substitution_note` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `themes_date_idx` ON `themes` (`date`);--> statement-breakpoint
CREATE TABLE `vote_rate_limits` (
	`date` text NOT NULL,
	`rate_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`date`, `rate_hash`)
);
--> statement-breakpoint
CREATE INDEX `vote_rate_limits_date_idx` ON `vote_rate_limits` (`date`);--> statement-breakpoint
CREATE TABLE `votes` (
	`poll_date` text NOT NULL,
	`voter_hash` text NOT NULL,
	`candidate_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`poll_date`, `voter_hash`),
	FOREIGN KEY (`poll_date`) REFERENCES `polls`(`date`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`candidate_id`) REFERENCES `theme_candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `votes_poll_candidate_idx` ON `votes` (`poll_date`,`candidate_id`);
--> statement-breakpoint
INSERT INTO `themes` (
	`date`, `observance_name`, `observance_synopsis`, `source_url`,
	`palette_json`, `mode`, `effect`, `lighting_synopsis`, `public_status`,
	`selected_candidate_id`, `selected_vote_count`, `total_vote_count`,
	`substitution_note`, `updated_at`
) VALUES
(
	'2026-07-16',
	'World Snake Day',
	'World Snake Day invites a closer look at the remarkable diversity of snakes and the important roles they play in healthy ecosystems.',
	'https://www.lpzoo.org/event/world-snake-day/',
	'[{"name":"Emerald scale","hex":"#0B6E4F"},{"name":"Venom gold","hex":"#F6D32D"},{"name":"Coral belly","hex":"#C92A2A"},{"name":"Iridescent blue","hex":"#1D4ED8"},{"name":"Bone white","hex":"#F8F1D8"}]',
	'Static gradient',
	'no_effect',
	'Jewel-like greens, gold, coral, blue, and bone white trace a vivid path along the house.',
	'active', NULL, 0, 0, NULL, '2026-07-16T18:04:00-07:00'
),
(
	'2026-07-17',
	'World Emoji Day',
	'World Emoji Day celebrates the small symbols that help people add tone, feeling, and playfulness to everyday digital conversation.',
	'https://worldemojiday.com/',
	'[{"name":"Emoji yellow","hex":"#FFD23F"},{"name":"Calendar white","hex":"#FFFFFF"},{"name":"Notification red","hex":"#E63946"},{"name":"Chat bubble blue","hex":"#277DA1"},{"name":"Ink black","hex":"#1F2937"}]',
	'Static gradient',
	'no_effect',
	'Bright yellow leads a graphic mix of white, red, blue, and ink-black accents.',
	'active', NULL, 0, 0, NULL, '2026-07-17T18:03:00-07:00'
),
(
	'2026-07-18',
	'Nelson Mandela International Day',
	'Nelson Mandela International Day honors a life of service and asks people to make a practical contribution to their communities.',
	'https://www.un.org/en/observances/nelson-mandela-day',
	'[{"name":"Green","hex":"#007A4D"},{"name":"Gold","hex":"#FFB612"},{"name":"Red","hex":"#DE3831"},{"name":"Blue","hex":"#002395"},{"name":"Black","hex":"#000000"}]',
	'Static gradient',
	'no_effect',
	'Green, gold, red, blue, and black form a bold, dignified sequence across the display.',
	'active', NULL, 0, 0, NULL, '2026-07-18T18:05:00-07:00'
),
(
	'2026-07-20',
	'World Chess Day',
	'World Chess Day recognizes a game of strategy and imagination that crosses languages, borders, and generations.',
	'https://www.un.org/en/observances/world-chess-day',
	'[{"name":"Ivory square","hex":"#FFF8E7"},{"name":"Ebony square","hex":"#0B1026"},{"name":"Crown gold","hex":"#D4AF37"},{"name":"Tournament red","hex":"#B00020"},{"name":"Board green","hex":"#0B6E4F"}]',
	'Static gradient',
	'no_effect',
	'Ivory and ebony anchor measured turns of gold, tournament red, and board green.',
	'active', NULL, 0, 0, NULL, '2026-07-20T18:03:00-07:00'
),
(
	'2026-07-21',
	'Belgium National Day',
	'Belgium National Day marks the anniversary of the first king taking the constitutional oath in 1831.',
	'https://www.belgium.be/en/about_belgium/country/belgium_in_nutshell/symbols/national_holiday',
	'[{"name":"Tricolor black","hex":"#0B1026"},{"name":"Gold","hex":"#FFD90A"},{"name":"Red","hex":"#EF3340"},{"name":"Parade white","hex":"#FFFFFF"},{"name":"Royal blue","hex":"#0055A4"}]',
	'Static gradient',
	'no_effect',
	'Belgian black, gold, and red lead the display, lifted by parade white and royal blue.',
	'active', NULL, 0, 0, NULL, '2026-07-21T18:03:00-07:00'
),
(
	'2026-07-22',
	'World Brain Day',
	'World Brain Day brings global attention to brain health, prevention, access, and care.',
	'https://wfneurology.org/world-brain-day-2026',
	'[{"name":"Deep cortex navy","hex":"#111827"},{"name":"Neural violet","hex":"#7C3AED"},{"name":"Synapse cyan","hex":"#22D3EE"},{"name":"Access green","hex":"#22C55E"},{"name":"Care white","hex":"#F8FAFC"}]',
	'Static gradient',
	'no_effect',
	'Deep navy and violet connect through cyan, green, and white like a calm network of signals.',
	'active', NULL, 0, 0, NULL, '2026-07-22T18:04:00-07:00'
),
(
	'2026-07-23',
	'National Vanilla Ice Cream Day',
	'National Vanilla Ice Cream Day celebrates the classic flavor that makes a perfect base for cones, sauces, and colorful toppings.',
	'https://www.timeanddate.com/holidays/fun/vanilla-ice-cream-day',
	'[{"name":"Vanilla scoop","hex":"#FFF3C4"},{"name":"Waffle cone","hex":"#C98232"},{"name":"Cherry sauce","hex":"#D7263D"},{"name":"Blue sprinkle","hex":"#2563EB"},{"name":"Mint sprinkle","hex":"#2DD4BF"}]',
	'Static gradient',
	'no_effect',
	'Vanilla and waffle-cone warmth are dotted with cherry, blue, and mint-sprinkle color.',
	'active', NULL, 0, 0, NULL, '2026-07-23T18:04:00-07:00'
);
