"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Check,
  Clock3,
  Download,
  ExternalLink,
  RefreshCw,
  SquareCheckBig,
  Sparkles,
} from "lucide-react";
import { formatPacificDate } from "@/lib/pacific-time";
import { summarizePollResults } from "@/lib/poll-results";
import type {
  AppliedTheme,
  PaletteColor,
  PublicPoll,
  ThemeCandidate,
} from "@/lib/theme-types";

type ThemeResponse = { themes: AppliedTheme[] };
type BulbStyle = CSSProperties & { "--bulb-color": string };
type ResultBarStyle = CSSProperties & { "--result-width": string };

const fallbackPalette: PaletteColor[] = [
  { name: "Door pink", hex: "#F52975" },
  { name: "Porch white", hex: "#FFF8FB" },
  { name: "Garden green", hex: "#A8D948" },
  { name: "Evening cyan", hex: "#57D7E8" },
];

async function fetchSiteData(): Promise<{
  themes: AppliedTheme[];
  poll: PublicPoll;
}> {
  const [themeResponse, pollResponse] = await Promise.all([
    fetch("/api/themes?limit=7", { cache: "no-store" }),
    fetch("/api/polls/today", { cache: "no-store" }),
  ]);
  if (!themeResponse.ok || !pollResponse.ok) throw new Error("load failed");
  const themeData = (await themeResponse.json()) as ThemeResponse;
  const pollData = (await pollResponse.json()) as PublicPoll;
  return { themes: themeData.themes, poll: pollData };
}

function effectMotion(effect: string): string {
  if (["candle", "fire", "sunbeam"].includes(effect)) return "glow";
  if (["underwater", "cosmos"].includes(effect)) return "drift";
  if (effect !== "no_effect") return "shimmer";
  return "still";
}

function paletteBackground(palette: PaletteColor[]): string {
  const colors = palette.length ? palette : fallbackPalette;
  return `linear-gradient(105deg, ${colors
    .map((color, index) => `${color.hex} ${Math.round((index / Math.max(1, colors.length - 1)) * 100)}%`)
    .join(", ")})`;
}

function treatmentBackground(palette: PaletteColor[]): string {
  return palette.length ? paletteBackground(palette) : "var(--ink)";
}

function formatPacificTime(instant: string | null): string {
  if (!instant) return "the posted closing time";
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "the posted closing time";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function treatmentName(theme: Pick<ThemeCandidate, "mode" | "effect">): string {
  if (theme.mode !== "Hue effect" || theme.effect === "no_effect") {
    return "Gradient";
  }
  return theme.effect
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function PollResults({
  poll,
  live,
  standalone = false,
}: {
  poll: PublicPoll;
  live: boolean;
  standalone?: boolean;
}) {
  const {
    results,
    countsAvailable,
    totalVotes,
    highestVoteCount,
    leaderIds,
  } = summarizePollResults(poll.candidates);
  const selectedCandidate = results.find(
    ({ candidate }) => candidate.id === poll.yourVote,
  )?.candidate;
  const leader = results.find(({ candidate }) =>
    leaderIds.includes(candidate.id),
  )?.candidate;
  const outcome = !countsAvailable
    ? "Results are updating."
    : totalVotes === 0
      ? "No votes have been counted yet."
      : leaderIds.length > 1
        ? `The vote is tied at ${highestVoteCount} ${highestVoteCount === 1 ? "vote" : "votes"} each.`
        : `${leader?.observanceName ?? "The leading theme"} ${live ? "currently leads" : "finished ahead"} with ${highestVoteCount} ${highestVoteCount === 1 ? "vote" : "votes"}.`;
  const closeTime = formatPacificTime(poll.closesAt);

  return (
    <section
      className={`poll-results ${standalone ? "poll-results-standalone" : ""}`}
      aria-labelledby={standalone ? "closed-results-title" : "live-results-title"}
    >
      <div className="results-heading">
        <div>
          <p className="eyebrow">{live ? "The neighborhood so far" : "The vote"}</p>
          <h3 id={standalone ? "closed-results-title" : "live-results-title"}>
            {live ? "Live results" : "Final results"}
          </h3>
        </div>
        <p className="results-context">
          <Clock3 size={17} aria-hidden="true" />
          {live
            ? `You can change your vote until ${closeTime}.`
            : `Voting closed at ${closeTime}.`}
        </p>
      </div>

      {selectedCandidate ? (
        <p className="selected-choice">
          <Check size={18} aria-hidden="true" />
          Your choice: <strong>{selectedCandidate.observanceName}</strong>
        </p>
      ) : null}

      <div className="result-list">
        {results.map(({ candidate, voteCount, percentage }) => {
          const countLabel =
            voteCount === null
              ? "Count updating"
              : `${voteCount} ${voteCount === 1 ? "vote" : "votes"}`;
          const percentageLabel = countsAvailable
            ? `${percentage}%`
            : "Updating";
          return (
            <div className="result-row" key={candidate.id}>
              <div className="result-label">
                <strong>{candidate.observanceName}</strong>
                <span>
                  {countLabel} <b>{percentageLabel}</b>
                </span>
              </div>
              <div
                className="result-track"
                role="progressbar"
                aria-label={`${candidate.observanceName} vote share`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={countsAvailable ? percentage : undefined}
                aria-valuetext={
                  countsAvailable
                    ? `${countLabel}, ${percentageLabel}`
                    : "Vote count updating"
                }
              >
                <span
                  className="result-fill"
                  style={
                    {
                      "--result-width": countsAvailable
                        ? `${percentage}%`
                        : "0%",
                    } as ResultBarStyle
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="result-outcome" aria-live="polite">
        {outcome}
      </p>
    </section>
  );
}

function LightStrand({
  palette,
  mode,
  effect,
  compact = false,
}: {
  palette: PaletteColor[];
  mode: ThemeCandidate["mode"];
  effect: string;
  compact?: boolean;
}) {
  const colors = palette.length ? palette : fallbackPalette;
  const hasThemeColors = palette.length > 0;
  const bulbs = Array.from({ length: compact ? 12 : 24 }, (_, index) => {
    const color = hasThemeColors
      ? colors[index % colors.length]
      : { name: "Hue-native effect colors", hex: "#FFFFFF" };
    return (
      <span
        aria-hidden="true"
        className="light-bulb"
        key={`${color.hex}-${index}`}
        style={{ "--bulb-color": color.hex } as BulbStyle}
      />
    );
  });

  return (
    <div
      className={`light-strand ${compact ? "light-strand-compact" : ""} preview-${mode === "Hue effect" ? "effect" : "gradient"} motion-${effectMotion(effect)}`}
      style={
        {
          "--preview-gradient": hasThemeColors
            ? paletteBackground(palette)
            : "none",
        } as CSSProperties
      }
      aria-label={
        mode === "Hue effect"
          ? hasThemeColors
            ? `Gentle visual interpretation of the ${effect} effect using ${palette[0]?.name} tint`
            : `Gentle visual interpretation of the Hue-native ${effect} effect; its colors are set by Hue`
          : `Static gradient preview using ${palette.map((color) => color.name).join(", ")}`
      }
      role="img"
    >
      <div className="preview-gradient" aria-hidden="true" />
      <div className="strand-wire" />
      <div className="bulb-row">{bulbs}</div>
    </div>
  );
}

function Palette({ colors }: { colors: PaletteColor[] }) {
  return (
    <div className="palette" aria-label="Theme palette">
      {colors.map((color) => (
        <div className="swatch" key={`${color.name}-${color.hex}`}>
          <span
            className="swatch-color"
            style={{ background: color.hex }}
            aria-hidden="true"
          />
          <span>
            <strong>{color.name}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

function ThemeDetails({
  theme,
  compact = false,
}: {
  theme: Pick<
    ThemeCandidate,
    | "observanceName"
    | "observanceSynopsis"
    | "sourceUrl"
    | "palette"
    | "mode"
    | "effect"
    | "lightingSynopsis"
  >;
  compact?: boolean;
}) {
  return (
    <>
      <LightStrand
        palette={theme.palette}
        mode={theme.mode}
        effect={theme.effect}
        compact={compact}
      />
      <div className="theme-copy">
        <h3>{theme.observanceName}</h3>
        <p>{theme.observanceSynopsis}</p>
        <a href={theme.sourceUrl} target="_blank" rel="noreferrer">
          Read about the observance <ExternalLink size={15} aria-hidden="true" />
        </a>
      </div>
      <Palette colors={theme.palette} />
      <div className="light-style">
        <Sparkles size={17} aria-hidden="true" />
        <span>{treatmentName(theme)}</span>
      </div>
      <p className="lighting-note">{theme.lightingSynopsis}</p>
    </>
  );
}

export function ThemeExperience() {
  const [themes, setThemes] = useState<AppliedTheme[]>([]);
  const [poll, setPoll] = useState<PublicPoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingFor, setVotingFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    try {
      const data = await fetchSiteData();
      setThemes(data.themes);
      setPoll(data.poll);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void fetchSiteData()
      .then((data) => {
        if (cancelled) return;
        setThemes(data.themes);
        setPoll(data.poll);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const appliedTheme = useMemo(() => {
    if (poll?.phase !== "complete") return null;
    return themes.find((theme) => theme.date === poll.date) ?? null;
  }, [poll, themes]);
  const lastNightTheme = useMemo(
    () => themes.find((theme) => theme.date !== poll?.date) ?? null,
    [poll, themes],
  );
  const archiveThemes = useMemo(
    () =>
      themes
        .filter(
          (theme) =>
            theme.date !== appliedTheme?.date &&
            theme.date !== lastNightTheme?.date,
        )
        .slice(0, 6),
    [appliedTheme, lastNightTheme, themes],
  );

  async function voteFor(candidateId: string) {
    setVotingFor(candidateId);
    setNotice(null);
    try {
      const response = await fetch("/api/polls/today/vote", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Vote failed.");
      await load();
      setNotice("Your vote is in. You can change it until voting closes.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Your vote could not be saved.",
      );
    } finally {
      setVotingFor(null);
    }
  }

  const votingPalette =
    poll?.phase === "open"
      ? poll.candidates.flatMap((candidate) => candidate.palette)
      : [];
  const heroPalette =
    appliedTheme?.palette ?? (poll?.phase === "open" ? votingPalette : []);
  const heroStyle = {
    "--hero-palette": appliedTheme
      ? treatmentBackground(appliedTheme.palette)
      : paletteBackground(heroPalette),
  } as CSSProperties & { "--hero-palette": string };

  return (
    <main>
      <section className="hero" style={heroStyle}>
        <div className="hero-light-field" aria-hidden="true" />
        <header className="site-header">
          <div className="brand-mark" aria-hidden="true">
            <span />
          </div>
          <span>Daily light, chosen together</span>
        </header>

        <div className="hero-content">
          <p className="eyebrow">A neighborhood light ritual</p>
          <h1>The House with the Pink Door</h1>
          {loading ? (
            <p className="hero-status">Finding tonight&apos;s colors...</p>
          ) : appliedTheme ? (
            <div className="hero-theme">
              <span className="date-label">
                {formatPacificDate(appliedTheme.date)}
              </span>
              <h2>{appliedTheme.observanceName}</h2>
              <p>{appliedTheme.observanceSynopsis}</p>
              <a href="#tonight">
                See tonight&apos;s lights <Sparkles size={18} aria-hidden="true" />
              </a>
            </div>
          ) : poll?.phase === "open" ? (
            <div className="hero-theme hero-vote-prompt">
              <span className="date-label">Tonight&apos;s candidates</span>
              <h2>Choose the light for tonight</h2>
              <p>Two verified themes are ready. Your choice sets the evening display.</p>
              <a href="#vote">
                Vote on tonight&apos;s lights
                <SquareCheckBig size={18} aria-hidden="true" />
              </a>
            </div>
          ) : poll?.phase === "preparing" ? (
            <div className="hero-theme">
              <h2>Tonight&apos;s lights are being prepared</h2>
              <p>The winning theme will appear here after it reaches the house.</p>
            </div>
          ) : poll?.phase === "scheduled" ? (
            <div className="hero-theme">
              <h2>Tonight&apos;s choices arrive at 8 AM</h2>
              <p>Come back soon to help choose the evening display.</p>
            </div>
          ) : lastNightTheme ? (
            <div className="hero-theme">
              <span className="date-label">Last night&apos;s light</span>
              <h2>{lastNightTheme.observanceName}</h2>
              <p>Tonight&apos;s choices open at 8 AM Pacific.</p>
              <a href="#last-night">
                See last night&apos;s light <Sparkles size={18} aria-hidden="true" />
              </a>
            </div>
          ) : (
            <div className="hero-theme">
              <span className="date-label">Before tonight&apos;s vote</span>
              <h2>The display is settling in</h2>
              <p>Tonight&apos;s choices arrive at 8 AM Pacific.</p>
            </div>
          )}
        </div>

        <div className="hero-door" aria-hidden="true">
          <div className="door-panel">
            <span className="door-window" />
            <span className="door-handle" />
          </div>
        </div>
      </section>

      {poll?.phase === "open" && poll.candidates.length === 2 ? (
        <section className="vote-section" id="vote">
          <div className="section-heading">
            <p className="eyebrow">Tonight&apos;s choice</p>
            <h2>Which theme should light the house?</h2>
            <p>
              Two verified themes, one evening display. Voting closes at 5:50
              PM Pacific.
            </p>
          </div>
          <div className="candidate-grid">
            {poll.candidates.map((candidate) => {
              const selected = poll.yourVote === candidate.id;
              return (
                <article
                  className={`candidate ${selected ? "candidate-selected" : ""}`}
                  key={candidate.id}
                >
                  <ThemeDetails theme={candidate} compact />
                  <button
                    type="button"
                    className="vote-button"
                    disabled={votingFor !== null}
                    onClick={() => void voteFor(candidate.id)}
                  >
                    {votingFor === candidate.id ? (
                      <RefreshCw
                        size={18}
                        className="spin"
                        aria-hidden="true"
                      />
                    ) : selected ? (
                      <Check size={18} aria-hidden="true" />
                    ) : (
                      <SquareCheckBig size={18} aria-hidden="true" />
                    )}
                    {selected
                      ? "Your choice"
                      : poll.yourVote
                        ? "Choose instead"
                        : "Vote for this theme"}
                  </button>
                </article>
              );
            })}
          </div>
          {notice ? <p className="vote-notice">{notice}</p> : null}
          {poll.yourVote ? <PollResults poll={poll} live /> : null}
          <p className="privacy-note">
            Vote once per day. We don&apos;t collect any personal information.
          </p>
        </section>
      ) : null}

      {poll?.phase === "scheduled" ? (
        <section className="status-band">
          <Clock3 size={22} aria-hidden="true" />
          <p>
            Today&apos;s two choices arrive at 8 AM Pacific. Come back to help
            choose tonight&apos;s lights.
          </p>
        </section>
      ) : null}

      {poll?.phase === "preparing" ? (
        <section className="status-band">
          <Sparkles size={22} aria-hidden="true" />
          <p>
            Voting is closed. Tonight&apos;s winning theme is being prepared
            for the lights.
          </p>
        </section>
      ) : null}

      {poll &&
      (poll.phase === "preparing" || poll.phase === "complete") &&
      poll.candidates.length > 0 &&
      poll.candidates.some(
        (candidate) => typeof candidate.voteCount === "number",
      ) ? (
        <PollResults poll={poll} live={false} standalone />
      ) : null}

      {appliedTheme ? (
        <section className="tonight-section" id="tonight">
          <div className="section-heading">
            <p className="eyebrow">On the lights</p>
            <h2>Tonight&apos;s display</h2>
          </div>
          <div className="tonight-layout">
            <div
              className="palette-stage"
              style={{ background: treatmentBackground(appliedTheme.palette) }}
            >
              <LightStrand
                palette={appliedTheme.palette}
                mode={appliedTheme.mode}
                effect={appliedTheme.effect}
              />
              <span>{formatPacificDate(appliedTheme.date)}</span>
            </div>
            <div className="tonight-story">
              <ThemeDetails theme={appliedTheme} />
              {appliedTheme.totalVoteCount > 0 ? (
                <p className="vote-result">
                  Chosen with {appliedTheme.selectedVoteCount} of{" "}
                  {appliedTheme.totalVoteCount} votes.
                </p>
              ) : null}
              {appliedTheme.substitutionNote ? (
                <p className="substitution-note">
                  {appliedTheme.substitutionNote}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : lastNightTheme ? (
        <section className="last-night-section tonight-section" id="last-night">
          <div className="section-heading">
            <p className="eyebrow">History from the porch</p>
            <h2>Last night&apos;s light</h2>
            <p>Tonight&apos;s display has not been chosen yet.</p>
          </div>
          <div className="tonight-layout">
            <div
              className="palette-stage"
              style={{ background: treatmentBackground(lastNightTheme.palette) }}
            >
              <LightStrand
                palette={lastNightTheme.palette}
                mode={lastNightTheme.mode}
                effect={lastNightTheme.effect}
              />
              <span>{formatPacificDate(lastNightTheme.date)}</span>
            </div>
            <div className="tonight-story">
              <ThemeDetails theme={lastNightTheme} />
            </div>
          </div>
        </section>
      ) : loadError ? (
        <section className="tonight-section">
          <div className="empty-state">
            <p>Tonight&apos;s theme could not be loaded just now.</p>
            <button
              type="button"
              onClick={() => {
                setLoadError(false);
                setLoading(true);
                void load();
              }}
            >
              <RefreshCw size={18} aria-hidden="true" />
              Try again
            </button>
          </div>
        </section>
      ) : null}

      {archiveThemes.length > 0 ? (
        <section className="archive-section">
          <div className="section-heading">
            <p className="eyebrow">Seven nights of color</p>
            <h2>Recent themes</h2>
          </div>
          <div className="archive-grid">
            {archiveThemes.map((theme) => (
              <article className="archive-item" key={theme.date}>
                <div className="archive-preview">
                  <LightStrand
                    palette={theme.palette}
                    mode={theme.mode}
                    effect={theme.effect}
                    compact
                  />
                </div>
                <span>{formatPacificDate(theme.date)}</span>
                <h3>{theme.observanceName}</h3>
                <p>{theme.lightingSynopsis}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="take-it-with-you">
        <div>
          <p className="eyebrow">For the front walk</p>
          <h2>Share the nightly ritual</h2>
          <p>Download the scannable code or the print-ready porch sign.</p>
        </div>
        <div className="download-actions">
          <a href="/pink-door-qr.svg" download>
            <Download size={18} aria-hidden="true" />
            QR code
          </a>
          <a href="/the-house-with-the-pink-door-sign.pdf" download>
            <Download size={18} aria-hidden="true" />
            Printable sign
          </a>
        </div>
      </section>

      <footer>
        <div className="brand-mark brand-mark-small" aria-hidden="true">
          <span />
        </div>
        <p>
          The House with the Pink Door celebrates a different verified
          observance each evening.
        </p>
      </footer>
    </main>
  );
}
