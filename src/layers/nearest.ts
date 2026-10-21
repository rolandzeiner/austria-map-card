import type { Lines } from "../data/format.ts";

/** How far a map point is from one line of a set, in map units: from its nearest segment. */
export function distanceToLine(lines: Lines, line: number, x: number, y: number): number {
  const { xy, start } = lines;
  let best = Infinity;
  for (let point = start[line] as number; point + 1 < (start[line + 1] as number); point += 1) {
    const x1 = xy[point * 2] as number;
    const y1 = xy[point * 2 + 1] as number;
    const dx = (xy[point * 2 + 2] as number) - x1;
    const dy = (xy[point * 2 + 3] as number) - y1;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
    const distance = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
    if (distance < best) best = distance;
  }
  return best;
}
