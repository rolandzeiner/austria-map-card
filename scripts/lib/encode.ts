/**
 * Writing the packed strings that `src/data/format.ts` reads.
 *
 * The reading side ships in the card and stays small; this side runs only in
 * the build. The two are tested against each other in `encode.test.ts`.
 */
import { RADIX, packChar, type PackedLines } from "../../src/data/format.ts";

type Point = readonly [x: number, y: number];

/** Pack integers; see `decodeInts` for the scheme. */
export function encodeInts(values: Iterable<number>): string {
  let out = "";
  for (const value of values) {
    if (!Number.isInteger(value)) throw new Error(`${value} is not an integer`);
    let rest = value >= 0 ? value * 2 : -value * 2 - 1;
    while (rest >= RADIX) {
      out += packChar((rest % RADIX) + RADIX);
      rest = Math.floor(rest / RADIX);
    }
    out += packChar(rest);
  }
  return out;
}

/** A point on the integer grid of step `q`. */
export const toGrid = (point: Point, q: number): [number, number] => [
  Math.round(point[0] / q),
  Math.round(point[1] / q),
];

/**
 * Pack lines or rings.
 *
 * Every point is rounded to the grid first and the steps are taken between
 * rounded points, so the error never adds up along a line and two lines that
 * share a vertex print it at exactly the same place. Points that land on
 * their predecessor are dropped.
 *
 * `keepShort` keeps a line whose points all land on one grid point as a
 * two-point line. Border arcs need that: their side tables run parallel to
 * the lines, so none may go missing. Rivers and terrain rings do not, and a
 * line that draws nothing is dropped (as is a ring of fewer than three
 * points).
 */
export function encodeLines(
  lines: ReadonlyArray<ReadonlyArray<Point>>,
  q: number,
  options: { closed: boolean; keepShort?: boolean },
): PackedLines {
  const ints: number[] = [];
  let count = 0;
  let firstX = 0;
  let firstY = 0;
  for (const line of lines) {
    const points: Array<[number, number]> = [];
    for (const point of line) {
      const [x, y] = toGrid(point, q);
      const previous = points[points.length - 1];
      if (previous !== undefined && previous[0] === x && previous[1] === y) continue;
      points.push([x, y]);
    }
    if (options.closed) {
      // A ring given with its first point repeated at the end.
      const first = points[0];
      const last = points[points.length - 1];
      if (
        points.length > 1 &&
        first !== undefined &&
        last !== undefined &&
        first[0] === last[0] &&
        first[1] === last[1]
      ) {
        points.pop();
      }
    }
    const minimum = options.closed ? 3 : 2;
    if (points.length < minimum) {
      if (!options.keepShort || points.length === 0) continue;
      while (points.length < minimum) points.push([...(points[0] as [number, number])]);
    }
    ints.push(points.length);
    let x = firstX;
    let y = firstY;
    points.forEach((point, index) => {
      ints.push(point[0] - x, point[1] - y);
      [x, y] = point;
      if (index === 0) [firstX, firstY] = point;
    });
    count += 1;
  }
  return { q, closed: options.closed, n: count, d: encodeInts(ints) };
}

/** Pack one point per table row as a single line, keeping every point. */
export function encodePoints(points: ReadonlyArray<Point>, q: number): PackedLines {
  const ints: number[] = [points.length];
  let x = 0;
  let y = 0;
  for (const point of points) {
    const [gx, gy] = toGrid(point, q);
    ints.push(gx - x, gy - y);
    x = gx;
    y = gy;
  }
  return { q, closed: false, n: 1, d: encodeInts(ints) };
}
