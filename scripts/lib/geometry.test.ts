import { describe, expect, it } from "vitest";

import { keepByDistance, ringArea } from "./geometry.ts";

describe("thinning a line", () => {
  it("always keeps both ends", () => {
    expect(keepByDistance([[0, 0], [1, 0], [2, 0]], 10)).toEqual([true, false, true]);
    expect(keepByDistance([[0, 0], [5, 5]], 0)).toEqual([true, true]);
    expect(keepByDistance([[3, 3]], 1)).toEqual([true]);
    expect(keepByDistance([], 1)).toEqual([]);
  });

  it("drops a point within the tolerance and keeps one beyond it", () => {
    const line = [[0, 0], [5, 0.4], [10, 0]] as const;
    expect(keepByDistance(line, 0.5)).toEqual([true, false, true]);
    expect(keepByDistance(line, 0.3)).toEqual([true, true, true]);
  });

  it("measures to the line through the kept neighbours, not to the ends", () => {
    // A corner: the middle point is far from the straight line between the ends.
    expect(keepByDistance([[0, 0], [10, 0], [10, 10]], 1)).toEqual([true, true, true]);
  });

  it("keeps what a kept point makes necessary on either side of it", () => {
    const zigzag = [[0, 0], [2, 3], [4, 0], [6, 3], [8, 0]] as const;
    expect(keepByDistance(zigzag, 1)).toEqual([true, true, true, true, true]);
    expect(keepByDistance(zigzag, 5)).toEqual([true, false, false, false, true]);
  });

  it("copes with a line that returns to its start", () => {
    const loop = [[0, 0], [4, 0], [4, 4], [0, 0]] as const;
    expect(keepByDistance(loop, 1)).toEqual([true, true, true, true]);
  });
});

describe("the area of a ring", () => {
  it("is the same whichever way round the ring runs", () => {
    const square = [[0, 0], [4, 0], [4, 3], [0, 3], [0, 0]] as const;
    expect(ringArea(square)).toBe(12);
    expect(ringArea([...square].reverse())).toBe(12);
  });

  it("is zero for a line", () => {
    expect(ringArea([[0, 0], [5, 5], [0, 0]])).toBe(0);
  });
});
