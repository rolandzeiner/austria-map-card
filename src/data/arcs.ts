/**
 * Areas out of border arcs: which unit a point is in, and a unit's outline.
 *
 * The chunks store borders, not areas. Every arc separates two units, so a
 * unit's outline is the set of arcs that name it on one side. That set
 * answers "is this point inside?" directly (count the crossings of a ray,
 * in whatever order the arcs come), and joined end to end it gives closed
 * rings to fill.
 *
 * The same index works at every level: hand it the municipality on either
 * side of each arc for municipalities, or map those to districts or
 * provinces first (`groupSides`) for the coarser levels. Arcs with the same
 * group on both sides are inside that group and are ignored.
 *
 * The build script uses this file too, to find each unit's label point on
 * exactly the geometry the card will draw.
 */
import { lineBoxes, type Lines } from "./format.ts";

/** Map the unit on each side of every arc to its group one level up. */
export function groupSides(sides: Int32Array, parent: Int32Array): Int32Array {
  const out = new Int32Array(sides.length);
  for (let index = 0; index < sides.length; index += 1) {
    const unit = sides[index] as number;
    out[index] = unit < 0 ? -1 : (parent[unit] as number);
  }
  return out;
}

export class ArcIndex {
  public readonly lines: Lines;
  public readonly groups: number;
  /** left, top, right, bottom per arc. */
  private readonly arcBoxes: Float32Array;
  /** The arcs around each group. */
  private readonly members: number[][];
  /** left, top, right, bottom per group; an empty group has an inverted box. */
  private readonly groupBoxes: Float32Array;

  public constructor(lines: Lines, a: Int32Array, b: Int32Array, groups: number) {
    if (a.length !== lines.count || b.length !== lines.count) {
      throw new Error("an arc set needs one pair of sides per line");
    }
    this.lines = lines;
    this.groups = groups;
    this.arcBoxes = lineBoxes(lines);
    this.members = Array.from({ length: groups }, () => []);
    this.groupBoxes = new Float32Array(groups * 4);
    for (let group = 0; group < groups; group += 1) {
      this.groupBoxes.set([Infinity, Infinity, -Infinity, -Infinity], group * 4);
    }
    for (let arc = 0; arc < lines.count; arc += 1) {
      const sideA = a[arc] as number;
      const sideB = b[arc] as number;
      if (sideA === sideB) continue;
      for (const group of [sideA, sideB]) {
        if (group < 0) continue;
        (this.members[group] as number[]).push(arc);
        const at = group * 4;
        const box = this.groupBoxes;
        box[at] = Math.min(box[at] as number, this.arcBoxes[arc * 4] as number);
        box[at + 1] = Math.min(box[at + 1] as number, this.arcBoxes[arc * 4 + 1] as number);
        box[at + 2] = Math.max(box[at + 2] as number, this.arcBoxes[arc * 4 + 2] as number);
        box[at + 3] = Math.max(box[at + 3] as number, this.arcBoxes[arc * 4 + 3] as number);
      }
    }
  }

  /** The arcs around a group, as line numbers. */
  public arcsOf(group: number): readonly number[] {
    return this.members[group] ?? [];
  }

  /** left, top, right, bottom of a group. */
  public box(group: number): [number, number, number, number] {
    const at = group * 4;
    const box = this.groupBoxes;
    return [box[at] as number, box[at + 1] as number, box[at + 2] as number, box[at + 3] as number];
  }

  /** Even-odd ray cast over the arcs around one group. */
  public contains(group: number, x: number, y: number): boolean {
    const at = group * 4;
    const box = this.groupBoxes;
    if (
      !(
        x >= (box[at] as number) &&
        x <= (box[at + 2] as number) &&
        y >= (box[at + 1] as number) &&
        y <= (box[at + 3] as number)
      )
    ) {
      return false;
    }
    const { xy, start } = this.lines;
    let inside = false;
    for (const arc of this.members[group] as number[]) {
      // The ray runs to the right: an arc that is wholly left of the point,
      // or does not reach its height, cannot cross it.
      if ((this.arcBoxes[arc * 4 + 2] as number) < x) continue;
      if ((this.arcBoxes[arc * 4 + 1] as number) > y || (this.arcBoxes[arc * 4 + 3] as number) < y)
        continue;
      const end = (start[arc + 1] as number) - 1;
      for (let point = start[arc] as number; point < end; point += 1) {
        const y1 = xy[point * 2 + 1] as number;
        const y2 = xy[point * 2 + 3] as number;
        if (y1 > y === y2 > y) continue;
        const x1 = xy[point * 2] as number;
        const x2 = xy[point * 2 + 2] as number;
        if (x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
      }
    }
    return inside;
  }

  /** The group a point is in, or -1 for none. */
  public locate(x: number, y: number): number {
    for (let group = 0; group < this.groups; group += 1) {
      if (this.contains(group, x, y)) return group;
    }
    return -1;
  }

  /**
   * A group's outline as closed rings (first point repeated at the end),
   * flat x, y pairs. Unsorted: fill them with the even-odd rule and a ring
   * inside a ring is a hole.
   *
   * Arcs are joined where their end points are the same grid point. Where a
   * unit touches itself at one point the walk may take either way round;
   * the even-odd fill comes out the same.
   */
  public rings(group: number): Float32Array[] {
    return joinArcs(this.lines, this.members[group] ?? []);
  }
}

/** Join arcs end to end into closed rings. Arcs that do not close are left out. */
export function joinArcs(lines: Lines, arcs: readonly number[]): Float32Array[] {
  const { xy, start } = lines;
  const keyOf = (point: number): string =>
    `${xy[point * 2] as number},${xy[point * 2 + 1] as number}`;
  const first = (arc: number): number => start[arc] as number;
  const last = (arc: number): number => (start[arc + 1] as number) - 1;

  const atVertex = new Map<string, number[]>();
  for (const arc of arcs) {
    for (const key of [keyOf(first(arc)), keyOf(last(arc))]) {
      const list = atVertex.get(key);
      if (list === undefined) atVertex.set(key, [arc]);
      else list.push(arc);
    }
  }

  const used = new Set<number>();
  const rings: Float32Array[] = [];
  for (const seed of arcs) {
    if (used.has(seed)) continue;
    const parts: Array<{ arc: number; forward: boolean }> = [];
    const startKey = keyOf(first(seed));
    let arc = seed;
    let forward = true;
    let closed = false;
    for (;;) {
      used.add(arc);
      parts.push({ arc, forward });
      const endKey = keyOf(forward ? last(arc) : first(arc));
      if (endKey === startKey) {
        closed = true;
        break;
      }
      const next = (atVertex.get(endKey) ?? []).find((candidate) => !used.has(candidate));
      if (next === undefined) break;
      forward = keyOf(first(next)) === endKey;
      arc = next;
    }
    if (!closed) continue;
    let points = 1;
    for (const part of parts) points += last(part.arc) - first(part.arc);
    const ring = new Float32Array(points * 2);
    let out = 0;
    for (const part of parts) {
      const from = first(part.arc);
      const to = last(part.arc);
      // Every arc gives all its points but the last; the next arc starts there.
      for (let step = 0; step < to - from; step += 1) {
        const point = part.forward ? from + step : to - step;
        ring[out] = xy[point * 2] as number;
        ring[out + 1] = xy[point * 2 + 1] as number;
        out += 2;
      }
    }
    ring[out] = ring[0] as number;
    ring[out + 1] = ring[1] as number;
    rings.push(ring);
  }
  return rings;
}
