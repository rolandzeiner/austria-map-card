/**
 * Two small pieces of plane geometry that the rest of the build shares:
 * thinning a line, and the area of a ring.
 *
 * Pure functions on plain arrays, no Node API, so `vp check` and the tests
 * cover this file like the card's own sources.
 */

type Point = readonly [x: number, y: number];

/** The point on segment `a`-`b` closest to `p`. */
function closestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
  return [a[0] + t * dx, a[1] + t * dy];
}

/**
 * Douglas-Peucker on an open line: which of its points to keep so that no
 * dropped point lies further than `tolerance` from the thinned line. Both
 * ends always are kept.
 */
export function keepByDistance(points: ReadonlyArray<Point>, tolerance: number): boolean[] {
  const keep = Array.from({ length: points.length }, () => false);
  if (points.length === 0) return keep;
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let worst = 0;
    let worstIndex = -1;
    for (let index = first + 1; index < last; index += 1) {
      const point = points[index] as Point;
      const nearest = closestOnSegment(point, points[first] as Point, points[last] as Point);
      const distance = Math.hypot(point[0] - nearest[0], point[1] - nearest[1]);
      if (distance > worst) {
        worst = distance;
        worstIndex = index;
      }
    }
    if (worstIndex >= 0 && worst > tolerance) {
      keep[worstIndex] = true;
      stack.push([first, worstIndex], [worstIndex, last]);
    }
  }
  return keep;
}

/** Area of a closed ring (first point repeated at the end) by the shoelace formula, unsigned. */
export function ringArea(ring: ReadonlyArray<Point>): number {
  let sum = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index] as Point;
    const [x2, y2] = ring[index + 1] as Point;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}
