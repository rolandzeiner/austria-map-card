/**
 * The colours the canvas draws with, derived from the active theme.
 *
 * Canvas cannot read `var(--x)`, and a custom property's value is whatever
 * the theme wrote: a hex, a `color-mix()`, a `light-dark()`. So the card
 * sets each token as a probe element's `color`, reads the computed colour
 * back, and lets the browser resolve all of those into numbers. From five
 * theme colours everything else is mixed here, in plain arithmetic, which
 * is also what the preview script and the tests run.
 */

export type Rgb = readonly [red: number, green: number, blue: number];

/** What the card reads from the theme. */
export interface Theme {
  readonly background: Rgb;
  readonly text: Rgb;
  readonly muted: Rgb;
  readonly accent: Rgb;
  readonly dark: boolean;
  readonly font: string;
}

export interface Palette {
  readonly dark: boolean;
  readonly font: string;
  readonly land: string;
  readonly water: string;
  readonly waterLabel: string;
  /** The national border, and the borders inside it from heavy to light. */
  readonly outline: string;
  readonly province: string;
  readonly district: string;
  readonly municipality: string;
  readonly label: string;
  readonly labelMuted: string;
  /** Drawn round every letter so names stay readable on terrain and lines. */
  readonly halo: string;
  readonly accent: string;
  readonly accentFill: string;
  /** Motorways: an amber line on a darker casing, as in a road atlas. */
  readonly motorway: string;
  readonly motorwayCasing: string;
  /** Main roads (B): pale yellow on a darker casing. */
  readonly road: string;
  readonly roadCasing: string;
  /** Route shields: the blue of Austria's motorway signs, with white letters. */
  readonly shield: string;
  readonly shieldText: string;
  /** A main road's shield: white, framed and lettered in the text colour. */
  readonly mainShield: string;
  readonly mainShieldText: string;
  /** The fill for ground above a height in metres. */
  band(level: number): string;
}

/** Home Assistant's default light and dark themes, for the preview and the tests. */
export const LIGHT_THEME: Theme = {
  background: [255, 255, 255],
  text: [33, 33, 33],
  muted: [114, 114, 114],
  accent: [3, 169, 244],
  dark: false,
  font: "Roboto, Noto, sans-serif",
};
export const DARK_THEME: Theme = {
  background: [28, 28, 28],
  text: [225, 225, 225],
  muted: [155, 155, 155],
  accent: [3, 169, 244],
  dark: true,
  font: "Roboto, Noto, sans-serif",
};

const clamp = (value: number): number => Math.round(Math.min(255, Math.max(0, value)));

export const mix = (from: Rgb, to: Rgb, share: number): Rgb => [
  from[0] + (to[0] - from[0]) * share,
  from[1] + (to[1] - from[1]) * share,
  from[2] + (to[2] - from[2]) * share,
];

export const css = (colour: Rgb, alpha = 1): string =>
  alpha >= 1
    ? `rgb(${clamp(colour[0])}, ${clamp(colour[1])}, ${clamp(colour[2])})`
    : `rgba(${clamp(colour[0])}, ${clamp(colour[1])}, ${clamp(colour[2])}, ${alpha})`;

/**
 * A computed colour as numbers. Handles the shapes `getComputedStyle`
 * returns: `rgb(r, g, b)`, `rgba(r, g, b, a)` and `color(srgb r g b / a)`.
 * Null for anything else, and for a colour that is mostly transparent: a
 * see-through card background says nothing about what is behind it.
 */
export function parseColour(text: string): Rgb | null {
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(
    text.trim(),
  );
  if (rgb) {
    if (rgb[4] !== undefined && alphaOf(rgb[4]) < 0.5) return null;
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  const srgb =
    /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(
      text.trim(),
    );
  if (srgb) {
    if (srgb[4] !== undefined && alphaOf(srgb[4]) < 0.5) return null;
    return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255];
  }
  return null;
}

const alphaOf = (text: string): number =>
  text.endsWith("%") ? Number(text.slice(0, -1)) / 100 : Number(text);

// The terrain is tinted once per 300 m, by this much each time, starting at
// 400 m. Written as a function of the height, so the overview's 8 bands and
// the detail's 11 shade the same mountain the same.
const BAND_BASE = 400;
const BAND_STEP = 300;
const BAND_TINT = 0.052;

const MOTORWAY_LIGHT: Rgb = [236, 152, 54];
const MOTORWAY_DARK: Rgb = [214, 140, 62];
const SHIELD: Rgb = [30, 84, 160];
const ROAD_LIGHT: Rgb = [250, 220, 120];
const ROAD_DARK: Rgb = [196, 170, 92];

const WATER_LIGHT: Rgb = [111, 157, 198];
const WATER_DARK: Rgb = [92, 148, 204];

export function derivePalette(theme: Theme): Palette {
  const { background, text, dark } = theme;
  const water = dark ? WATER_DARK : WATER_LIGHT;
  // Land is the card's own colour moved a little towards the text colour,
  // so it reads as a shape on any theme, with a breath of the water's blue.
  const land = mix(mix(background, text, dark ? 0.09 : 0.065), water, 0.05);
  // In a light theme high ground gets darker; in a dark one it gets
  // lighter, like snow at dusk. Either way it moves towards the text colour.
  const ink: Rgb = dark ? [214, 226, 236] : [52, 64, 74];
  const band = (level: number): string => {
    const steps = Math.max(0, (level - BAND_BASE) / BAND_STEP + 1);
    return css(mix(land, ink, 1 - (1 - BAND_TINT) ** steps));
  };
  return {
    dark,
    font: theme.font,
    land: css(land),
    water: css(water),
    waterLabel: css(mix(water, text, dark ? 0.35 : 0.42)),
    outline: css(mix(land, text, 0.72)),
    province: css(mix(land, text, 0.58)),
    district: css(mix(land, text, 0.44)),
    municipality: css(mix(land, text, 0.3)),
    label: css(text),
    labelMuted: css(mix(theme.muted, text, 0.25)),
    halo: css(land, 0.82),
    accent: css(theme.accent),
    accentFill: css(theme.accent, 0.18),
    motorway: css(dark ? MOTORWAY_DARK : MOTORWAY_LIGHT),
    motorwayCasing: css(
      dark ? mix(MOTORWAY_DARK, background, 0.55) : mix(MOTORWAY_LIGHT, [60, 30, 0], 0.45),
    ),
    road: css(dark ? ROAD_DARK : ROAD_LIGHT),
    roadCasing: css(dark ? mix(ROAD_DARK, background, 0.55) : mix(ROAD_LIGHT, [70, 50, 0], 0.5)),
    shield: css(SHIELD),
    shieldText: "rgb(255, 255, 255)",
    mainShield: css(dark ? mix(background, text, 0.85) : [255, 255, 255]),
    mainShieldText: css(dark ? background : [40, 40, 40]),
    band,
  };
}

const TOKENS = {
  background: "--amc-background",
  text: "--amc-text",
  muted: "--amc-muted",
  accent: "--amc-accent",
} as const;

/**
 * Read the theme through a probe element inside the card, or return null
 * when the styles are not available yet.
 *
 * A card that is not in the document has no computed style: every colour
 * comes back empty. Home Assistant does this routinely (it creates a card
 * and moves it before Lit's first update), so callers retry later.
 */
export function readTheme(probe: HTMLElement, dark: boolean): Theme | null {
  if (!probe.isConnected) return null;
  // No transitions on the probe, ever: a read taken in the middle of one
  // returns the colour it is leaving.
  probe.style.setProperty("transition", "none", "important");
  const resolve = (token: string): Rgb | null => {
    probe.style.color = `var(${token})`;
    return parseColour(getComputedStyle(probe).color);
  };
  const fallback = dark ? DARK_THEME : LIGHT_THEME;
  const text = resolve(TOKENS.text);
  const accent = resolve(TOKENS.accent);
  const muted = resolve(TOKENS.muted);
  // A transparent card (some themes have one) gives no background to mix
  // with; the default theme's stands in.
  const background = resolve(TOKENS.background) ?? fallback.background;
  const font = getComputedStyle(probe).fontFamily || fallback.font;
  probe.style.color = "";
  if (text === null || accent === null) return null;
  return { background, text, muted: muted ?? text, accent, dark, font };
}
