import { describe, expect, it } from "vite-plus/test";

import { decodeLines, lineBoxes } from "../src/data/format.ts";
import {
  ShapeCache,
  TiledLines,
  traceLines,
  traceRings,
  traceSmoothRings,
} from "../src/map/tiles.ts";
import { encodeLines } from "../scripts/lib/encode.ts";
import { FakePath, fakePath } from "./fake-canvas.ts";

const lines = decodeLines(
  encodeLines(
    [
      [
        [10, 10],
        [20, 20],
      ],
      [
        [30, 10],
        [40, 12],
        [50, 10],
      ],
      [
        [500, 300],
        [520, 310],
      ],
      [
        [60, 60],
        [200, 60],
      ],
    ],
    0.5,
    { closed: false },
  ),
);

describe("the shape cache", () => {
  it("builds a path once and hands the same one back", () => {
    const cache = new ShapeCache(fakePath);
    let builds = 0;
    const first = cache.get("a", () => (builds += 1));
    const again = cache.get("a", () => (builds += 1));
    cache.get("b", () => (builds += 1));
    expect(again).toBe(first);
    expect(builds).toBe(2);
    expect(cache.size).toBe(2);
  });
});

describe("tracing", () => {
  it("draws every line, or only the ones asked for", () => {
    const all = new FakePath();
    traceLines(all as unknown as Path2D, lines);
    expect(all.ops.join("")).toBe("MLMLLMLML");
    const some = new FakePath();
    traceLines(some as unknown as Path2D, lines, [1, 2]);
    expect(some.ops.join("")).toBe("MLLML");
  });

  it("closes rings", () => {
    const rings = decodeLines(
      encodeLines(
        [
          [
            [0, 0],
            [4, 0],
            [4, 4],
          ],
        ],
        0.5,
        { closed: true },
      ),
    );
    const path = new FakePath();
    traceLines(path as unknown as Path2D, rings);
    expect(path.ops.join("")).toBe("MLLZ");
    const flat = new FakePath();
    traceRings(flat as unknown as Path2D, [Float32Array.from([0, 0, 4, 0, 4, 4, 0, 0])]);
    expect(flat.ops.join("")).toBe("MLLLZ");
  });

  it("rounds terrain rings: one curve per corner", () => {
    const rings = decodeLines(
      encodeLines(
        [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
          ],
        ],
        0.5,
        { closed: true },
      ),
    );
    const path = new FakePath();
    traceSmoothRings(path as unknown as Path2D, rings);
    expect(path.ops.join("")).toBe("MQQQQZ");
  });
});

describe("tiles", () => {
  const tiles = new TiledLines(lines, lineBoxes(lines), Int32Array.from([1, 1, 1, 2]), 64);

  const seen = (box: readonly [number, number, number, number], group: number): number[] => {
    const out: number[] = [];
    tiles.visit(box, group, (_, list) => out.push(...list));
    return out.sort((a, b) => a - b);
  };

  it("hand out only the lines of the tiles in view", () => {
    expect(seen([0, 0, 64, 64], 1)).toEqual([0, 1]);
    expect(seen([480, 280, 560, 330], 1)).toEqual([2]);
    expect(seen([300, 100, 400, 200], 1)).toEqual([]);
    expect(seen([0, 0, 1000, 530], 1)).toEqual([0, 1, 2]);
  });

  it("keep the classes apart", () => {
    expect(seen([0, 0, 1000, 530], 2)).toEqual([3]);
    expect(seen([0, 0, 1000, 530], 7)).toEqual([]);
  });

  it("do not miss a line that sticks out of its tile", () => {
    // The long line is filed under the tile of its middle (x 130), and is
    // still found from a view that only shows its far end.
    expect(seen([190, 50, 210, 70], 2)).toEqual([3]);
  });

  it("file every line somewhere", () => {
    expect(tiles.tileCount).toBe(3);
    const unclassed = new TiledLines(lines, lineBoxes(lines), null, 64);
    const all: number[] = [];
    unclassed.visit([0, 0, 1000, 530], 0, (_, list) => all.push(...list));
    expect(all.sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });
});
