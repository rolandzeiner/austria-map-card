/**
 * Lines to write a river's name along.
 *
 * A river's own course is no good for lettering: it meanders at every
 * scale, and letters set on it would tumble. So each river is joined into
 * long runs, smoothed until only its general sweep is left, and cut where
 * it still bends sharply. What remains are stretches a name can follow, and
 * a long river gets many of them, so its name can appear wherever on the
 * river the map is looking.
 *
 * Pure functions on plain arrays.
 */
import { keepByDistance } from "./geometry.ts";
import { chain, lengthOf, type Point } from "./topology.ts";

/** Points at even distances along a line, both ends included. */
export function resample(points: readonly Point[], step: number): Point[] {
  const total = lengthOf(points);
  const count = Math.max(1, Math.round(total / step));
  const out: Point[] = [points[0] as Point];
  let segment = 0;
  let before = 0;
  for (let index = 1; index < count; index += 1) {
    const target = (total * index) / count;
    for (;;) {
      const [x1, y1] = points[segment] as Point;
      const [x2, y2] = points[segment + 1] as Point;
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (before + length >= target || segment >= points.length - 2) {
        const t = length === 0 ? 0 : Math.min(1, (target - before) / length);
        out.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]);
        break;
      }
      before += length;
      segment += 1;
    }
  }
  out.push(points[points.length - 1] as Point);
  return out;
}

/** A moving average over `radius` neighbours on either side; the ends stay put. */
export function smoothLine(points: readonly Point[], radius: number, passes: number): Point[] {
  let current = [...points];
  for (let pass = 0; pass < passes; pass += 1) {
    current = current.map((point, index) => {
      // Shrink the window towards the ends, so it stays symmetric and the
      // line is not pulled along itself.
      const reach = Math.min(radius, index, current.length - 1 - index);
      if (reach === 0) return point;
      let x = 0;
      let y = 0;
      for (let offset = -reach; offset <= reach; offset += 1) {
        const [px, py] = current[index + offset] as Point;
        x += px;
        y += py;
      }
      return [x / (2 * reach + 1), y / (2 * reach + 1)] as const;
    });
  }
  return current;
}

export interface LabelOptions {
  /** Spacing of the working points, in view-box units. */
  readonly step: number;
  /** How far the smoothing reaches to either side, in units. */
  readonly smoothing: number;
  /** A stretch ends where the line turns by more than this, in degrees ... */
  readonly maxTurn: number;
  /** ... within this many units to either side. */
  readonly turnSpan: number;
  /** Shorter stretches are not worth a name. */
  readonly minLength: number;
  /** Tolerance for thinning the finished stretches. */
  readonly tolerance: number;
}

/**
 * The stretches of one river that a name can be set along, each running
 * left to right.
 *
 * `lines` are the river's pieces in any order and direction; pieces that
 * meet end to end are joined first.
 */
export function labelStretches(
  lines: ReadonlyArray<readonly Point[]>,
  options: LabelOptions,
): Point[][] {
  const runs = chain(lines.map((points) => ({ a: 0, b: 1, points: [...points] })));
  const span = Math.max(1, Math.round(options.turnSpan / options.step));
  const limit = (options.maxTurn * Math.PI) / 180;
  const out: Point[][] = [];
  for (const run of runs) {
    if (lengthOf(run.points) < options.minLength) continue;
    const sampled = resample(run.points, options.step);
    const smooth = smoothLine(
      sampled,
      Math.max(1, Math.round(options.smoothing / options.step)),
      2,
    );
    let current: Point[] = [];
    const close = (): void => {
      if (current.length > 1 && lengthOf(current) >= options.minLength) {
        const keep = keepByDistance(current, options.tolerance);
        const thinned = current.filter((_, index) => keep[index]);
        const first = thinned[0] as Point;
        const last = thinned[thinned.length - 1] as Point;
        out.push(last[0] >= first[0] ? thinned : thinned.reverse());
      }
      current = [];
    };
    smooth.forEach((point, index) => {
      const before = smooth[index - span];
      const after = smooth[index + span];
      if (before !== undefined && after !== undefined) {
        const incoming = Math.atan2(point[1] - before[1], point[0] - before[0]);
        const outgoing = Math.atan2(after[1] - point[1], after[0] - point[0]);
        let turn = Math.abs(outgoing - incoming);
        if (turn > Math.PI) turn = 2 * Math.PI - turn;
        if (turn > limit) {
          close();
          return;
        }
      }
      current.push(point);
    });
    close();
  }
  // A fixed order, whatever order the pieces came in.
  out.sort((p, q) => {
    const [px, py] = p[0] as Point;
    const [qx, qy] = q[0] as Point;
    return px - qx || py - qy || p.length - q.length;
  });
  return out;
}
