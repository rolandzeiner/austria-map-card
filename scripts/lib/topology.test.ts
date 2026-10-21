/** The border topology, on a map small enough to check by hand. */
import { describe, expect, it } from "vite-plus/test";

import { ArcIndex, groupSides } from "../../src/data/arcs.ts";
import { decodeLines } from "../../src/data/format.ts";
import { sorted } from "../../src/sorted.ts";
import { encodeLines } from "./encode.ts";
import {
  borderEdges,
  chain,
  insideTest,
  labelPoint,
  lengthOf,
  regroup,
  simplifyArc,
  sortArcs,
  type Arc,
  type Point,
} from "./topology.ts";

/** A clockwise square (y up), as a shapefile winds its shells. */
const square = (x: number, y: number, size = 1): Point[] => [
  [x, y],
  [x, y + size],
  [x + size, y + size],
  [x + size, y],
  [x, y],
];

/**
 * A 3 x 2 grid of unit squares, each a cadastral polygon:
 *
 *   y=2 +---+---+---+
 *       | 0 | 1 | 2 |      units 0 and 1 form group A, unit 2 group B
 *   y=1 +---+---+---+
 *       | 0 | 3 | 3 |      unit 0 is made of two polygons, unit 3 too
 *   y=0 +---+---+---+
 */
const polygons = [
  { unit: 0, rings: [square(0, 1)] },
  { unit: 1, rings: [square(1, 1)] },
  { unit: 2, rings: [square(2, 1)] },
  { unit: 0, rings: [square(0, 0)] },
  { unit: 3, rings: [square(1, 0)] },
  { unit: 3, rings: [square(2, 0)] },
];

const sides = (arc: Arc): string => `${arc.a}/${arc.b}`;

describe("border edges", () => {
  const { edges, strays } = borderEdges(polygons);

  it("drops the edges inside a unit and keeps every border once", () => {
    expect(strays).toBe(0);
    // 17 edges in the grid; (0,1)-(1,1) lies inside unit 0, (2,0)-(2,1) inside unit 3.
    expect(edges).toHaveLength(15);
    expect(edges.filter((edge) => edge.a === -1)).toHaveLength(10);
  });

  it("notices a polygon laid over another", () => {
    expect(borderEdges([...polygons, { unit: 9, rings: [square(0, 0)] }]).strays).toBeGreaterThan(
      0,
    );
  });
});

describe("arcs", () => {
  const arcs = chain(borderEdges(polygons).edges);

  it("run from junction to junction with the same two units all the way", () => {
    // Junctions: where three borders meet. On this grid there are six of
    // them, and nine arcs between them.
    expect(arcs).toHaveLength(9);
    expect(sorted(arcs.map(sides))).toEqual([
      "-1/0",
      "-1/1",
      "-1/2",
      "-1/3",
      "0/1",
      "0/3",
      "1/2",
      "1/3",
      "2/3",
    ]);
  });

  it("keep the whole border: no length is lost in the joining", () => {
    expect(arcs.reduce((sum, arc) => sum + lengthOf(arc.points), 0)).toBe(15);
    // Unit 0's outer border runs round three sides of two squares.
    expect(lengthOf((arcs.find((arc) => sides(arc) === "-1/0") as Arc).points)).toBe(4);
  });

  it("come out the same whatever order the polygons are in", () => {
    const again = chain(borderEdges([...polygons].reverse()).edges);
    const print = (list: Arc[]): string[] => sortArcs(list, 10).map((arc) => JSON.stringify(arc));
    expect(print(again)).toEqual(print(arcs));
  });

  it("turn an enclave into one closed loop", () => {
    const outer = [
      [0, 0],
      [0, 9],
      [9, 9],
      [9, 0],
      [0, 0],
    ] as Point[];
    const hole = [...square(4, 4)].reverse();
    const loops = chain(
      borderEdges([
        { unit: 0, rings: [outer, hole] },
        { unit: 1, rings: [square(4, 4)] },
      ]).edges,
    );
    expect(sorted(loops.map(sides))).toEqual(["-1/0", "0/1"]);
    for (const loop of loops) expect(loop.points[0]).toEqual(loop.points[loop.points.length - 1]);
    expect((loops.find((arc) => sides(arc) === "0/1") as Arc).points[0]).toEqual([4, 4]);
  });
});

describe("one level up", () => {
  const arcs = chain(borderEdges(polygons).edges);
  const group = [0, 0, 1, 1];
  const upper = regroup(arcs, (unit) => group[unit] as number);

  it("drops the borders inside a group and joins the rest into longer arcs", () => {
    expect(sorted(upper.map(sides))).toEqual(["-1/0", "-1/1", "0/1"]);
    expect(upper.reduce((sum, arc) => sum + lengthOf(arc.points), 0)).toBe(13);
  });

  it("gives every arc a level through the units on its sides", () => {
    const level = (arc: Arc): number => (arc.a < 0 ? 0 : group[arc.a] !== group[arc.b] ? 1 : 2);
    expect(sorted(arcs.map(level), (p, q) => p - q)).toEqual([0, 0, 0, 0, 1, 1, 1, 2, 2]);
  });
});

describe("simplifying", () => {
  it("keeps both ends of an arc and drops what is nearly straight", () => {
    const wobbly: Point[] = [
      [0, 0],
      [1, 0.01],
      [2, -0.01],
      [3, 0],
      [3, 3],
    ];
    expect(simplifyArc(wobbly, 0.05)).toEqual([
      [0, 0],
      [3, 0],
      [3, 3],
    ]);
  });

  it("never simplifies a loop below a triangle", () => {
    const tiny: Point[] = [
      [0, 0],
      [0.01, 0.02],
      [0.02, 0.01],
      [0.03, 0.03],
      [0.02, 0],
      [0, 0],
    ];
    const kept = simplifyArc(tiny, 5);
    expect(kept.length).toBeGreaterThanOrEqual(4);
    expect(kept[0]).toEqual(kept[kept.length - 1]);
  });

  it("simplifies a large loop like a line, closed again", () => {
    const loop = square(0, 0, 10);
    const dented: Point[] = [...loop.slice(0, 2), [5, 10.01], ...loop.slice(2)];
    expect(simplifyArc(dented, 0.1)).toEqual(loop);
  });
});

describe("the card's index, built from these arcs", () => {
  const arcs = sortArcs(chain(borderEdges(polygons).edges), 10);
  const lines = decodeLines(
    encodeLines(
      arcs.map((arc) => arc.points),
      0.05,
      { closed: false, keepShort: true },
    ),
  );
  const a = Int32Array.from(arcs, (arc) => arc.a);
  const b = Int32Array.from(arcs, (arc) => arc.b);
  const index = new ArcIndex(lines, a, b, 4);

  it("finds the unit a point is in", () => {
    expect(index.locate(0.5, 1.5)).toBe(0);
    expect(index.locate(0.5, 0.5)).toBe(0);
    expect(index.locate(1.5, 1.5)).toBe(1);
    expect(index.locate(2.5, 1.5)).toBe(2);
    expect(index.locate(2.5, 0.5)).toBe(3);
    expect(index.locate(3.5, 0.5)).toBe(-1);
  });

  it("joins a unit's arcs into a closed ring", () => {
    const rings = index.rings(3);
    expect(rings).toHaveLength(1);
    const ring = rings[0] as Float32Array;
    expect([ring[0], ring[1]]).toEqual([ring[ring.length - 2], ring[ring.length - 1]]);
    // A 2 x 1 rectangle has six grid vertices on its outline.
    expect(ring.length / 2).toBe(7);
    expect(index.box(3)).toEqual([1, 0, 3, 1]);
  });

  it("works one level up on the same arcs", () => {
    const parent = Int32Array.from([0, 0, 1, 1]);
    const groups = new ArcIndex(lines, groupSides(a, parent), groupSides(b, parent), 2);
    expect(groups.locate(1.5, 1.5)).toBe(0);
    expect(groups.locate(1.5, 0.5)).toBe(1);
    expect(groups.rings(0)).toHaveLength(1);
    // The arc between units 0 and 1 is inside group 0 and takes no part.
    expect(groups.arcsOf(0)).toHaveLength(index.arcsOf(0).length + index.arcsOf(1).length - 2);
  });

  it("refuses side tables of the wrong length", () => {
    expect(() => new ArcIndex(lines, a.slice(1), b, 4)).toThrow(/one pair of sides per line/);
  });
});

describe("the label point", () => {
  const ring = (points: number[][]): Float32Array => Float32Array.from(points.flat());

  it("is the middle of a square", () => {
    const [x, y] = labelPoint(
      [
        ring([
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ]),
      ],
      0.01,
    );
    expect(x).toBeCloseTo(5, 1);
    expect(y).toBeCloseTo(5, 1);
  });

  it("stays inside a shape whose centroid lies outside it", () => {
    // A U: the centroid is in the gap between its arms.
    const u = ring([
      [0, 0],
      [9, 0],
      [9, 9],
      [6, 9],
      [6, 3],
      [3, 3],
      [3, 9],
      [0, 9],
      [0, 0],
    ]);
    const [x, y] = labelPoint([u], 0.01);
    expect(insideTest([u])(x, y)).toBe(true);
    expect(y).toBeLessThan(3);
  });

  it("keeps out of a hole", () => {
    const outer = ring([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ]);
    const hole = ring([
      [2, 2],
      [8, 2],
      [8, 8],
      [2, 8],
      [2, 2],
    ]);
    const [x, y] = labelPoint([outer, hole], 0.01);
    expect(insideTest([outer, hole])(x, y)).toBe(true);
    expect(x > 2 && x < 8 && y > 2 && y < 8).toBe(false);
  });

  it("has nothing to say about a line", () => {
    expect(() =>
      labelPoint(
        [
          ring([
            [0, 0],
            [5, 0],
            [0, 0],
          ]),
        ],
        0.01,
      ),
    ).toThrow();
  });
});

describe("the fast inside test", () => {
  it("agrees with a ray cast, holes included", () => {
    const outer: Point[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ];
    const hole: Point[] = [
      [4, 4],
      [6, 4],
      [6, 6],
      [4, 6],
      [4, 4],
    ];
    const inside = insideTest([outer, hole], 0.7);
    expect(inside(1, 1)).toBe(true);
    expect(inside(5, 5)).toBe(false);
    expect(inside(9.9, 9.9)).toBe(true);
    expect(inside(11, 5)).toBe(false);
    expect(inside(5, -1)).toBe(false);
  });
});
