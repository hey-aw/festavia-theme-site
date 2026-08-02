export const THEME_MODES = [
  "Static gradient",
  "Hue effect",
  "Static catalog fallback",
] as const;

export const HUE_EFFECTS = [
  "no_effect",
  "candle",
  "fire",
  "prism",
  "sparkle",
  "opal",
  "glisten",
  "underwater",
  "cosmos",
  "sunbeam",
  "enchant",
] as const;

export type ThemeMode = (typeof THEME_MODES)[number];
export type HueEffect = (typeof HUE_EFFECTS)[number];

export type PaletteColor = {
  name: string;
  hex: string;
};

export type ThemeCandidate = {
  id: string;
  preferenceRank: 1 | 2;
  observanceName: string;
  observanceSynopsis: string;
  sourceUrl: string;
  palette: PaletteColor[];
  mode: ThemeMode;
  effect: HueEffect;
  lightingSynopsis: string;
  fallbackPalette: PaletteColor[];
};

export type AppliedTheme = Omit<
  ThemeCandidate,
  "id" | "preferenceRank" | "fallbackPalette"
> & {
  date: string;
  publicStatus: "active" | "unavailable";
  selectedCandidateId: string | null;
  selectedVoteCount: number;
  totalVoteCount: number;
  substitutionNote: string | null;
  updatedAt: string;
};

export type PollPhase =
  | "not_scheduled"
  | "scheduled"
  | "open"
  | "preparing"
  | "complete";

export type PublicPoll = {
  date: string;
  opensAt: string | null;
  closesAt: string | null;
  phase: PollPhase;
  candidates: Array<
    ThemeCandidate & {
      voteCount?: number;
    }
  >;
  yourVote: string | null;
  shareUrl?: string;
  imageUrl?: string;
};
