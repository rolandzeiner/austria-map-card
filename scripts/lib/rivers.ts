/**
 * Rivers for the map: from the national river network's lines to a few
 * simplified strokes.
 *
 * Pure functions on plain arrays, like the rest of this folder; reading a
 * geometry blob is in `geopackage.ts`.
 */
import { parseGeoPackageLines } from "./geopackage.ts";
import { keepByDistance } from "./geometry.ts";

type Point = readonly [x: number, y: number];

/**
 * The one line of a GeoPackage geometry blob: a LineString, or a
 * MultiLineString with a single member. Anything else throws.
 */
export function parseGeoPackageLine(blob: Uint8Array): Array<[number, number]> {
  const [line, ...more] = parseGeoPackageLines(blob);
  if (line === undefined || more.length > 0) throw new Error("geometry is not one LineString");
  return line;
}

/**
 * The stretches of a line that run inside, each with one point of overlap.
 *
 * The network continues into Bavaria, Bohemia and Hungary, and the map ends
 * at the border, so what lies outside is not carried. The one extra point on
 * either side lets a stroke reach the border instead of ending just short
 * of it.
 */
export function runsInside<P extends Point>(
  points: readonly P[],
  inside: (point: P) => boolean,
): P[][] {
  const flags = points.map(inside);
  const runs: P[][] = [];
  let run: P[] = [];
  points.forEach((point, index) => {
    if (flags[index] || flags[index - 1] || flags[index + 1]) {
      run.push(point);
      return;
    }
    if (run.length > 1) runs.push(run);
    run = [];
  });
  if (run.length > 1) runs.push(run);
  return runs;
}

/** Douglas-Peucker on an open line in view-box units; both ends are kept. */
export function simplifyRiver(points: readonly Point[], tolerance: number): Point[] {
  const keep = keepByDistance(points, tolerance);
  return points.filter((_, index) => keep[index]);
}

/** The length of the segments whose midpoint passes `keep`, in the units of the points. */
export function lengthWhere(points: readonly Point[], keep: (point: Point) => boolean): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1] as Point;
    const b = points[index] as Point;
    if (keep([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}

/**
 * The separate networks some lines form, as lists of line indices: lines
 * whose ends come within `snap` of each other belong together. One name on
 * two networks is two rivers that happen to share it, like the Krems in
 * Upper Austria and the one in Lower Austria.
 */
export function networks(lines: ReadonlyArray<readonly Point[]>, snap: number): number[][] {
  const parent = lines.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root] as number;
    while (parent[index] !== root) [index, parent[index]] = [parent[index] as number, root];
    return root;
  };
  // Ends on a grid of `snap`: two ends that touch share a cell or a neighbour.
  const cellOf = (point: Point): [number, number] => [
    Math.floor(point[0] / snap),
    Math.floor(point[1] / snap),
  ];
  const endsOf = (points: readonly Point[]): Point[] =>
    points.length === 0 ? [] : [points[0] as Point, points[points.length - 1] as Point];
  const ends = new Map<string, number[]>();
  lines.forEach((points, line) => {
    for (const end of endsOf(points)) {
      const key = cellOf(end).join(",");
      const list = ends.get(key);
      if (list === undefined) ends.set(key, [line]);
      else list.push(line);
    }
  });
  lines.forEach((points, line) => {
    for (const end of endsOf(points)) {
      const [cx, cy] = cellOf(end);
      for (let x = cx - 1; x <= cx + 1; x += 1) {
        for (let y = cy - 1; y <= cy + 1; y += 1) {
          for (const other of ends.get(`${x},${y}`) ?? []) {
            const near = endsOf(lines[other] as readonly Point[]).some(
              (point) => Math.hypot(point[0] - end[0], point[1] - end[1]) <= snap,
            );
            if (near) parent[find(line)] = find(other);
          }
        }
      }
    }
  });
  const groups = new Map<number, number[]>();
  lines.forEach((_, line) => {
    const root = find(line);
    const group = groups.get(root);
    if (group === undefined) groups.set(root, [line]);
    else group.push(line);
  });
  return [...groups.values()];
}
