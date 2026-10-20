/**
 * The format of the map's data chunks, and how to read them.
 *
 * The card's code is one file. The geometry is nine more, written by
 * `scripts/build-data.mjs` and imported one at a time when a layer or a zoom
 * level first needs them. Each is an ES module whose default export is one
 * of the `Chunk` shapes below.
 *
 * Coordinates are in the view-box units of `../map/projection.ts`. Lines and
 * integer columns are packed into strings (see `decodeInts`); everything
 * else is plain JSON. A chunk says which `format` it was written in, and the
 * loader refuses any other: after an update a browser can hold a new card
 * with an old chunk in its cache, and drawing that would be garbage.
 *
 * No DOM and no Node API in here: the card, the build script and the tests
 * all import this file.
 */

/** Bump when a chunk's shape or the packing changes. */
export const DATA_FORMAT = 1;

export const CHUNK_IDS = [
  "base",
  "borders",
  "gemeinden",
  "terrain-detail",
  "rivers-detail",
  "places",
  "relief",
  "peaks",
  "motorways",
] as const;
export type ChunkId = (typeof CHUNK_IDS)[number];

/** File name of a chunk, beside the card's own file. */
export const chunkFile = (id: ChunkId): string => `austria-map-data-${id}.js`;

// ---------------------------------------------------------------------------
// Packed integers
// ---------------------------------------------------------------------------
//
// A list of integers becomes a string of printable ASCII: each integer is
// zigzag-coded (so small negatives stay small), then written in base 46,
// least significant digit first. A character carries one digit and one flag,
// "more digits follow", which is why 92 characters are needed: '!' and
// '#' to '~' without the backslash. Neither the quote nor the backslash is
// among them, so the string sits in a JS file without a single escape.
//
// Geometry is stored as steps between neighbouring points, and most steps
// fit one or two characters. The same borders as SVG path text are about
// three times the size.

/** Digits per character; a character value of RADIX or more means "continue". */
export const RADIX = 46;

/** The character for a value from 0 to 91. */
export function packChar(value: number): string {
  const code = value === 0 ? 0x21 : value < 58 ? value + 0x22 : value + 0x23;
  return String.fromCharCode(code);
}

const unpackChar = (code: number): number => (code === 0x21 ? 0 : code < 0x5c ? code - 0x22 : code - 0x23);

/** Read a packed list of integers. */
export function decodeInts(text: string): Int32Array {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (unpackChar(text.charCodeAt(index)) < RADIX) count += 1;
  }
  const out = new Int32Array(count);
  let at = 0;
  let value = 0;
  let scale = 1;
  for (let index = 0; index < text.length; index += 1) {
    const digit = unpackChar(text.charCodeAt(index));
    if (digit >= RADIX) {
      value += (digit - RADIX) * scale;
      scale *= RADIX;
      continue;
    }
    value += digit * scale;
    out[at] = value % 2 === 0 ? value / 2 : -(value + 1) / 2;
    at += 1;
    value = 0;
    scale = 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

/** Lines or rings as they sit in a chunk. */
export interface PackedLines {
  /** Size of one integer step, in view-box units. */
  readonly q: number;
  /** Rings: each line closes back to its first point, which is not repeated. */
  readonly closed: boolean;
  /** Number of lines. */
  readonly n: number;
  /**
   * Per line: its point count, the step from the previous line's first point
   * to this one's, then the steps from point to point.
   */
  readonly d: string;
}

/** Lines as the card works with them: flat coordinates and where each line starts. */
export interface Lines {
  /** x0, y0, x1, y1, ... of all lines, one after the other. */
  readonly xy: Float32Array;
  /** Point index of each line's first point, plus one final entry: the total. */
  readonly start: Uint32Array;
  readonly count: number;
  readonly closed: boolean;
}

export function decodeLines(packed: PackedLines): Lines {
  const ints = decodeInts(packed.d);
  const start = new Uint32Array(packed.n + 1);
  let points = 0;
  let at = 0;
  for (let line = 0; line < packed.n; line += 1) {
    const length = ints[at] as number;
    start[line] = points;
    points += length;
    at += 1 + length * 2;
  }
  start[packed.n] = points;
  if (at !== ints.length) throw new Error("packed lines are damaged");
  const xy = new Float32Array(points * 2);
  let firstX = 0;
  let firstY = 0;
  let out = 0;
  at = 0;
  for (let line = 0; line < packed.n; line += 1) {
    const length = ints[at] as number;
    at += 1;
    let x = firstX;
    let y = firstY;
    for (let point = 0; point < length; point += 1) {
      x += ints[at] as number;
      y += ints[at + 1] as number;
      at += 2;
      if (point === 0) {
        firstX = x;
        firstY = y;
      }
      xy[out] = x * packed.q;
      xy[out + 1] = y * packed.q;
      out += 2;
    }
  }
  return { xy, start, count: packed.n, closed: packed.closed };
}

/** Two sets of lines as one, the second after the first. */
export function concatLines(first: Lines, second: Lines): Lines {
  const xy = new Float32Array(first.xy.length + second.xy.length);
  xy.set(first.xy, 0);
  xy.set(second.xy, first.xy.length);
  const start = new Uint32Array(first.count + second.count + 1);
  start.set(first.start.subarray(0, first.count), 0);
  const offset = first.xy.length / 2;
  for (let line = 0; line <= second.count; line += 1) {
    start[first.count + line] = (second.start[line] as number) + offset;
  }
  return { xy, start, count: first.count + second.count, closed: first.closed };
}

/** Bounding box of every line: left, top, right, bottom, four numbers per line. */
export function lineBoxes(lines: Lines): Float32Array {
  const boxes = new Float32Array(lines.count * 4);
  for (let line = 0; line < lines.count; line += 1) {
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (let point = lines.start[line] as number; point < (lines.start[line + 1] as number); point += 1) {
      const x = lines.xy[point * 2] as number;
      const y = lines.xy[point * 2 + 1] as number;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
    boxes.set([left, top, right, bottom], line * 4);
  }
  return boxes;
}

// ---------------------------------------------------------------------------
// What a chunk holds
// ---------------------------------------------------------------------------

/** Where a chunk's data comes from. The card's credit line is built from these. */
export interface SourceInfo {
  /** Short key that fact columns refer to. */
  readonly id: string;
  /** Who to credit: "BEV", "BMLUK", "Statistik Austria". */
  readonly holder: string;
  /** The dataset's own name. */
  readonly name: string;
  readonly licence: string;
  /** The date the data describes, as the publisher writes it. */
  readonly stand: string;
  readonly url: string;
}

/**
 * One fact about every row of a table: population today, area or altitude
 * tomorrow. The info panel renders whatever columns a table carries, so a
 * new fact is a build step and two translation strings, not card code.
 */
export interface FactColumn {
  readonly key: string;
  /** Translation key of the column's label. */
  readonly label: string;
  /** How to print a value. Zero means "not known for this row". */
  readonly format: "integer" | "metres";
  /** `SourceInfo.id` of where the values come from. */
  readonly source: string;
  /** Packed integers, one per row. */
  readonly values: string;
}

/** Provinces, districts or municipalities. */
export interface UnitTable {
  /** Official codes: ISO 3166-2 for provinces, BKZ and GKZ below that. */
  readonly ids: readonly string[];
  readonly names: readonly string[];
  /** Packed row numbers in the table one level up; absent for provinces. */
  readonly parent?: string;
  /** One label point per row, as a single packed line. */
  readonly at: PackedLines;
  readonly facts: readonly FactColumn[];
}

/**
 * Border pieces. An arc runs between two junctions and separates exactly two
 * units, so every border is stored and simplified once and the borders of
 * different levels coincide instead of running side by side.
 */
export interface ArcSet {
  readonly lines: PackedLines;
  /** Packed row numbers of the unit on either side; -1 is abroad. `a` < `b`. */
  readonly a: string;
  readonly b: string;
}

/** Ground above each level, as rings to fill with the even-odd rule. */
export interface TerrainSet {
  /** Metres above sea level, ascending; one band per level. */
  readonly levels: readonly number[];
  readonly bands: readonly PackedLines[];
}

export interface RiverSet {
  /** River names; the empty string is a stream the source does not name. */
  readonly names: readonly string[];
  readonly lines: PackedLines;
  /** Packed, per line: index into `names`, and the stream order (9 is the Danube). */
  readonly name: string;
  readonly order: string;
  /** Smoothed stretches to set a river's name along, each running left to right. */
  readonly labels: PackedLines;
  /**
   * Packed, per label stretch: index into `names`, the stream order, and
   * how strongly the stretch is smoothed. 0 follows the river closely, for
   * a zoomed-in map; higher levels keep only its sweep, for small scales,
   * where a name spans many kilometres of meanders.
   */
  readonly labelName: string;
  readonly labelOrder: string;
  readonly labelLevel: string;
}

/** Settlements, most important first. */
export interface PlaceTable {
  readonly names: readonly string[];
  /** One point per place, as a single packed line. */
  readonly at: PackedLines;
  /** Packed, per place: 0 Stadt, 1 Markt, 2 Dorf. */
  readonly kind: string;
  /** Packed, per place: 2 the federal capital, 1 a provincial capital, else 0. */
  readonly capital: string;
  /** Packed, per place: row of its municipality in the borders chunk. */
  readonly municipality: string;
  /** Packed, per place: the number of residents it is ranked by. */
  readonly rank: string;
  readonly facts: readonly FactColumn[];
}

/** Summits, most prominent first. */
export interface PeakTable {
  readonly names: readonly string[];
  /** One point per summit, as a single packed line. */
  readonly at: PackedLines;
  /**
   * Packed, per summit: its isolation, the distance to the nearest higher
   * summit, in tenths of a view-box unit. It decides from which scale the
   * summit is named, so the map shows the summits that stand out first.
   */
  readonly isolation: string;
  /** Packed, per summit: 1 where the BEV marks it as major. */
  readonly major: string;
  /** Its height, among others. */
  readonly facts: readonly FactColumn[];
}

/**
 * Ground height on a grid of one cell per view-box unit, for the tilted
 * map. Rows run north to south. Each row is packed as the steps from one
 * cell to the next, starting from 0, in units of `step` metres; 0 is no
 * data, far outside the country.
 */
export interface ReliefGrid {
  readonly columns: number;
  readonly rows: number;
  /** Metres per integer step. */
  readonly step: number;
  readonly d: string;
}

interface ChunkHead {
  readonly format: number;
  readonly sources: readonly SourceInfo[];
}

export interface BaseChunk extends ChunkHead {
  readonly id: "base";
  readonly provinces: UnitTable;
  /** Country and province borders, generalised for the whole-country view. */
  readonly arcs: ArcSet;
  readonly terrain: TerrainSet;
  readonly rivers: RiverSet;
}

export interface BordersChunk extends ChunkHead {
  readonly id: "borders";
  readonly districts: UnitTable;
  readonly municipalities: UnitTable;
  /** Country, province and district borders; sides are municipalities. */
  readonly arcs: ArcSet;
}

export interface GemeindenChunk extends ChunkHead {
  readonly id: "gemeinden";
  /** The borders between municipalities of one district. */
  readonly arcs: ArcSet;
}

export interface TerrainDetailChunk extends ChunkHead {
  readonly id: "terrain-detail";
  readonly terrain: TerrainSet;
}

export interface RiversDetailChunk extends ChunkHead {
  readonly id: "rivers-detail";
  readonly rivers: RiverSet;
}

export interface PlacesChunk extends ChunkHead {
  readonly id: "places";
  readonly places: PlaceTable;
}

export interface ReliefChunk extends ChunkHead {
  readonly id: "relief";
  readonly relief: ReliefGrid;
}

/** Motorways and expressways, as strokes along their carriageways. */
export interface MotorwaySet {
  /** Route numbers: "A1", "S6". */
  readonly refs: readonly string[];
  /** Per route: "West Autobahn"; empty where the source has none. */
  readonly names: readonly string[];
  readonly lines: PackedLines;
  /** Packed, per line: index into `refs`. */
  readonly route: string;
}

export interface MotorwaysChunk extends ChunkHead {
  readonly id: "motorways";
  readonly motorways: MotorwaySet;
}

export interface PeaksChunk extends ChunkHead {
  readonly id: "peaks";
  readonly peaks: PeakTable;
}

export interface ChunkMap {
  base: BaseChunk;
  borders: BordersChunk;
  gemeinden: GemeindenChunk;
  "terrain-detail": TerrainDetailChunk;
  "rivers-detail": RiversDetailChunk;
  places: PlacesChunk;
  relief: ReliefChunk;
  peaks: PeaksChunk;
  motorways: MotorwaysChunk;
}
export type Chunk = ChunkMap[ChunkId];
