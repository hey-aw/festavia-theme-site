import type {
  AppliedTheme,
  PaletteColor,
  ThemeCandidate,
} from "./theme-types";
import { rawDb } from "./runtime-env";

type DatabaseRow = Record<string, unknown>;

function parsePalette(value: unknown): PaletteColor[] {
  if (typeof value !== "string") return [];
  try {
    return JSON.parse(value) as PaletteColor[];
  } catch {
    return [];
  }
}

function candidateFromRow(row: DatabaseRow): ThemeCandidate & { voteCount: number } {
  return {
    id: String(row.id),
    preferenceRank: Number(row.preference_rank) as 1 | 2,
    observanceName: String(row.observance_name),
    observanceSynopsis: String(row.observance_synopsis),
    sourceUrl: String(row.source_url),
    palette: parsePalette(row.palette_json),
    mode: String(row.mode) as ThemeCandidate["mode"],
    effect: String(row.effect) as ThemeCandidate["effect"],
    lightingSynopsis: String(row.lighting_synopsis),
    fallbackPalette: parsePalette(row.fallback_palette_json),
    voteCount: Number(row.vote_count ?? 0),
  };
}

function themeFromRow(row: DatabaseRow): AppliedTheme {
  return {
    date: String(row.date),
    observanceName: String(row.observance_name),
    observanceSynopsis: String(row.observance_synopsis),
    sourceUrl: String(row.source_url),
    palette: parsePalette(row.palette_json),
    mode: String(row.mode) as AppliedTheme["mode"],
    effect: String(row.effect) as AppliedTheme["effect"],
    lightingSynopsis: String(row.lighting_synopsis),
    publicStatus: String(row.public_status) as AppliedTheme["publicStatus"],
    selectedCandidateId: row.selected_candidate_id
      ? String(row.selected_candidate_id)
      : null,
    selectedVoteCount: Number(row.selected_vote_count ?? 0),
    totalVoteCount: Number(row.total_vote_count ?? 0),
    substitutionNote: row.substitution_note
      ? String(row.substitution_note)
      : null,
    updatedAt: String(row.updated_at),
  };
}

export async function listThemes(limit: number): Promise<AppliedTheme[]> {
  const result = await rawDb()
    .prepare(
      `SELECT date, observance_name, observance_synopsis, source_url,
        palette_json, mode, effect, lighting_synopsis, public_status,
        selected_candidate_id, selected_vote_count, total_vote_count,
        substitution_note, updated_at
      FROM themes
      ORDER BY date DESC
      LIMIT ?`,
    )
    .bind(limit)
    .all<DatabaseRow>();
  return result.results.map(themeFromRow);
}

export async function themeForDate(date: string): Promise<AppliedTheme | null> {
  const row = await rawDb()
    .prepare(
      `SELECT date, observance_name, observance_synopsis, source_url,
        palette_json, mode, effect, lighting_synopsis, public_status,
        selected_candidate_id, selected_vote_count, total_vote_count,
        substitution_note, updated_at
      FROM themes
      WHERE date = ?`,
    )
    .bind(date)
    .first<DatabaseRow>();
  return row ? themeFromRow(row) : null;
}

export async function pollForDate(date: string): Promise<{
  date: string;
  opensAt: string;
  closesAt: string;
} | null> {
  const row = await rawDb()
    .prepare("SELECT date, opens_at, closes_at FROM polls WHERE date = ?")
    .bind(date)
    .first<DatabaseRow>();
  if (!row) return null;
  return {
    date: String(row.date),
    opensAt: String(row.opens_at),
    closesAt: String(row.closes_at),
  };
}

export async function candidatesForDate(
  date: string,
): Promise<Array<ThemeCandidate & { voteCount: number }>> {
  const result = await rawDb()
    .prepare(
      `SELECT c.id, c.preference_rank, c.observance_name,
        c.observance_synopsis, c.source_url, c.palette_json, c.mode,
        c.effect, c.lighting_synopsis, c.fallback_palette_json,
        COUNT(v.candidate_id) AS vote_count
      FROM theme_candidates c
      LEFT JOIN votes v
        ON v.poll_date = c.poll_date AND v.candidate_id = c.id
      WHERE c.poll_date = ?
      GROUP BY c.id
      ORDER BY c.preference_rank ASC`,
    )
    .bind(date)
    .all<DatabaseRow>();
  return result.results.map(candidateFromRow);
}

export async function voteForVoter(
  date: string,
  voterHash: string,
): Promise<string | null> {
  const row = await rawDb()
    .prepare("SELECT candidate_id FROM votes WHERE poll_date = ? AND voter_hash = ?")
    .bind(date, voterHash)
    .first<{ candidate_id: string }>();
  return row?.candidate_id ?? null;
}

export async function castVote(input: {
  date: string;
  voterHash: string;
  rateHash: string;
  candidateId: string;
}): Promise<void> {
  const database = rawDb();
  const now = new Date().toISOString();
  const rateRow = await database
    .prepare(
      "SELECT attempts FROM vote_rate_limits WHERE date = ? AND rate_hash = ?",
    )
    .bind(input.date, input.rateHash)
    .first<{ attempts: number }>();
  if ((rateRow?.attempts ?? 0) >= 20) {
    throw new Error("RATE_LIMITED");
  }

  const candidate = await database
    .prepare(
      "SELECT id FROM theme_candidates WHERE poll_date = ? AND id = ?",
    )
    .bind(input.date, input.candidateId)
    .first<{ id: string }>();
  if (!candidate) throw new Error("INVALID_CANDIDATE");

  await database.batch([
    database
      .prepare(
        `INSERT INTO vote_rate_limits (date, rate_hash, attempts, updated_at)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(date, rate_hash)
        DO UPDATE SET attempts = attempts + 1, updated_at = excluded.updated_at`,
      )
      .bind(input.date, input.rateHash, now),
    database
      .prepare(
        `INSERT INTO votes (poll_date, voter_hash, candidate_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(poll_date, voter_hash)
        DO UPDATE SET candidate_id = excluded.candidate_id,
          updated_at = excluded.updated_at`,
      )
      .bind(
        input.date,
        input.voterHash,
        input.candidateId,
        now,
        now,
      ),
  ]);
}

export async function upsertPoll(input: {
  date: string;
  opensAt: string;
  closesAt: string;
  candidates: [ThemeCandidate, ThemeCandidate];
}): Promise<void> {
  const database = rawDb();
  const now = new Date().toISOString();
  const voteCount = await database
    .prepare("SELECT COUNT(*) AS count FROM votes WHERE poll_date = ?")
    .bind(input.date)
    .first<{ count: number }>();
  const existingCandidates = await database
    .prepare("SELECT id FROM theme_candidates WHERE poll_date = ? ORDER BY id")
    .bind(input.date)
    .all<{ id: string }>();
  const existingIds = existingCandidates.results.map((row) => row.id).sort();
  const newIds = input.candidates.map((candidate) => candidate.id).sort();
  if (
    Number(voteCount?.count ?? 0) > 0 &&
    JSON.stringify(existingIds) !== JSON.stringify(newIds)
  ) {
    throw new Error("ACTIVE_POLL_CANDIDATES_CANNOT_CHANGE");
  }

  const statements = [
    database
      .prepare(
        `INSERT INTO polls (date, opens_at, closes_at, status, created_at, updated_at)
        VALUES (?, ?, ?, 'scheduled', ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          opens_at = excluded.opens_at,
          closes_at = excluded.closes_at,
          updated_at = excluded.updated_at`,
      )
      .bind(input.date, input.opensAt, input.closesAt, now, now),
  ];

  if (Number(voteCount?.count ?? 0) === 0) {
    statements.push(
      database
        .prepare("DELETE FROM theme_candidates WHERE poll_date = ?")
        .bind(input.date),
    );
  }

  for (const candidate of input.candidates) {
    statements.push(
      database
        .prepare(
          `INSERT INTO theme_candidates (
            id, poll_date, preference_rank, observance_name,
            observance_synopsis, source_url, palette_json, mode, effect,
            lighting_synopsis, fallback_palette_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            preference_rank = excluded.preference_rank,
            observance_name = excluded.observance_name,
            observance_synopsis = excluded.observance_synopsis,
            source_url = excluded.source_url,
            palette_json = excluded.palette_json,
            mode = excluded.mode,
            effect = excluded.effect,
            lighting_synopsis = excluded.lighting_synopsis,
            fallback_palette_json = excluded.fallback_palette_json,
            updated_at = excluded.updated_at`,
        )
        .bind(
          candidate.id,
          input.date,
          candidate.preferenceRank,
          candidate.observanceName,
          candidate.observanceSynopsis,
          candidate.sourceUrl,
          JSON.stringify(candidate.palette),
          candidate.mode,
          candidate.effect,
          candidate.lightingSynopsis,
          JSON.stringify(candidate.fallbackPalette),
          now,
          now,
        ),
    );
  }

  await database.batch(statements);
}

export async function rankedPollResult(
  date: string,
): Promise<Array<ThemeCandidate & { voteCount: number }>> {
  const candidates = await candidatesForDate(date);
  return candidates.sort(
    (left, right) =>
      right.voteCount - left.voteCount ||
      left.preferenceRank - right.preferenceRank,
  );
}

export async function upsertAppliedTheme(theme: AppliedTheme): Promise<void> {
  await rawDb()
    .prepare(
      `INSERT INTO themes (
        date, observance_name, observance_synopsis, source_url,
        palette_json, mode, effect, lighting_synopsis, public_status,
        selected_candidate_id, selected_vote_count, total_vote_count,
        substitution_note, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        observance_name = excluded.observance_name,
        observance_synopsis = excluded.observance_synopsis,
        source_url = excluded.source_url,
        palette_json = excluded.palette_json,
        mode = excluded.mode,
        effect = excluded.effect,
        lighting_synopsis = excluded.lighting_synopsis,
        public_status = excluded.public_status,
        selected_candidate_id = excluded.selected_candidate_id,
        selected_vote_count = excluded.selected_vote_count,
        total_vote_count = excluded.total_vote_count,
        substitution_note = excluded.substitution_note,
        updated_at = excluded.updated_at`,
    )
    .bind(
      theme.date,
      theme.observanceName,
      theme.observanceSynopsis,
      theme.sourceUrl,
      JSON.stringify(theme.palette),
      theme.mode,
      theme.effect,
      theme.lightingSynopsis,
      theme.publicStatus,
      theme.selectedCandidateId,
      theme.selectedVoteCount,
      theme.totalVoteCount,
      theme.substitutionNote,
      theme.updatedAt,
    )
    .run();
}
