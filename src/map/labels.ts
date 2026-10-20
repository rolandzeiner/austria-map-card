/**
 * The names on the map, and the towns that carry them.
 *
 * Everything here is drawn in screen pixels, after the map itself. One pass
 * hands out the space in order of importance: the capitals, the provinces,
 * the other towns by size, the rivers, then districts and municipalities.
 * A name is drawn only where it fits, so zooming in is what brings more of
 * them out.
 */
import type { ArcIndex } from "../data/arcs.ts";
import { minimumRank, placeTier } from "../layers/places.ts";
import { riversAt } from "../layers/rivers.ts";
import type { MapStore, Motorways, Places, Rivers, Table } from "../layers/store.ts";
import type { LayerId } from "../types.ts";
import { toScreen, type Box, type Camera, type Size } from "./camera.ts";
import {
  LabelPlacer,
  aroundDot,
  centredOn,
  glyphBoxes,
  longestInside,
  measure,
  pointAlong,
  setAlong,
  type Glyph,
  type Rect,
} from "./label-placer.ts";
import type { Palette } from "./palette.ts";

/** Something on the map that can be tapped and described. */
export type Feature =
  | { readonly kind: "province"; readonly row: number }
  | { readonly kind: "district"; readonly row: number }
  | { readonly kind: "municipality"; readonly row: number }
  | { readonly kind: "city"; readonly row: number }
  | { readonly kind: "peak"; readonly row: number }
  | { readonly kind: "river"; readonly name: string; readonly order: number }
  | { readonly kind: "motorway"; readonly ref: string };

/** A town or a summit as drawn in a frame: what a tap is tested against. */
export interface DrawnCity {
  readonly kind: "city" | "peak";
  readonly row: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** The box of its name, if the name was drawn. */
  readonly label: Rect | null;
}

export interface LabelInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly store: MapStore;
  readonly palette: Palette;
  readonly camera: Camera;
  readonly size: Size;
  readonly box: Box;
  readonly layers: ReadonlySet<LayerId>;
  readonly showLabels: boolean;
  readonly selection: Feature | null;
  /**
   * Where a map point lands on the canvas, or null when it cannot be seen
   * (behind a tilted camera). Without it, the flat camera's `toScreen`.
   * `box` must then cover every map point that may land on the canvas.
   */
  readonly project?: (x: number, y: number) => readonly [number, number] | null;
}

/** The scales, in pixels per map unit, between which each kind of name is shown. */
export const LABEL_SCALES = {
  provincesBelow: 4.5,
  districtsFrom: 1.1,
  municipalitiesFrom: 4,
  /** Lowest scale at which a river of each stream order is named. */
  rivers: { 9: 0, 8: 0, 7: 0, 6: 0.9, 5: 1.6, 4: 3.5, 3: 7 } as Readonly<Record<number, number>>,
  /**
   * Below these scales a river's name follows the more strongly smoothed
   * stretches: level 2 below the first, level 1 below the second, else 0.
   */
  riverSweep: [0.95, 2.4],
  /** Below this, a capital goes by its short name: "Klagenfurt". */
  shortNamesBelow: 3,
} as const;

/** Which smoothing level of a river's label stretches suits a scale. */
export function riverLabelLevel(scale: number): number {
  return scale < LABEL_SCALES.riverSweep[0] ? 2 : scale < LABEL_SCALES.riverSweep[1] ? 1 : 0;
}

/**
 * A river's name as it is lettered on the map. The source appends what tells
 * two rivers of one name apart, "Weidenbach [March, bei Zwerndorf]", and the
 * neighbours' name for a border river, "Thaya (Dyje)". On the map the place
 * does the telling apart; the info panel shows the name in full.
 */
export const riverLabel = (name: string): string => name.replace(/\s*[[(].*$/, "");

/** A town's name without what follows "am", "an der", "im": for the capitals on a small map. */
export const shortTownName = (name: string): string => name.replace(/ (am|an der|im|in|bei|ob) .*$/, "");

const MAX_CITIES = 90;
const MAX_PEAKS = 40;
const MAX_SHIELDS = 16;
/** Pixels between candidate spots for a route shield, along its line. */
const SHIELD_STEP = 180;
/** Two shields of the same route keep at least this far apart. */
const SHIELD_REPEAT = 240;
/** A summit is named once its isolation spans this many pixels. */
export const PEAK_SPACING = 40;
/** Half the width of a summit's triangle, in pixels. */
const PEAK_SIZE = 4.5;
const MAX_RIVER_NAMES = 14;
/** Two names of the same river keep at least this many pixels apart. */
const RIVER_REPEAT = 260;

interface TownStyle {
  readonly font: string;
  readonly size: number;
  readonly radius: number;
  readonly ringed: boolean;
}

const TOWN_STYLES: readonly TownStyle[] = [
  { font: "700 13px", size: 13, radius: 3.8, ringed: true },
  { font: "600 12.5px", size: 12.5, radius: 3.3, ringed: true },
  { font: "500 12px", size: 12, radius: 2.6, ringed: false },
  { font: "400 11.5px", size: 11.5, radius: 2.2, ringed: false },
  { font: "400 11px", size: 11, radius: 1.8, ringed: false },
];

// Text widths, by font and text. Measuring is the slow part of a frame of
// labels, and the same few hundred names come round again on every one.
const widths = new Map<string, number>();
function widthOf(ctx: CanvasRenderingContext2D, font: string, text: string, variant = ""): number {
  const key = `${font}\n${variant}\n${text}`;
  let width = widths.get(key);
  if (width === undefined) {
    if (widths.size > 6000) widths.clear();
    ctx.font = font;
    width = ctx.measureText(text).width;
    widths.set(key, width);
  }
  return width;
}

/** The capitals and the cities over 100 000: named before anything else. */
const always = new WeakMap<Places, number[]>();
function alwaysShown(places: Places): number[] {
  let rows = always.get(places);
  if (rows === undefined) {
    rows = [];
    for (let row = 0; row < places.count; row += 1) {
      if (placeTier(places, row) <= 1) rows.push(row);
    }
    always.set(places, rows);
  }
  return rows;
}

/** Motorway strokes, longest first: the main carriageways get their shields before the stubs. */
const strokes = new WeakMap<Motorways, number[]>();
function longestStrokes(motorways: Motorways): number[] {
  let rows = strokes.get(motorways);
  if (rows === undefined) {
    const { xy, start } = motorways.lines;
    const length = (line: number): number => {
      let sum = 0;
      for (let point = (start[line] as number) + 1; point < (start[line + 1] as number); point += 1) {
        sum += Math.hypot((xy[point * 2] as number) - (xy[point * 2 - 2] as number), (xy[point * 2 + 1] as number) - (xy[point * 2 - 1] as number));
      }
      return sum;
    };
    const lengths = Array.from({ length: motorways.lines.count }, (_, line) => length(line));
    rows = lengths.map((_, line) => line).sort((p, q) => (lengths[q] as number) - (lengths[p] as number) || p - q);
    strokes.set(motorways, rows);
  }
  return rows;
}

/** A river set's label stretches, most important first: by order, then by length. */
const ranked = new WeakMap<Rivers, number[]>();
function rankedStretches(rivers: Rivers): number[] {
  let rows = ranked.get(rivers);
  if (rows === undefined) {
    const span = (line: number): number =>
      Math.hypot(
        (rivers.labelBoxes[line * 4 + 2] as number) - (rivers.labelBoxes[line * 4] as number),
        (rivers.labelBoxes[line * 4 + 3] as number) - (rivers.labelBoxes[line * 4 + 1] as number),
      );
    rows = Array.from({ length: rivers.labels.count }, (_, line) => line).sort(
      (p, q) => (rivers.labelOrder[q] as number) - (rivers.labelOrder[p] as number) || span(q) - span(p) || p - q,
    );
    ranked.set(rivers, rows);
  }
  return rows;
}

export function drawLabels(input: LabelInput): DrawnCity[] {
  const { ctx, store, palette, camera, size, box, layers, showLabels, selection } = input;
  const scale = camera.k;
  const family = palette.font;
  const placer = new LabelPlacer({ x: 0, y: 0, w: size.width, h: size.height }, 3);
  const drawn: DrawnCity[] = [];
  const pixels = input.project ?? ((x: number, y: number): readonly [number, number] => toScreen(camera, size, x, y));
  /** Where a map point is on the canvas, or null when it is off it. */
  const onCanvas = (x: number, y: number): readonly [number, number] | null => {
    if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) return null;
    const at = pixels(x, y);
    return at !== null && at[0] >= 0 && at[0] <= size.width && at[1] >= 0 && at[1] <= size.height ? at : null;
  };

  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  const text = (value: string, font: string, colour: string, x: number, y: number, align: CanvasTextAlign): void => {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.halo;
    ctx.strokeText(value, x, y);
    ctx.fillStyle = colour;
    ctx.fillText(value, x, y);
  };

  // ── Towns ──────────────────────────────────────────────────────────────
  const places = layers.has("cities") ? store.places : undefined;
  const cityDone = new Set<number>();
  // A place with a population of its own is the one its municipality is named after.
  const seats = places?.facts.find((fact) => fact.key === "municipality_population")?.values;
  const namedMunicipalities = new Set<number>();
  const town = (row: number, force: boolean): boolean => {
    if (places === undefined || cityDone.has(row)) return false;
    const mapX = places.at[row * 2] as number;
    const mapY = places.at[row * 2 + 1] as number;
    const at = onCanvas(mapX, mapY);
    if (at === null) return false;
    const [x, y] = at;
    const style = TOWN_STYLES[placeTier(places, row)] as TownStyle;
    const font = `${style.font} ${family}`;
    const dot: Rect = { x: x - style.radius - 1, y: y - style.radius - 1, w: style.radius * 2 + 2, h: style.radius * 2 + 2 };
    let label: Rect | null = null;
    const tier = placeTier(places, row);
    const name =
      tier <= 1 && scale < LABEL_SCALES.shortNamesBelow
        ? shortTownName(places.names[row] as string)
        : (places.names[row] as string);
    if (showLabels) {
      const spots = aroundDot(x, y, style.radius, widthOf(ctx, font, name), style.size + 2);
      if (!placer.fits([dot])) {
        if (!force) return false;
      } else {
        const spot = placer.placeFirst(spots);
        if (spot >= 0) label = spots[spot] as Rect;
        else if (!force) return false;
      }
    } else if (!force && !placer.fits([dot])) {
      return false;
    }
    placer.take([dot]);
    cityDone.add(row);

    ctx.beginPath();
    ctx.arc(x, y, style.radius + 1.2, 0, Math.PI * 2);
    ctx.fillStyle = palette.halo;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, style.radius, 0, Math.PI * 2);
    ctx.fillStyle = palette.label;
    ctx.fill();
    if (style.ringed) {
      ctx.beginPath();
      ctx.arc(x, y, style.radius * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = palette.land;
      ctx.fill();
    }
    if (label !== null) {
      text(name, font, palette.label, label.x, label.y + label.h / 2, "left");
      // The town already says its municipality's name.
      if ((seats?.[row] as number) > 0) namedMunicipalities.add(places.municipality[row] as number);
    }
    drawn.push({ kind: "city", row, x, y, radius: style.radius, label });
    return true;
  };

  if (places !== undefined) {
    // A selected town is on the map whatever the scale.
    if (selection?.kind === "city") town(selection.row, true);
    for (const row of alwaysShown(places)) town(row, true);
  }

  // ── Areas ──────────────────────────────────────────────────────────────
  const areas = (
    table: Table,
    index: ArcIndex | undefined,
    font: string,
    height: number,
    colour: string,
    upper: boolean,
    spacing: number,
    skip?: ReadonlySet<number>,
  ): void => {
    const withSpacing = spacing > 0 && "letterSpacing" in ctx;
    if (withSpacing) ctx.letterSpacing = `${spacing}px`;
    const fullFont = `${font} ${family}`;
    for (let row = 0; row < table.count; row += 1) {
      if (skip?.has(row)) continue;
      const mapX = table.at[row * 2] as number;
      const mapY = table.at[row * 2 + 1] as number;
      const at = onCanvas(mapX, mapY);
      if (at === null) continue;
      const name = upper ? (table.names[row] as string).toUpperCase() : (table.names[row] as string);
      const width = widthOf(ctx, fullFont, name, withSpacing ? `spaced ${spacing}` : "");
      if (index !== undefined) {
        // A name much wider than its area belongs to a deeper zoom.
        const [left, , right] = index.box(row);
        if ((right - left) * scale < width * 0.7) continue;
      }
      const [x, y] = at;
      // On its label point, or failing that a line or two above or below it.
      const shifts = [0, -1.3, 1.3, -2.6, 2.6].map((lines) => lines * (height + 2));
      const spot = placer.placeFirst(shifts.map((shift) => centredOn(x, y + shift, width, height + 2)));
      if (spot < 0) continue;
      text(name, fullFont, colour, x, y + (shifts[spot] as number), "center");
    }
    if (withSpacing) ctx.letterSpacing = "0px";
  };

  if (showLabels && layers.has("provinces") && scale < LABEL_SCALES.provincesBelow && store.overview !== undefined) {
    areas(store.overview.provinces, undefined, "600 11px", 11, palette.labelMuted, true, 1.2);
  }

  // ── The other towns, largest first ─────────────────────────────────────
  if (places !== undefined) {
    const least = minimumRank(scale);
    for (let row = 0; row < places.count && drawn.length < MAX_CITIES; row += 1) {
      if ((places.rank[row] as number) < least) break;
      town(row, false);
    }
  }

  // ── Route shields along the motorways ─────────────────────────────────
  const motorways = layers.has("motorways") ? store.motorways : undefined;
  if (showLabels && motorways !== undefined) {
    const font = `700 10px ${family}`;
    const placed: Array<{ ref: string; x: number; y: number }> = [];
    const { xy, start } = motorways.lines;
    for (const line of longestStrokes(motorways)) {
      if (placed.length >= MAX_SHIELDS) break;
      const ref = motorways.refs[motorways.route[line] as number] as string;
      const screen: number[] = [];
      for (let point = start[line] as number; point < (start[line + 1] as number); point += 1) {
        const at = pixels(xy[point * 2] as number, xy[point * 2 + 1] as number);
        if (at !== null) screen.push(at[0], at[1]);
      }
      if (screen.length < 4) continue;
      const measured = measure(screen);
      const total = measured.along[measured.along.length - 1] as number;
      const width = widthOf(ctx, font, ref) + 8;
      for (let distance = SHIELD_STEP / 2; distance < total && placed.length < MAX_SHIELDS; distance += SHIELD_STEP) {
        const [x, y] = pointAlong(measured, distance);
        if (x < 0 || y < 0 || x > size.width || y > size.height) continue;
        if (placed.some((other) => other.ref === ref && Math.hypot(other.x - x, other.y - y) < SHIELD_REPEAT)) continue;
        const box = centredOn(x, y, width, 15);
        if (!placer.place([box])) continue;
        placed.push({ ref, x, y });
        ctx.beginPath();
        ctx.roundRect(box.x, box.y, box.w, box.h, 3);
        ctx.lineWidth = 2;
        ctx.strokeStyle = palette.halo;
        ctx.stroke();
        ctx.fillStyle = palette.shield;
        ctx.fill();
        ctx.font = font;
        ctx.textAlign = "center";
        ctx.fillStyle = palette.shieldText;
        ctx.fillText(ref, x, y + 0.5);
      }
    }
  }

  // ── Summits, the most isolated first ──────────────────────────────────
  const peaks = layers.has("peaks") ? store.peaks : undefined;
  if (peaks !== undefined) {
    const nameFont = `italic 500 11px ${family}`;
    const heightFont = `400 10px ${family}`;
    const summit = (row: number, force: boolean): boolean => {
      const at = onCanvas(peaks.at[row * 2] as number, peaks.at[row * 2 + 1] as number);
      if (at === null) return false;
      const [x, y] = at;
      const mark: Rect = { x: x - PEAK_SIZE - 1, y: y - PEAK_SIZE - 1, w: PEAK_SIZE * 2 + 2, h: PEAK_SIZE * 2 + 1 };
      const name = peaks.names[row] as string;
      const height = `${peaks.height[row] as number}`;
      const nameWidth = widthOf(ctx, nameFont, name);
      const width = nameWidth + 4 + widthOf(ctx, heightFont, height);
      let label: Rect | null = null;
      if (!placer.fits([mark]) && !force) return false;
      if (showLabels) {
        const spots = aroundDot(x, y, PEAK_SIZE, width, 13);
        const spot = placer.placeFirst(spots);
        if (spot >= 0) label = spots[spot] as Rect;
        else if (!force) return false;
      }
      placer.take([mark]);

      ctx.beginPath();
      ctx.moveTo(x, y - PEAK_SIZE);
      ctx.lineTo(x + PEAK_SIZE, y + PEAK_SIZE * 0.75);
      ctx.lineTo(x - PEAK_SIZE, y + PEAK_SIZE * 0.75);
      ctx.closePath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = palette.halo;
      ctx.stroke();
      ctx.fillStyle = palette.label;
      ctx.fill();
      if (label !== null) {
        const middle = label.y + label.h / 2;
        text(name, nameFont, palette.label, label.x, middle, "left");
        text(height, heightFont, palette.labelMuted, label.x + nameWidth + 4, middle, "left");
      }
      drawn.push({ kind: "peak", row, x, y, radius: PEAK_SIZE, label });
      return true;
    };
    if (selection?.kind === "peak") summit(selection.row, true);
    let named = 0;
    for (let row = 0; row < peaks.count && named < MAX_PEAKS; row += 1) {
      const rank = ((peaks.isolation[row] as number) / 10) * ((peaks.major[row] as number) > 0 ? 2 : 1);
      // Most isolated first: the first one that does not stand out ends the list.
      if (rank * scale < PEAK_SPACING) break;
      if (selection?.kind === "peak" && selection.row === row) continue;
      if (summit(row, false)) named += 1;
    }
  }

  // ── Rivers ─────────────────────────────────────────────────────────────
  if (showLabels && layers.has("rivers") && store.overview !== undefined) {
    const current = riversAt(store, scale);
    const sets: Rivers[] = [store.overview.rivers];
    // The detail set only carries stretches for what the overview does not name.
    if (current?.set === "detail") sets.push(current.rivers);
    const canvas: Rect = { x: 6, y: 6, w: size.width - 12, h: size.height - 12 };
    const placed: Array<{ name: number; set: Rivers; x: number; y: number }> = [];
    const level = riverLabelLevel(scale);
    let count = 0;
    for (const rivers of sets) {
      for (const line of rankedStretches(rivers)) {
        if (count >= MAX_RIVER_NAMES) break;
        const order = rivers.labelOrder[line] as number;
        if (scale < (LABEL_SCALES.rivers[order] ?? Infinity)) continue;
        // The detail set has one level; the overview's rivers have three.
        if (rivers === store.overview.rivers && rivers.labelLevel[line] !== level) continue;
        const at = line * 4;
        const boxes = rivers.labelBoxes;
        if (
          (boxes[at] as number) > box[2] ||
          (boxes[at + 2] as number) < box[0] ||
          (boxes[at + 1] as number) > box[3] ||
          (boxes[at + 3] as number) < box[1]
        ) {
          continue;
        }
        const from = rivers.labels.start[line] as number;
        const to = rivers.labels.start[line + 1] as number;
        const screen = new Float32Array((to - from) * 2);
        let seen = true;
        for (let point = from; point < to && seen; point += 1) {
          const at = pixels(rivers.labels.xy[point * 2] as number, rivers.labels.xy[point * 2 + 1] as number);
          if (at === null) seen = false;
          else {
            screen[(point - from) * 2] = at[0];
            screen[(point - from) * 2 + 1] = at[1];
          }
        }
        if (!seen) continue;
        const measured = measure(screen);
        const visible = longestInside(measured, canvas);
        if (visible === null) continue;
        const nameRow = rivers.labelName[line] as number;
        const name = riverLabel(rivers.names[nameRow] as string);
        const fontSize = order >= 7 ? 12 : 11;
        const font = `italic 400 ${fontSize}px ${family}`;
        const chars = [...name];
        const charWidths = chars.map((char) => widthOf(ctx, font, char));
        const spacing = 1.2;
        const total = charWidths.reduce((sum, width) => sum + width, 0) + spacing * (chars.length - 1);
        // Room to slide the name along the stretch, out of the way of a town.
        const slack = (visible[1] - visible[0] - total) / 2 - 8;
        if (slack < 0) continue;
        const centre = (visible[0] + visible[1]) / 2;
        let glyphs: Glyph[] | null = null;
        for (const shift of [0, -0.45, 0.45, -0.9, 0.9]) {
          const candidate = setAlong(measured, centre + shift * slack, chars, charWidths, spacing);
          const middle = candidate?.[Math.floor(candidate.length / 2)];
          if (candidate === null || middle === undefined) continue;
          const repeats = placed.some(
            (other) =>
              other.set === rivers &&
              other.name === nameRow &&
              Math.hypot(other.x - middle.x, other.y - middle.y) < RIVER_REPEAT,
          );
          if (repeats || !placer.place(glyphBoxes(candidate, fontSize))) continue;
          glyphs = candidate;
          placed.push({ name: nameRow, set: rivers, x: middle.x, y: middle.y });
          break;
        }
        if (glyphs === null) continue;
        ctx.font = font;
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = palette.halo;
        ctx.fillStyle = palette.waterLabel;
        // All halos first: a letter's halo must not eat into its neighbour.
        for (const pass of ["halo", "ink"] as const) {
          for (const glyph of glyphs) {
            ctx.save();
            ctx.translate(glyph.x, glyph.y);
            ctx.rotate(glyph.angle);
            if (pass === "halo") ctx.strokeText(glyph.char, 0, 0);
            else ctx.fillText(glyph.char, 0, 0);
            ctx.restore();
          }
        }
        count += 1;
      }
    }
  }

  // ── Districts and municipalities ───────────────────────────────────────
  if (showLabels && store.detail !== undefined) {
    if (layers.has("districts") && scale >= LABEL_SCALES.districtsFrom) {
      // Capitals and spaced, like the provinces but smaller: an area, not a town.
      areas(store.detail.districts, store.detail.districtIndex, "500 9.5px", 9.5, palette.labelMuted, true, 0.7);
    }
    const municipal = store.municipalityIndex;
    if (layers.has("municipalities") && scale >= LABEL_SCALES.municipalitiesFrom && municipal !== undefined) {
      areas(store.detail.municipalities, municipal, "400 10px", 10, palette.labelMuted, false, 0, namedMunicipalities);
    }
  }

  return drawn;
}
