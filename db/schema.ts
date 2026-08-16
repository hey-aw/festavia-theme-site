import {
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const polls = sqliteTable("polls", {
  date: text("date").primaryKey(),
  opensAt: text("opens_at").notNull(),
  closesAt: text("closes_at").notNull(),
  status: text("status", { enum: ["scheduled", "open", "closed"] })
    .notNull()
    .default("scheduled"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const themeCandidates = sqliteTable(
  "theme_candidates",
  {
    id: text("id").notNull(),
    pollDate: text("poll_date")
      .notNull()
      .references(() => polls.date, { onDelete: "cascade" }),
    preferenceRank: integer("preference_rank").notNull(),
    observanceName: text("observance_name").notNull(),
    observanceSynopsis: text("observance_synopsis").notNull(),
    sourceUrl: text("source_url").notNull(),
    paletteJson: text("palette_json").notNull(),
    mode: text("mode", {
      enum: [
        "Static gradient",
        "Dynamic palette",
        "Hue effect",
        "Static catalog fallback",
      ],
    }).notNull(),
    effect: text("effect").notNull(),
    lightingSynopsis: text("lighting_synopsis").notNull(),
    fallbackPaletteJson: text("fallback_palette_json").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.pollDate, table.id] }),
    uniqueIndex("theme_candidates_poll_rank_idx").on(
      table.pollDate,
      table.preferenceRank,
    ),
    index("theme_candidates_poll_idx").on(table.pollDate),
  ],
);

export const votes = sqliteTable(
  "votes",
  {
    pollDate: text("poll_date")
      .notNull()
      .references(() => polls.date, { onDelete: "cascade" }),
    voterHash: text("voter_hash").notNull(),
    candidateId: text("candidate_id")
      .notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.pollDate, table.voterHash] }),
    foreignKey({
      columns: [table.pollDate, table.candidateId],
      foreignColumns: [themeCandidates.pollDate, themeCandidates.id],
      name: "votes_poll_candidate_fk",
    }).onDelete("cascade"),
    index("votes_poll_candidate_idx").on(table.pollDate, table.candidateId),
  ],
);

export const discordNotificationEvents = sqliteTable(
  "discord_notification_events",
  {
    id: text("id").primaryKey(),
    pollDate: text("poll_date")
      .notNull()
      .references(() => polls.date, { onDelete: "cascade" }),
    eventType: text("event_type", {
      enum: ["poll_opened", "vote_cast", "poll_closed"],
    }).notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    voterHash: text("voter_hash"),
    candidateId: text("candidate_id"),
    createdAt: text("created_at").notNull(),
    claimedAt: text("claimed_at"),
    claimToken: text("claim_token"),
    attemptCount: integer("attempt_count").notNull().default(0),
    deliveredAt: text("delivered_at"),
    discordMessageId: text("discord_message_id"),
    lastErrorCode: text("last_error_code"),
  },
  (table) => [
    foreignKey({
      columns: [table.pollDate, table.candidateId],
      foreignColumns: [themeCandidates.pollDate, themeCandidates.id],
      name: "discord_notification_events_poll_candidate_fk",
    }).onDelete("cascade"),
    uniqueIndex("discord_notification_events_dedupe_idx").on(table.dedupeKey),
    index("discord_notification_events_pending_idx").on(
      table.deliveredAt,
      table.claimedAt,
      table.createdAt,
    ),
    index("discord_notification_events_poll_idx").on(
      table.pollDate,
      table.createdAt,
    ),
  ],
);

export const voteRateLimits = sqliteTable(
  "vote_rate_limits",
  {
    date: text("date").notNull(),
    rateHash: text("rate_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.date, table.rateHash] }),
    index("vote_rate_limits_date_idx").on(table.date),
  ],
);

export const themes = sqliteTable(
  "themes",
  {
    date: text("date").primaryKey(),
    observanceName: text("observance_name").notNull(),
    observanceSynopsis: text("observance_synopsis").notNull(),
    sourceUrl: text("source_url").notNull(),
    paletteJson: text("palette_json").notNull(),
    mode: text("mode", {
      enum: [
        "Static gradient",
        "Dynamic palette",
        "Hue effect",
        "Static catalog fallback",
      ],
    }).notNull(),
    effect: text("effect").notNull(),
    lightingSynopsis: text("lighting_synopsis").notNull(),
    publicStatus: text("public_status", {
      enum: ["active", "unavailable"],
    })
      .notNull()
      .default("active"),
    selectedCandidateId: text("selected_candidate_id"),
    selectedVoteCount: integer("selected_vote_count").notNull().default(0),
    totalVoteCount: integer("total_vote_count").notNull().default(0),
    substitutionNote: text("substitution_note"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("themes_date_idx").on(table.date)],
);
