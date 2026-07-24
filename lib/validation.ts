import {
  HUE_EFFECTS,
  THEME_MODES,
  type AppliedTheme,
  type PaletteColor,
  type ThemeCandidate,
} from "./theme-types";
import { isIsoDate, pacificInstant } from "./pacific-time";

const HEX_COLOR = /^#[0-9A-F]{6}$/;
const CANDIDATE_ID = /^[a-z0-9][a-z0-9-]{2,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(
  value: unknown,
  label: string,
  min: number,
  max: number,
): string {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new Error(`${label} must be ${min}-${max} characters.`);
  }
  return normalized;
}

function paletteField(
  value: unknown,
  label: string,
  min = 1,
  max = 5,
): PaletteColor[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new Error(`${label} must contain ${min}-${max} colors.`);
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${label}[${index}] is invalid.`);
    const name = stringField(entry.name, `${label}[${index}].name`, 1, 40);
    const hex = stringField(entry.hex, `${label}[${index}].hex`, 7, 7).toUpperCase();
    if (!HEX_COLOR.test(hex)) {
      throw new Error(`${label}[${index}].hex must be #RRGGBB.`);
    }
    return { name, hex };
  });
}

function sourceUrlField(value: unknown): string {
  const sourceUrl = stringField(value, "sourceUrl", 8, 500);
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error("sourceUrl must be a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("sourceUrl must use HTTPS.");
  }
  return sourceUrl;
}

export function validateCandidate(value: unknown): ThemeCandidate {
  if (!isRecord(value)) throw new Error("Candidate must be an object.");
  const id = stringField(value.id, "id", 3, 64);
  if (!CANDIDATE_ID.test(id)) {
    throw new Error("Candidate id must use lowercase letters, digits, and hyphens.");
  }
  const preferenceRank = Number(value.preferenceRank);
  if (preferenceRank !== 1 && preferenceRank !== 2) {
    throw new Error("preferenceRank must be 1 or 2.");
  }
  const mode = stringField(value.mode, "mode", 1, 40);
  if (!THEME_MODES.includes(mode as (typeof THEME_MODES)[number])) {
    throw new Error("Unsupported mode.");
  }
  const effect = stringField(value.effect, "effect", 1, 40);
  if (!HUE_EFFECTS.includes(effect as (typeof HUE_EFFECTS)[number])) {
    throw new Error("Unsupported effect.");
  }
  const palette =
    mode === "Hue effect"
      ? paletteField(value.palette, "palette", 0, 1)
      : paletteField(value.palette, "palette", 3, 5);
  const fallbackPalette = paletteField(value.fallbackPalette, "fallbackPalette", 3, 5);
  if (mode !== "Hue effect" && effect !== "no_effect") {
    throw new Error("Static themes must use no_effect.");
  }
  if (mode === "Hue effect" && effect === "no_effect") {
    throw new Error("Hue effect themes must select an effect.");
  }
  return {
    id,
    preferenceRank,
    observanceName: stringField(
      value.observanceName,
      "observanceName",
      2,
      100,
    ),
    observanceSynopsis: stringField(
      value.observanceSynopsis,
      "observanceSynopsis",
      20,
      500,
    ),
    sourceUrl: sourceUrlField(value.sourceUrl),
    palette,
    mode: mode as ThemeCandidate["mode"],
    effect: effect as ThemeCandidate["effect"],
    lightingSynopsis: stringField(
      value.lightingSynopsis,
      "lightingSynopsis",
      10,
      320,
    ),
    fallbackPalette,
  };
}

export function validatePollPayload(
  value: unknown,
  date: string,
): {
  opensAt: string;
  closesAt: string;
  candidates: [ThemeCandidate, ThemeCandidate];
} {
  if (!isIsoDate(date)) throw new Error("Invalid poll date.");
  if (!isRecord(value)) throw new Error("Poll payload must be an object.");
  const opensAt = stringField(value.opensAt, "opensAt", 20, 40);
  const closesAt = stringField(value.closesAt, "closesAt", 20, 40);
  if (!Number.isFinite(Date.parse(opensAt)) || !Number.isFinite(Date.parse(closesAt))) {
    throw new Error("Poll times must be valid ISO timestamps.");
  }
  const expectedOpensAt = pacificInstant(date, 8, 0);
  const expectedClosesAt = pacificInstant(date, 17, 50);
  if (
    new Date(opensAt).toISOString() !== expectedOpensAt ||
    new Date(closesAt).toISOString() !== expectedClosesAt
  ) {
    throw new Error(
      "Poll must open at 08:00 and close at 17:50 America/Los_Angeles.",
    );
  }
  if (!Array.isArray(value.candidates) || value.candidates.length !== 2) {
    throw new Error("Poll must contain exactly two candidates.");
  }
  const candidates = value.candidates.map(validateCandidate);
  if (new Set(candidates.map((candidate) => candidate.id)).size !== 2) {
    throw new Error("Candidate ids must be unique.");
  }
  if (new Set(candidates.map((candidate) => candidate.preferenceRank)).size !== 2) {
    throw new Error("Candidate preference ranks must be 1 and 2.");
  }
  return {
    opensAt: new Date(opensAt).toISOString(),
    closesAt: new Date(closesAt).toISOString(),
    candidates: candidates as [ThemeCandidate, ThemeCandidate],
  };
}

export function validateThemePayload(value: unknown, date: string): AppliedTheme {
  if (!isIsoDate(date)) throw new Error("Invalid theme date.");
  if (!isRecord(value)) throw new Error("Theme payload must be an object.");
  const mode = stringField(value.mode, "mode", 1, 40);
  if (!THEME_MODES.includes(mode as (typeof THEME_MODES)[number])) {
    throw new Error("Unsupported mode.");
  }
  const effect = stringField(value.effect, "effect", 1, 40);
  if (!HUE_EFFECTS.includes(effect as (typeof HUE_EFFECTS)[number])) {
    throw new Error("Unsupported effect.");
  }
  if (mode !== "Hue effect" && effect !== "no_effect") {
    throw new Error("Static themes must use no_effect.");
  }
  if (mode === "Hue effect" && effect === "no_effect") {
    throw new Error("Hue effect themes must select an effect.");
  }
  const palette =
    mode === "Hue effect"
      ? paletteField(value.palette, "palette", 0, 1)
      : paletteField(value.palette, "palette", 3, 5);
  const publicStatus = value.publicStatus;
  if (publicStatus !== "active" && publicStatus !== "unavailable") {
    throw new Error("publicStatus must be active or unavailable.");
  }
  const selectedCandidateId =
    typeof value.selectedCandidateId === "string"
      ? stringField(value.selectedCandidateId, "selectedCandidateId", 3, 64)
      : null;
  const selectedVoteCount = Number(value.selectedVoteCount ?? 0);
  const totalVoteCount = Number(value.totalVoteCount ?? 0);
  if (
    !Number.isInteger(selectedVoteCount) ||
    !Number.isInteger(totalVoteCount) ||
    selectedVoteCount < 0 ||
    totalVoteCount < selectedVoteCount
  ) {
    throw new Error("Vote counts are invalid.");
  }
  const substitutionNote =
    value.substitutionNote == null
      ? null
      : stringField(value.substitutionNote, "substitutionNote", 3, 240);
  return {
    date,
    observanceName: stringField(
      value.observanceName,
      "observanceName",
      2,
      100,
    ),
    observanceSynopsis: stringField(
      value.observanceSynopsis,
      "observanceSynopsis",
      20,
      500,
    ),
    sourceUrl: sourceUrlField(value.sourceUrl),
    palette,
    mode: mode as AppliedTheme["mode"],
    effect: effect as AppliedTheme["effect"],
    lightingSynopsis: stringField(
      value.lightingSynopsis,
      "lightingSynopsis",
      10,
      320,
    ),
    publicStatus,
    selectedCandidateId,
    selectedVoteCount,
    totalVoteCount,
    substitutionNote,
    updatedAt: new Date().toISOString(),
  };
}
