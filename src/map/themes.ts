/**
 * The map's themes: a palette each.
 *
 * `default` mixes its colours out of the Home Assistant theme
 * (palette.ts). Every other theme is a look of its own that ignores the
 * dashboard's colours and its light or dark mode, and may add what the
 * default never draws: a sea round the country, a reference grid.
 *
 * A new theme is an id in THEME_IDS (types.ts), a palette here, an entry in
 * `paletteFor`, and its name in both languages (`editor.theme_<id>`).
 */
import type { ThemeId } from "../types.ts";
import { css, derivePalette, mix, type Palette, type Rgb, type Theme } from "./palette.ts";

const hex = (value: string): Rgb => [
  Number.parseInt(value.slice(1, 3), 16),
  Number.parseInt(value.slice(3, 5), 16),
  Number.parseInt(value.slice(5, 7), 16),
];

// ── Leonida ───────────────────────────────────────────────────────────────
// A tourist-board poster of an island: turquoise sea with a paler shelf
// along the coast, sea-green land that darkens into forest, white roads and
// white lettering with a dark edge, a sand-coloured shoreline, and a grid of
// square cells numbered along one edge and lettered along the other.

/**
 * The look-up table: ground height in metres to colour, mixed in between.
 * Lowland sea-green darkens into forest up to the tree line, then pales
 * through alpine meadow to bare rock. The bands the data carries stop at
 * 2500 m, so that is where the table ends.
 */
export const LEONIDA_LUT: ReadonlyArray<readonly [metres: number, colour: Rgb]> = [
  [0, hex("#5a9c88")],
  [400, hex("#52987f")],
  [700, hex("#4b9377")],
  [1000, hex("#448d70")],
  [1300, hex("#3e866a")],
  [1600, hex("#3a7f64")],
  [1900, hex("#5a8d6b")],
  [2200, hex("#86a287")],
  [2500, hex("#b3c2b4")],
];

/** A height's colour from a table sorted by height, clamped at both ends. */
export function lookUp(
  table: ReadonlyArray<readonly [metres: number, colour: Rgb]>,
  metres: number,
): Rgb {
  const first = table[0] as readonly [number, Rgb];
  if (metres <= first[0]) return first[1];
  for (let index = 1; index < table.length; index += 1) {
    const [height, colour] = table[index] as readonly [number, Rgb];
    if (metres > height) continue;
    const [below, from] = table[index - 1] as readonly [number, Rgb];
    return mix(from, colour, (metres - below) / (height - below));
  }
  return (table[table.length - 1] as readonly [number, Rgb])[1];
}

const SEA = hex("#01abc8");
const SHELF = hex("#8fd6e2");
const LAGOON = hex("#6ec7d9");
const SAND = hex("#dccfa6");
const INK = hex("#0c3a3e");
const WHITE: Rgb = [255, 255, 255];
const CREAM = hex("#f7f0c2");
const PINK = hex("#ff5c93");

function leonidaPalette(font: string): Palette {
  const land = lookUp(LEONIDA_LUT, 0);
  return {
    dark: false,
    font,
    land: css(land),
    water: css(LAGOON),
    waterLabel: css(hex("#dcf6fa")),
    glacier: css(hex("#f4fafa")),
    // The coast is a beach; the borders inland are darker than the darkest
    // forest, so they hold on every height.
    outline: css(SAND),
    province: css(hex("#134843")),
    district: css(hex("#1c544b")),
    municipality: css(hex("#286052")),
    label: css(WHITE),
    labelMuted: css(CREAM),
    halo: css(INK, 0.86),
    accent: css(PINK),
    // A selected area is lifted, not tinted: pink over green turns to mud.
    accentFill: css(WHITE, 0.26),
    motorway: css(WHITE),
    motorwayCasing: css(hex("#2f675c")),
    road: css(hex("#e2eee8")),
    roadCasing: css(hex("#3b7566")),
    shield: css(hex("#1e54a0")),
    shieldText: css(WHITE),
    mainShield: css(WHITE),
    mainShieldText: css(hex("#1c1c1c")),
    band: (level) => css(lookUp(LEONIDA_LUT, level)),
    sea: {
      deep: css(SEA),
      shelf: [
        { reach: 26, colour: css(SHELF, 0.14) },
        { reach: 15, colour: css(SHELF, 0.2) },
        { reach: 7, colour: css(SHELF, 0.32) },
        { reach: 2.5, colour: css(SHELF, 0.5) },
      ],
    },
    grid: {
      line: css(WHITE),
      lineAlpha: 0.3,
      ruler: css(hex("#03627a"), 0.82),
      text: css(WHITE),
    },
  };
}

/** The palette a theme draws with. `theme` is what the card read from Home Assistant. */
export function paletteFor(id: ThemeId, theme: Theme): Palette {
  return id === "leonida" ? leonidaPalette(theme.font) : derivePalette(theme);
}
