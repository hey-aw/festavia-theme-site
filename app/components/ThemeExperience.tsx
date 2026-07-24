"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Check,
  Clock3,
  Download,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Vote,
} from "lucide-react";
import { formatPacificDate } from "@/lib/pacific-time";
import type {
  AppliedTheme,
  PaletteColor,
  PublicPoll,
  ThemeCandidate,
} from "@/lib/theme-types";

type ThemeResponse = { themes: AppliedTheme[] };
type BulbStyle = CSSProperties & { "--bulb-color": string };

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

function LightStrand({
  palette,
  effect,
  compact = false,
}: {
  palette: PaletteColor[];
  effect: string;
  compact?: boolean;
}) {
  const colors = palette.length ? palette : fallbackPalette;
  const bulbs = Array.from({ length: compact ? 12 : 24 }, (_, index) => {
    const color = colors[index % colors.length];
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
      className={`light-strand ${compact ? "light-strand-compact" : ""} motion-${effectMotion(effect)}`}
      aria-label={
        effect === "no_effect"
          ? "Static palette preview"
          : `Gentle visual interpretation of the ${effect} effect`
      }
      role="img"
    >
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
            <small>{color.hex}</small>
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
      <div className="treatment">
        <span>
          <strong>Mode</strong>
          {theme.mode}
        </span>
        <span>
          <strong>Effect</strong>
          {theme.effect}
        </span>
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

  const todayTheme = useMemo(() => {
    if (!poll) return themes[0] ?? null;
    return themes.find((theme) => theme.date === poll.date) ?? themes[0] ?? null;
  }, [poll, themes]);

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

  const heroPalette = todayTheme?.palette ?? fallbackPalette;
  const heroStyle = {
    "--hero-palette": paletteBackground(heroPalette),
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
          ) : todayTheme ? (
            <div className="hero-theme">
              <span className="date-label">
                {formatPacificDate(todayTheme.date)}
              </span>
              <h2>{todayTheme.observanceName}</h2>
              <p>{todayTheme.observanceSynopsis}</p>
              <a href="#tonight">
                See tonight&apos;s lights <Sparkles size={18} aria-hidden="true" />
              </a>
            </div>
          ) : (
            <div className="hero-theme">
              <span className="date-label">Tonight</span>
              <h2>The display is settling in</h2>
              <p>Check back soon for tonight&apos;s observance and colors.</p>
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
                      <Vote size={18} aria-hidden="true" />
                    )}
                    {selected ? "Your choice" : "Vote for this theme"}
                  </button>
                </article>
              );
            })}
          </div>
          {notice ? <p className="vote-notice">{notice}</p> : null}
          <p className="privacy-note">
            One changeable vote per browser. No sign-in and no personal
            information collected.
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

      <section className="tonight-section" id="tonight">
        <div className="section-heading">
          <p className="eyebrow">On the lights</p>
          <h2>{todayTheme ? "Tonight's display" : "The latest display"}</h2>
        </div>
        {todayTheme ? (
          <div className="tonight-layout">
            <div
              className="palette-stage"
              style={{ background: paletteBackground(todayTheme.palette) }}
            >
              <LightStrand
                palette={todayTheme.palette}
                effect={todayTheme.effect}
              />
              <span>{formatPacificDate(todayTheme.date)}</span>
            </div>
            <div className="tonight-story">
              <ThemeDetails theme={todayTheme} />
              {todayTheme.totalVoteCount > 0 ? (
                <p className="vote-result">
                  Chosen with {todayTheme.selectedVoteCount} of{" "}
                  {todayTheme.totalVoteCount} votes.
                </p>
              ) : null}
              {todayTheme.substitutionNote ? (
                <p className="substitution-note">
                  {todayTheme.substitutionNote}
                </p>
              ) : null}
            </div>
          </div>
        ) : loadError ? (
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
        ) : (
          <div className="empty-state">
            <p>Tonight&apos;s theme will appear here after the lights are set.</p>
          </div>
        )}
      </section>

      {themes.length > 1 ? (
        <section className="archive-section">
          <div className="section-heading">
            <p className="eyebrow">Seven nights of color</p>
            <h2>Recent themes</h2>
          </div>
          <div className="archive-grid">
            {themes.slice(1, 7).map((theme) => (
              <article className="archive-item" key={theme.date}>
                <div
                  className="archive-color"
                  style={{ background: paletteBackground(theme.palette) }}
                  aria-hidden="true"
                />
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
