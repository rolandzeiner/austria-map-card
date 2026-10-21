import { describe, expect, it } from "vite-plus/test";

import { labelStretches, resample, smoothLine, type LabelOptions } from "./label-lines.ts";
import { lengthOf, type Point } from "./topology.ts";

const options: LabelOptions = {
  step: 0.5,
  smoothing: 2,
  maxTurn: 50,
  turnSpan: 3,
  minLength: 10,
  tolerance: 0.1,
};

describe("resampling", () => {
  it("spaces points evenly and keeps both ends", () => {
    const points = resample(
      [
        [0, 0],
        [3, 0],
        [3, 7],
      ],
      1,
    );
    expect(points).toHaveLength(11);
    expect(points[0]).toEqual([0, 0]);
    expect(points[10]).toEqual([3, 7]);
    expect(points[3]).toEqual([3, 0]);
    expect(points[5]?.[1]).toBeCloseTo(2);
  });
});

describe("smoothing", () => {
  it("irons out a zigzag and leaves the ends alone", () => {
    const zigzag: Point[] = Array.from({ length: 41 }, (_, index) => [
      index,
      index % 2 === 0 ? 1 : -1,
    ]);
    const smooth = smoothLine(zigzag, 4, 2);
    expect(smooth[0]).toEqual(zigzag[0]);
    expect(smooth[40]).toEqual(zigzag[40]);
    for (const [, y] of smooth.slice(6, 35)) expect(Math.abs(y)).toBeLessThan(0.15);
  });
});

describe("label stretches", () => {
  it("joins a river's pieces and runs the stretch left to right", () => {
    // Three pieces of a west-flowing river, out of order and direction.
    const pieces: Point[][] = [
      [
        [40, 10],
        [20, 12],
      ],
      [
        [60, 9],
        [40, 10],
      ],
      [
        [0, 11],
        [20, 12],
      ],
    ];
    const stretches = labelStretches(pieces, options);
    expect(stretches).toHaveLength(1);
    const stretch = stretches[0] as Point[];
    expect(stretch[0]?.[0]).toBeLessThan(1);
    expect(stretch[stretch.length - 1]?.[0]).toBeGreaterThan(59);
    expect(lengthOf(stretch)).toBeGreaterThan(55);
  });

  it("cuts at a sharp bend, so no name is set round a corner", () => {
    const elbow: Point[][] = [
      [
        [0, 0],
        [40, 0],
        [40, 40],
      ],
    ];
    const stretches = labelStretches(elbow, options);
    expect(stretches).toHaveLength(2);
    for (const stretch of stretches) {
      const first = stretch[0] as Point;
      const last = stretch[stretch.length - 1] as Point;
      expect(last[0]).toBeGreaterThanOrEqual(first[0]);
      // Each is one straight leg, well short of the corner.
      expect(lengthOf(stretch)).toBeLessThan(39);
      expect(lengthOf(stretch)).toBeGreaterThan(30);
    }
  });

  it("follows a gentle curve in one piece", () => {
    const arc: Point[] = Array.from({ length: 61 }, (_, index) => {
      const angle = (index / 60) * (Math.PI / 2);
      return [100 * Math.sin(angle), 100 * (1 - Math.cos(angle))];
    });
    expect(labelStretches([arc], options)).toHaveLength(1);
  });

  it("has no stretch for a brook too short to carry a name", () => {
    expect(
      labelStretches(
        [
          [
            [0, 0],
            [4, 1],
          ],
        ],
        options,
      ),
    ).toEqual([]);
  });

  it("thins the stretch: a straight river needs two points", () => {
    const [stretch] = labelStretches(
      [
        [
          [0, 0],
          [100, 0],
        ],
      ],
      options,
    );
    expect(stretch).toHaveLength(2);
  });
});
