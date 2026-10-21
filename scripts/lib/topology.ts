/**
 * One topology for every administrative level.
 *
 * The BEV publishes 7850 cadastral municipalities as polygons. Neighbours
 * meet vertex for vertex, so the borders between them are found by matching
 * edges, not by geometry: an edge two polygons of different units share is a
 * border between those units, an edge only one polygon has is the national
 * border, and an edge shared within one unit is inside it and is dropped.
 *
 * What is left is cut into arcs. An arc runs from junction to junction and
 * has the same two units on its sides all the way. Its level (country,
 * province, district, municipality) follows from those two units, and it is
 * simplified exactly once, which is why the borders of different levels fall
 * on each other instead of running as double lines.
 *
 * Pure functions on plain arrays, no Node API.
 */
import { keepByDistance } from "./geometry.ts";
import { sorted } from "../../src/sorted.ts";

export type Point = readonly [x: number, y: number];

/** A piece of border: the two units it separates (-1 is abroad) and its course. */
export interface Arc {
  /** The smaller of the two sides; -1 on the national border. */
  readonly a: number;
  readonly b: number;
  readonly points: Point[];
}

const keyOf = (point: Point): string => `${point[0]},${point[1]}`;

/**
 * The border edges of a set of polygons, each polygon belonging to a unit.
 *
 * `strays` counts edges that more than two polygons claim, or that two
 * polygons run along in the same direction. A boundary dataset made for
 * this has none; a number here means the input is not one.
 */
export function borderEdges(
  polygons: ReadonlyArray<{
    readonly unit: number;
    readonly rings: ReadonlyArray<ReadonlyArray<Point>>;
  }>,
): { edges: Arc[]; strays: number } {
  // Per undirected edge: the unit on either side, and which way the first
  // polygon ran along it.
  const seen = new Map<
    string,
    { from: Point; to: Point; first: number; second: number; count: number }
  >();
  let strays = 0;
  for (const polygon of polygons) {
    for (const ring of polygon.rings) {
      for (let index = 0; index < ring.length - 1; index += 1) {
        const from = ring[index] as Point;
        const to = ring[index + 1] as Point;
        const a = keyOf(from);
        const b = keyOf(to);
        if (a === b) continue;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const entry = seen.get(key);
        if (entry === undefined) {
          seen.set(key, { from, to, first: polygon.unit, second: -1, count: 1 });
        } else {
          if (entry.count > 1 || keyOf(entry.from) === a) strays += 1;
          entry.second = polygon.unit;
          entry.count += 1;
        }
      }
    }
  }
  const edges: Arc[] = [];
  for (const entry of seen.values()) {
    if (entry.count > 1 && entry.first === entry.second) continue;
    const low = Math.min(entry.first, entry.second);
    const high = Math.max(entry.first, entry.second);
    edges.push({ a: low, b: high, points: [entry.from, entry.to] });
  }
  return { edges, strays };
}

const comparePoints = (p: Point, q: Point): number => p[0] - q[0] || p[1] - q[1];

/** An arc in its canonical direction, so the same input always gives the same output. */
function canonical(arc: Arc): Arc {
  const first = arc.points[0] as Point;
  const last = arc.points[arc.points.length - 1] as Point;
  let order = comparePoints(first, last);
  if (order === 0 && arc.points.length > 2) {
    // A closed loop: start at its smallest point, towards the smaller neighbour.
    const open = arc.points.slice(0, -1);
    let start = 0;
    open.forEach((point, index) => {
      if (comparePoints(point, open[start] as Point) < 0) start = index;
    });
    const rotated = [...open.slice(start), ...open.slice(0, start)];
    order = comparePoints(rotated[1] as Point, rotated[rotated.length - 1] as Point);
    const loop = order <= 0 ? rotated : [rotated[0] as Point, ...rotated.slice(1).reverse()];
    return { ...arc, points: [...loop, loop[0] as Point] };
  }
  return order <= 0 ? arc : { ...arc, points: [...arc.points].reverse() };
}

/**
 * Join pieces into arcs: wherever exactly two pieces with the same sides
 * meet, they become one. What remains ends at junctions, where three or
 * more borders meet or the sides change, or is a closed loop that meets no
 * other border (an enclave, an island).
 */
export function chain(pieces: readonly Arc[]): Arc[] {
  const atVertex = new Map<string, number[]>();
  const touch = (key: string, piece: number): void => {
    const list = atVertex.get(key);
    if (list === undefined) atVertex.set(key, [piece]);
    else list.push(piece);
  };
  pieces.forEach((piece, index) => {
    touch(keyOf(piece.points[0] as Point), index);
    touch(keyOf(piece.points[piece.points.length - 1] as Point), index);
  });
  const sameSides = (p: number, q: number): boolean =>
    (pieces[p] as Arc).a === (pieces[q] as Arc).a && (pieces[p] as Arc).b === (pieces[q] as Arc).b;
  const isJunction = (key: string): boolean => {
    const list = atVertex.get(key) as number[];
    return list.length !== 2 || !sameSides(list[0] as number, list[1] as number);
  };

  const used = new Uint8Array(pieces.length);
  const arcs: Arc[] = [];

  /** Walk from `startKey` along `first` until a junction or back to the start. */
  const walk = (first: number, startKey: string): Arc => {
    const points: Point[] = [];
    let piece = first;
    let from = startKey;
    for (;;) {
      used[piece] = 1;
      const course = (pieces[piece] as Arc).points;
      const forward = keyOf(course[0] as Point) === from;
      const oriented = forward ? course : [...course].reverse();
      points.push(...(points.length === 0 ? oriented : oriented.slice(1)));
      from = keyOf(oriented[oriented.length - 1] as Point);
      if (from === startKey || isJunction(from)) break;
      const next = (atVertex.get(from) as number[]).find((candidate) => used[candidate] === 0);
      if (next === undefined) break;
      piece = next;
    }
    const { a, b } = pieces[first] as Arc;
    return canonical({ a, b, points });
  };

  for (const [key, list] of atVertex) {
    if (!isJunction(key)) continue;
    for (const piece of list) {
      if (used[piece] === 0) arcs.push(walk(piece, key));
    }
  }
  // Whatever is left has no junction anywhere: closed loops.
  pieces.forEach((piece, index) => {
    if (used[index] === 0) arcs.push(walk(index, keyOf(piece.points[0] as Point)));
  });
  return arcs;
}

/**
 * The same borders one level up: map every side to its group, drop what now
 * lies inside a group, and join what is left into longer arcs.
 */
export function regroup(arcs: readonly Arc[], groupOf: (unit: number) => number): Arc[] {
  const pieces: Arc[] = [];
  for (const arc of arcs) {
    const a = arc.a < 0 ? -1 : groupOf(arc.a);
    const b = arc.b < 0 ? -1 : groupOf(arc.b);
    if (a === b) continue;
    pieces.push({ a: Math.min(a, b), b: Math.max(a, b), points: arc.points });
  }
  return chain(pieces);
}

/** Put arcs in a fixed order that keeps neighbours close: by map tile, then by start. */
export function sortArcs<T extends { readonly points: readonly Point[] }>(
  arcs: readonly T[],
  tile: number,
): T[] {
  const rank = (arc: T): [number, number, number, number, number] => {
    const [x, y] = arc.points[0] as Point;
    return [Math.floor(y / tile), Math.floor(x / tile), x, y, arc.points.length];
  };
  return sorted(arcs, (p, q) => {
    const r = rank(p);
    const s = rank(q);
    for (let index = 0; index < r.length; index += 1) {
      if (r[index] !== s[index]) return (r[index] as number) - (s[index] as number);
    }
    const [px, py] = p.points[1] as Point;
    const [qx, qy] = q.points[1] as Point;
    return px - qx || py - qy;
  });
}

/**
 * Simplify an arc's course; both ends stay where they are.
 *
 * A closed loop has no ends to hold on to: it is split at the point farthest
 * from its start, and never goes below a triangle, or an enclave would
 * vanish from the map.
 */
export function simplifyArc(points: readonly Point[], tolerance: number): Point[] {
  const first = points[0] as Point;
  const last = points[points.length - 1] as Point;
  const isLoop = points.length > 3 && first[0] === last[0] && first[1] === last[1];
  if (!isLoop) {
    const keep = keepByDistance(points, tolerance);
    return points.filter((_, index) => keep[index]);
  }
  let farthest = 0;
  let distance = -1;
  points.forEach((point, index) => {
    const candidate = Math.hypot(point[0] - first[0], point[1] - first[1]);
    if (candidate > distance) {
      distance = candidate;
      farthest = index;
    }
  });
  const halves = [points.slice(0, farthest + 1), points.slice(farthest)];
  const kept = halves.flatMap((half, index) => {
    const keep = keepByDistance(half, tolerance);
    const out = half.filter((_, at) => keep[at]);
    return index === 0 ? out.slice(0, -1) : out;
  });
  if (kept.length >= 4) return kept;
  // Start, the farthest point, and the point farthest from the line between them.
  const far = points[farthest] as Point;
  let third = 1;
  let off = -1;
  points.forEach((point, index) => {
    const cross = Math.abs(
      (far[0] - first[0]) * (point[1] - first[1]) - (far[1] - first[1]) * (point[0] - first[0]),
    );
    if (cross > off) {
      off = cross;
      third = index;
    }
  });
  const corners = sorted([0, farthest, third], (p, q) => p - q);
  return [...corners.map((index) => points[index] as Point), first];
}

/** Length of a line in its own units. */
export function lengthOf(points: readonly Point[]): number {
  let sum = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1] as Point;
    const [x2, y2] = points[index] as Point;
    sum += Math.hypot(x2 - x1, y2 - y1);
  }
  return sum;
}

/**
 * A fast "is this point inside?" for one fixed set of rings (even-odd).
 *
 * The plain ray cast walks every edge for every point. Asking it of two
 * million river vertices against the national border would take minutes, so
 * the edges are sorted into horizontal strips once and a point only meets
 * the edges of its own strip.
 */
export function insideTest(
  rings: ReadonlyArray<ReadonlyArray<Point> | Float32Array>,
  strip = 1,
): (x: number, y: number) => boolean {
  const strips = new Map<number, number[]>();
  const edges: number[] = [];
  const add = (x1: number, y1: number, x2: number, y2: number): void => {
    if (y1 === y2) return;
    const at = edges.length;
    edges.push(x1, y1, x2, y2);
    const from = Math.floor(Math.min(y1, y2) / strip);
    const to = Math.floor(Math.max(y1, y2) / strip);
    for (let row = from; row <= to; row += 1) {
      const list = strips.get(row);
      if (list === undefined) strips.set(row, [at]);
      else list.push(at);
    }
  };
  for (const ring of rings) {
    if (ring instanceof Float32Array) {
      for (let index = 0; index + 3 < ring.length; index += 2) {
        add(
          ring[index] as number,
          ring[index + 1] as number,
          ring[index + 2] as number,
          ring[index + 3] as number,
        );
      }
    } else {
      for (let index = 0; index < ring.length - 1; index += 1) {
        const [x1, y1] = ring[index] as Point;
        const [x2, y2] = ring[index + 1] as Point;
        add(x1, y1, x2, y2);
      }
    }
  }
  return (x, y) => {
    const list = strips.get(Math.floor(y / strip));
    if (list === undefined) return false;
    let inside = false;
    for (const at of list) {
      const y1 = edges[at + 1] as number;
      const y2 = edges[at + 3] as number;
      if (y1 > y === y2 > y) continue;
      const x1 = edges[at] as number;
      const x2 = edges[at + 2] as number;
      if (x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
    }
    return inside;
  };
}

/**
 * A fast "is this point within `reach` of a line?" for one fixed set of
 * rings. The edges are filed in a grid of `reach`-sized cells, so a point
 * only meets the edges of its own cell and the eight around it.
 */
export function nearTest(
  rings: ReadonlyArray<ReadonlyArray<Point>>,
  reach: number,
): (x: number, y: number) => boolean {
  const cells = new Map<string, number[]>();
  const edges: number[] = [];
  for (const ring of rings) {
    for (let index = 0; index < ring.length - 1; index += 1) {
      const [x1, y1] = ring[index] as Point;
      const [x2, y2] = ring[index + 1] as Point;
      const at = edges.length;
      edges.push(x1, y1, x2, y2);
      const left = Math.floor(Math.min(x1, x2) / reach);
      const right = Math.floor(Math.max(x1, x2) / reach);
      const top = Math.floor(Math.min(y1, y2) / reach);
      const bottom = Math.floor(Math.max(y1, y2) / reach);
      for (let column = left; column <= right; column += 1) {
        for (let row = top; row <= bottom; row += 1) {
          const key = `${column},${row}`;
          const list = cells.get(key);
          if (list === undefined) cells.set(key, [at]);
          else list.push(at);
        }
      }
    }
  }
  return (x, y) => {
    const column = Math.floor(x / reach);
    const row = Math.floor(y / reach);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const at of cells.get(`${column + dx},${row + dy}`) ?? []) {
          const x1 = edges[at] as number;
          const y1 = edges[at + 1] as number;
          const ex = (edges[at + 2] as number) - x1;
          const ey = (edges[at + 3] as number) - y1;
          const length = ex * ex + ey * ey;
          const t =
            length === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * ex + (y - y1) * ey) / length));
          if (Math.hypot(x - (x1 + t * ex), y - (y1 + t * ey)) <= reach) return true;
        }
      }
    }
    return false;
  };
}

/**
 * Where to write a unit's name: the point inside it that is farthest from
 * its border (the pole of inaccessibility), found by subdividing squares
 * and always following the most promising one.
 *
 * A centroid can fall outside a crescent-shaped municipality or into the
 * hole another one makes in it. This point cannot: it is inside by
 * construction, which is also what the card's hit test is checked against.
 */
export function labelPoint(rings: ReadonlyArray<Float32Array>, precision: number): Point {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const ring of rings) {
    for (let index = 0; index < ring.length; index += 2) {
      left = Math.min(left, ring[index] as number);
      right = Math.max(right, ring[index] as number);
      top = Math.min(top, ring[index + 1] as number);
      bottom = Math.max(bottom, ring[index + 1] as number);
    }
  }
  if (!(right > left) || !(bottom > top)) throw new Error("no area to place a label in");
  const inside = insideTest(rings, Math.max((bottom - top) / 64, 1e-6));

  /** Distance to the border, negative outside. */
  const reach = (x: number, y: number): number => {
    let best = Infinity;
    for (const ring of rings) {
      for (let index = 0; index + 3 < ring.length; index += 2) {
        const x1 = ring[index] as number;
        const y1 = ring[index + 1] as number;
        const dx = (ring[index + 2] as number) - x1;
        const dy = (ring[index + 3] as number) - y1;
        const length = dx * dx + dy * dy;
        const t =
          length === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
        const distance = (x - (x1 + t * dx)) ** 2 + (y - (y1 + t * dy)) ** 2;
        if (distance < best) best = distance;
      }
    }
    const distance = Math.sqrt(best);
    return inside(x, y) ? distance : -distance;
  };

  interface Cell {
    x: number;
    y: number;
    half: number;
    reach: number;
    /** The best any point in this square could do. */
    promise: number;
  }
  const cell = (x: number, y: number, half: number): Cell => {
    const value = reach(x, y);
    return { x, y, half, reach: value, promise: value + half * Math.SQRT2 };
  };

  const size = Math.min(right - left, bottom - top);
  let half = size / 2;
  const queue: Cell[] = [];
  for (let x = left; x < right; x += size) {
    for (let y = top; y < bottom; y += size) queue.push(cell(x + half, y + half, half));
  }
  let best = cell((left + right) / 2, (top + bottom) / 2, 0);
  while (queue.length > 0) {
    // Take the most promising square. The queue stays short enough that a
    // linear search beats keeping a heap.
    let pick = 0;
    for (let index = 1; index < queue.length; index += 1) {
      if ((queue[index] as Cell).promise > (queue[pick] as Cell).promise) pick = index;
    }
    const current = queue[pick] as Cell;
    queue[pick] = queue[queue.length - 1] as Cell;
    queue.pop();
    if (current.reach > best.reach) best = current;
    if (current.promise - best.reach <= precision) continue;
    half = current.half / 2;
    queue.push(
      cell(current.x - half, current.y - half, half),
      cell(current.x + half, current.y - half, half),
      cell(current.x - half, current.y + half, half),
      cell(current.x + half, current.y + half, half),
    );
  }
  if (best.reach <= 0) throw new Error("the label point fell outside its area");
  return [best.x, best.y];
}
