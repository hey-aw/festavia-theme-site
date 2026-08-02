import type { AppliedTheme, PaletteColor, ThemeCandidate } from "./theme-types";
import { formatPacificDate } from "./pacific-time";

const INK = "#19151A";
const PINK = "#F52975";
const CYAN = "#57D7E8";
const GREEN = "#A8D948";
const WHITE = "#FFF8FB";

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character] ?? character);
}

function safeHex(value: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : WHITE;
}

function text(value: string, x: number, y: number, size: number, fill = WHITE, weight = 400): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial, sans-serif" font-size="${size}px" font-weight="${weight}">${escapeXml(value)}</text>`;
}

function swatches(colors: PaletteColor[], x: number, y: number, width: number): string {
  if (!colors.length) return text("Hue-native effect colors", x, y, 18, "#D9D0D8", 600);
  const gap = 10;
  const size = Math.max(18, Math.min(42, (width - gap * (colors.length - 1)) / colors.length));
  return colors.map((color, index) => {
    const left = x + index * (size + gap);
    return `<rect x="${left}" y="${y - 27}" width="${size}" height="${size}" rx="8" fill="${safeHex(color.hex)}" stroke="${WHITE}" stroke-opacity=".4"/>`;
  }).join("");
}

function frame(date: string, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc"><title id="title">The House with the Pink Door</title><desc id="desc">A daily public theme preview for ${escapeXml(formatPacificDate(date))}</desc><rect width="1200" height="630" fill="${INK}"/><rect x="0" y="0" width="18" height="630" fill="${PINK}"/><path d="M850 0h350v630H850z" fill="#241D25"/><path d="M930 110h145v330H930z" fill="${PINK}"/><path d="M965 142h80v265h-80z" fill="#221A20"/><circle cx="1022" cy="278" r="7" fill="${GREEN}"/>${text("THE HOUSE WITH THE PINK DOOR", 72, 76, 18, CYAN, 700)}${content}${text(formatPacificDate(date), 72, 574, 18, "#D9D0D8", 400)}${text("house-with-pink-door", 950, 574, 16, "#D9D0D8", 400)}</svg>`;
}

function candidatePanel(candidate: ThemeCandidate, x: number, y: number, width: number): string {
  const mode = candidate.mode === "Hue effect" ? `Hue effect: ${candidate.effect}` : candidate.mode;
  return `<rect x="${x}" y="${y}" width="${width}" height="260" rx="14" fill="#2B232C" stroke="#5A4858"/><text x="${x + 24}" y="${y + 45}" fill="${WHITE}" font-family="Arial, sans-serif" font-size="26px" font-weight="700">${escapeXml(candidate.observanceName)}</text><text x="${x + 24}" y="${y + 79}" fill="${CYAN}" font-family="Arial, sans-serif" font-size="17px" font-weight="600">${escapeXml(mode)}</text>${swatches(candidate.palette, x + 24, y + 132, width - 48)}<text x="${x + 24}" y="${y + 190}" fill="#D9D0D8" font-family="Arial, sans-serif" font-size="16px">${escapeXml(candidate.lightingSynopsis.slice(0, 78))}</text>`;
}

export function renderPollCard(input: { date: string; candidates: ThemeCandidate[] }): string {
  const content = input.candidates.length === 2
    ? `${text("Vote for tonight's light", 72, 150, 48, WHITE, 700)}${text("Two public-safe themes are ready for your choice.", 72, 190, 22, "#D9D0D8")}${candidatePanel(input.candidates[0], 72, 236, 500)}${candidatePanel(input.candidates[1], 598, 236, 500)}${text("Vote before 5:50 PM Pacific", 72, 532, 20, GREEN, 700)}`
    : `${text("Tonight's choices arrive at 8 AM Pacific", 72, 190, 42, WHITE, 700)}${text("Come back to The House with the Pink Door to vote.", 72, 242, 22, "#D9D0D8")}${text("The public preview is not open yet.", 72, 300, 20, CYAN, 600)}`;
  return frame(input.date, content);
}

export function renderThemeCard(input: { date: string; theme: AppliedTheme | null }): string {
  const theme = input.theme;
  if (!theme || theme.publicStatus !== "active") {
    return frame(input.date, `${text("Tonight's light is being prepared", 72, 190, 46, WHITE, 700)}${text("The applied public theme will appear here after the evening update.", 72, 242, 22, "#D9D0D8")}${text("No light details are available yet.", 72, 300, 20, CYAN, 600)}`);
  }
  const treatment = theme.mode === "Hue effect" ? `Hue effect: ${theme.effect}` : theme.mode;
  const palette = theme.mode === "Hue effect" && !theme.palette.length ? [] : theme.palette;
  return frame(input.date, `${text(theme.observanceName, 72, 166, 48, WHITE, 700)}${text("Tonight's applied theme", 72, 210, 22, CYAN, 700)}${text(theme.observanceSynopsis.slice(0, 116), 72, 270, 21, "#D9D0D8")}${text(treatment, 72, 360, 24, GREEN, 700)}${swatches(palette, 72, 430, 420)}${text(theme.lightingSynopsis.slice(0, 82), 72, 500, 18, "#D9D0D8")}`);
}
