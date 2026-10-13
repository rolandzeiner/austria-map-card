/**
 * Terrain for the map: from the BEV's elevation grid to a few generalised
 * height bands as closed vector rings.
 *
 * The card's map is a vector drawing and stays one, so the relief is not a
 * shaded image. It is the answer to one question per band, "where is the
 * ground above this height?", traced as outlines and drawn as stacked
 * shades. Pure functions, no Node API; `build-data.mjs` does the reading
 * and writing.
 */
import { keepByDistance, ringArea } from "./geometry.ts";

type Point = readonly [x: number, y: number];

/** Elevations in metres on a regular grid; NaN where there is no data. */
export interface ElevationGrid {
  readonly columns: number;
  readonly rows: number;
  /** Row-major, first row at the top. */
  readonly values: Float64Array;
}

// ---------------------------------------------------------------------------
// The BEV's grid: Esri ASCII tiles in MGI / Austria Lambert (EPSG:31287)
// ---------------------------------------------------------------------------

export interface AsciiGrid {
  readonly columns: number;
  readonly rows: number;
  /** Outer corner of the lower-left cell, in metres. */
  readonly left: number;
  readonly bottom: number;
  readonly cellSize: number;
  readonly noData: number;
  /** Row-major, first row at the top, as the file has it. */
  readonly values: Float64Array;
}

/** Parse one Esri ASCII grid tile. */
export function parseAsciiGrid(text: string): AsciiGrid {
  const header: Record<string, number> = {};
  const lines = text.split(/\r?\n/);
  let line = 0;
  for (; line < lines.length; line += 1) {
    const match = /^\s*([A-Za-z_]+)\s+(-?[\d.]+)\s*$/.exec(lines[line] as string);
    if (match === null) break;
    header[(match[1] as string).toLowerCase()] = Number(match[2]);
  }
  const need = (key: string): number => {
    const value = header[key];
    if (value === undefined) throw new Error(`grid header has no ${key}`);
    return value;
  };
  const columns = need("ncols");
  const rows = need("nrows");
  const values = new Float64Array(columns * rows);
  let index = 0;
  for (; line < lines.length; line += 1) {
    for (const token of (lines[line] as string).trim().split(/\s+/)) {
      if (token === "") continue;
      if (index < values.length) values[index] = Number(token);
      index += 1;
    }
  }
  if (index !== values.length) {
    throw new Error(`grid has ${index} values, its header says ${values.length}`);
  }
  return {
    columns,
    rows,
    left: need("xllcorner"),
    bottom: need("yllcorner"),
    cellSize: need("cellsize"),
    noData: header["nodata_value"] ?? Number.NaN,
    values,
  };
}

const RADIANS = Math.PI / 180;

// EPSG:31287, as the tiles' .prj files state it: Lambert conformal conic on
// the Bessel 1841 ellipsoid, standard parallels 46° and 49° N, origin 47°30' N
// 13°20' E, false easting and northing 400 km.
const BESSEL_A = 6377397.155;
const BESSEL_F = 1 / 299.1528128;
const BESSEL_E = Math.sqrt(2 * BESSEL_F - BESSEL_F * BESSEL_F);
const FALSE_ORIGIN = 400000;
const ORIGIN_LATITUDE = 47.5 * RADIANS;
const CENTRAL_MERIDIAN = (13 + 1 / 3) * RADIANS;

const lambertM = (latitude: number): number =>
  Math.cos(latitude) / Math.sqrt(1 - (BESSEL_E * Math.sin(latitude)) ** 2);
const lambertT = (latitude: number): number =>
  Math.tan(Math.PI / 4 - latitude / 2) /
  ((1 - BESSEL_E * Math.sin(latitude)) / (1 + BESSEL_E * Math.sin(latitude))) ** (BESSEL_E / 2);

const LAMBERT_N =
  (Math.log(lambertM(46 * RADIANS)) - Math.log(lambertM(49 * RADIANS))) /
  (Math.log(lambertT(46 * RADIANS)) - Math.log(lambertT(49 * RADIANS)));
const LAMBERT_F = lambertM(46 * RADIANS) / (LAMBERT_N * lambertT(46 * RADIANS) ** LAMBERT_N);
const LAMBERT_R0 = BESSEL_A * LAMBERT_F * lambertT(ORIGIN_LATITUDE) ** LAMBERT_N;

/**
 * Austria Lambert metres to degrees: [latitude, longitude].
 *
 * On the MGI datum, with no shift to WGS84. The two differ by roughly 100 m
 * here, a fifth of one 500 m cell and a twentieth of the cells the terrain is
 * generalised to, so the shift would change nothing that is drawn.
 */
export function lambertToGeographic(easting: number, northing: number): [number, number] {
  const dx = easting - FALSE_ORIGIN;
  const dy = LAMBERT_R0 - (northing - FALSE_ORIGIN);
  const t = (Math.hypot(dx, dy) / (BESSEL_A * LAMBERT_F)) ** (1 / LAMBERT_N);
  let latitude = Math.PI / 2 - 2 * Math.atan(t);
  for (let pass = 0; pass < 8; pass += 1) {
    const sine = BESSEL_E * Math.sin(latitude);
    latitude = Math.PI / 2 - 2 * Math.atan(t * ((1 - sine) / (1 + sine)) ** (BESSEL_E / 2));
  }
  const longitude = Math.atan2(dx, dy) / LAMBERT_N + CENTRAL_MERIDIAN;
  return [latitude / RADIANS, longitude / RADIANS];
}

// ---------------------------------------------------------------------------
// Resampling, filling, smoothing
// ---------------------------------------------------------------------------

/**
 * Collects elevation samples into cells and hands back their means.
 *
 * Fields are declared one by one, without parameter properties: the build
 * script runs this file through Node's type stripping, which only removes
 * types and cannot compile a constructor shorthand.
 */
export class GridAccumulator {
  private readonly columns: number;
  private readonly rows: number;
  private readonly cell: number;
  private readonly sums: Float64Array;
  private readonly counts: Uint32Array;

  public constructor(columns: number, rows: number, cell: number) {
    this.columns = columns;
    this.rows = rows;
    this.cell = cell;
    this.sums = new Float64Array(columns * rows);
    this.counts = new Uint32Array(columns * rows);
  }

  /** Add one sample at a view-box position. Samples off the grid are dropped. */
  public add(x: number, y: number, elevation: number): void {
    const column = Math.floor(x / this.cell);
    const row = Math.floor(y / this.cell);
    if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) return;
    const index = row * this.columns + column;
    this.sums[index] = (this.sums[index] as number) + elevation;
    this.counts[index] = (this.counts[index] as number) + 1;
  }

  public toGrid(): ElevationGrid {
    const values = new Float64Array(this.sums.length);
    for (let index = 0; index < values.length; index += 1) {
      const count = this.counts[index] as number;
      values[index] = count === 0 ? Number.NaN : (this.sums[index] as number) / count;
    }
    return { columns: this.columns, rows: this.rows, values };
  }
}

/**
 * Grow the data outwards by `reach` cells, each new cell taking the mean of
 * its filled neighbours.
 *
 * The grid ends at the border, and a contour traced on it would end there
 * too, hugging the outline in a staircase. Carried a little way past the
 * border, contours cross it cleanly and the country's outline clips them.
 */
export function growOutwards(grid: ElevationGrid, reach: number): ElevationGrid {
  let values = Float64Array.from(grid.values);
  for (let pass = 0; pass < reach; pass += 1) {
    const next = Float64Array.from(values);
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.columns; column += 1) {
        const index = row * grid.columns + column;
        if (!Number.isNaN(values[index] as number)) continue;
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const c = column + dx;
            const r = row + dy;
            if (c < 0 || r < 0 || c >= grid.columns || r >= grid.rows) continue;
            const value = values[r * grid.columns + c] as number;
            if (Number.isNaN(value)) continue;
            sum += value;
            count += 1;
          }
        }
        if (count > 0) next[index] = sum / count;
      }
    }
    values = next;
  }
  return { ...grid, values };
}

/**
 * Gaussian blur over the cells that have data; the others stay empty.
 *
 * This is the generalisation. A 500 m grid of the Alps is every side valley
 * and every ridge, far more outline than a card can show or should carry.
 */
export function smooth(grid: ElevationGrid, sigma: number): ElevationGrid {
  const radius = Math.max(1, Math.ceil(sigma * 2.5));
  const kernel: number[] = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    kernel.push(Math.exp(-(offset * offset) / (2 * sigma * sigma)));
  }
  const pass = (source: Float64Array, horizontal: boolean): Float64Array => {
    const out = new Float64Array(source.length).fill(Number.NaN);
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.columns; column += 1) {
        const index = row * grid.columns + column;
        if (Number.isNaN(source[index] as number)) continue;
        let sum = 0;
        let weight = 0;
        for (let offset = -radius; offset <= radius; offset += 1) {
          const c = horizontal ? column + offset : column;
          const r = horizontal ? row : row + offset;
          if (c < 0 || r < 0 || c >= grid.columns || r >= grid.rows) continue;
          const value = source[r * grid.columns + c] as number;
          if (Number.isNaN(value)) continue;
          const w = kernel[offset + radius] as number;
          sum += w * value;
          weight += w;
        }
        out[index] = sum / weight;
      }
    }
    return out;
  };
  return { ...grid, values: pass(pass(grid.values, true), false) };
}

// ---------------------------------------------------------------------------
// Contours
// ---------------------------------------------------------------------------

/**
 * The outlines of everything at or above `threshold`, as closed rings in
 * view-box units.
 *
 * Marching squares with linear interpolation along each cell edge. Empty
 * cells and the grid's rim count as far below any threshold, so every
 * outline closes. Rings are not sorted into shells and holes: drawn with the
 * even-odd rule, a ring inside a ring is a hole and one inside that is an
 * island, which is exactly the terrain's meaning.
 */
export function isoRings(grid: ElevationGrid, threshold: number, cell: number): Point[][] {
  const low = threshold - 1e6;
  const at = (column: number, row: number): number => {
    if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) return low;
    const value = grid.values[row * grid.columns + column] as number;
    return Number.isNaN(value) ? low : value;
  };
  // A grid value sits at its cell's centre.
  const where = (column: number, row: number): Point => [(column + 0.5) * cell, (row + 0.5) * cell];
  const between = (a: Point, va: number, b: Point, vb: number): Point => {
    // Clamped: next to an empty cell the far value is a stand-in, and the
    // crossing belongs half-way, not glued to the filled side.
    const t = va === low || vb === low ? 0.5 : (threshold - va) / (vb - va);
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  };

  // Each crossing lies on one grid edge; the edge's name joins the segments
  // of neighbouring squares into rings.
  const points = new Map<string, Point>();
  const links = new Map<string, string[]>();
  const link = (a: string, b: string): void => {
    links.set(a, [...(links.get(a) ?? []), b]);
    links.set(b, [...(links.get(b) ?? []), a]);
  };

  for (let row = -1; row < grid.rows; row += 1) {
    for (let column = -1; column < grid.columns; column += 1) {
      const corners = [
        [column, row],
        [column + 1, row],
        [column + 1, row + 1],
        [column, row + 1],
      ] as const;
      const values = corners.map(([c, r]) => at(c, r));
      const inside = values.map((value) => value >= threshold);
      const code =
        (inside[0] ? 8 : 0) | (inside[1] ? 4 : 0) | (inside[2] ? 2 : 0) | (inside[3] ? 1 : 0);
      if (code === 0 || code === 15) continue;

      // Edges of the square: 0 top, 1 right, 2 bottom, 3 left.
      const edge = (side: number): string => {
        const from = corners[side] as readonly [number, number];
        const to = corners[(side + 1) % 4] as readonly [number, number];
        const name =
          side === 0 || side === 2
            ? `h${Math.min(from[0], to[0])},${from[1]}`
            : `v${from[0]},${Math.min(from[1], to[1])}`;
        if (!points.has(name)) {
          points.set(
            name,
            between(
              where(from[0], from[1]),
              values[side] as number,
              where(to[0], to[1]),
              values[(side + 1) % 4] as number,
            ),
          );
        }
        return name;
      };

      const pairs: Array<[number, number]> = [];
      switch (code) {
        case 1:
        case 14:
          pairs.push([2, 3]);
          break;
        case 2:
        case 13:
          pairs.push([1, 2]);
          break;
        case 3:
        case 12:
          pairs.push([1, 3]);
          break;
        case 4:
        case 11:
          pairs.push([0, 1]);
          break;
        case 6:
        case 9:
          pairs.push([0, 2]);
          break;
        case 7:
        case 8:
          pairs.push([0, 3]);
          break;
        default: {
          // Two opposite corners are in. Whether they are joined is decided
          // by the middle of the square.
          const joined = values.reduce((sum, value) => sum + value, 0) / 4 >= threshold;
          if ((code === 10) === joined) pairs.push([0, 1], [2, 3]);
          else pairs.push([0, 3], [1, 2]);
        }
      }
      for (const [a, b] of pairs) link(edge(a), edge(b));
    }
  }

  const rings: Point[][] = [];
  const visited = new Set<string>();
  for (const start of links.keys()) {
    if (visited.has(start)) continue;
    const ring: Point[] = [];
    let previous = "";
    let current = start;
    while (!visited.has(current)) {
      visited.add(current);
      ring.push(points.get(current) as Point);
      const [first, second] = links.get(current) as string[];
      const next = first === previous ? second : first;
      previous = current;
      current = next as string;
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
}

/**
 * Simplify closed rings and drop the ones too small to see.
 *
 * `tolerance` is in view-box units; `minimumArea` in units squared. A ring is
 * split at the point farthest from its start so both halves simplify as
 * lines with fixed ends.
 */
export function generaliseRings(
  rings: readonly Point[][],
  tolerance: number,
  minimumArea: number,
): Point[][] {
  const out: Point[][] = [];
  for (const ring of rings) {
    if (ringArea([...ring, ring[0] as Point]) < minimumArea) continue;
    const start = ring[0] as Point;
    let farthest = 0;
    let distance = -1;
    ring.forEach((point, index) => {
      const candidate = Math.hypot(point[0] - start[0], point[1] - start[1]);
      if (candidate > distance) {
        distance = candidate;
        farthest = index;
      }
    });
    const halves = [ring.slice(0, farthest + 1), [...ring.slice(farthest), start]];
    const kept = halves.flatMap((half) => {
      const keep = keepByDistance(half, tolerance);
      return half.filter((_, index) => keep[index]).slice(0, -1);
    });
    if (kept.length >= 3) out.push(kept);
  }
  return out;
}
