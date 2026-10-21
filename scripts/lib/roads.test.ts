/** Joining road pieces into routes, and a route's length along the road. */
import { describe, expect, it } from "vite-plus/test";

import { joinPieces, routeLength } from "./roads.ts";
import { lengthOf } from "./topology.ts";

describe("joinPieces", () => {
  it("joins pieces that meet end to end, whichever way round they run", () => {
    const joined = joinPieces([
      [
        [1, 0],
        [2, 0],
      ],
      [
        [0, 0],
        [1, 0],
      ],
      [
        [3, 0],
        [2, 0],
      ],
    ]);
    expect(joined).toHaveLength(1);
    expect(lengthOf(joined[0]!)).toBeCloseTo(3);
    expect(joined[0]![0]![0] === 0 || joined[0]![0]![0] === 3).toBe(true);
  });

  it("stops at a fork", () => {
    const joined = joinPieces([
      [
        [0, 0],
        [1, 0],
      ],
      [
        [1, 0],
        [2, 0],
      ],
      [
        [1, 0],
        [1, 1],
      ],
    ]);
    expect(joined).toHaveLength(3);
  });
});

describe("routeLength", () => {
  it("counts a motorway's two carriageways once", () => {
    const east: Array<[number, number]> = [
      [0, 0],
      [1000, 0],
    ];
    const west: Array<[number, number]> = [
      [1000, 30],
      [0, 30],
    ];
    expect(routeLength([east, west], 80)).toBe(1000);
  });

  it("counts a single carriageway, and one too far from the other, in full", () => {
    expect(
      routeLength(
        [
          [
            [0, 0],
            [1000, 0],
          ],
        ],
        80,
      ),
    ).toBe(1000);
    expect(
      routeLength(
        [
          [
            [0, 0],
            [1000, 0],
          ],
          [
            [0, 200],
            [1000, 200],
          ],
        ],
        80,
      ),
    ).toBe(2000);
  });

  it("halves only where the second carriageway runs alongside", () => {
    // Two tubes of a tunnel merge into one for the last 500 m.
    expect(
      routeLength(
        [
          [
            [0, 0],
            [1000, 0],
            [1500, 0],
          ],
          [
            [1000, 30],
            [0, 30],
          ],
        ],
        80,
      ),
    ).toBe(1500);
  });

  it("does not take the legs of a hairpin for a second carriageway", () => {
    const hairpin: Array<[number, number]> = [
      [0, 0],
      [500, 0],
      [520, 20],
      [500, 40],
      [0, 40],
    ];
    expect(routeLength([hairpin], 80)).toBeCloseTo(lengthOf(hairpin));
  });
});
