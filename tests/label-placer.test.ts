import { describe, expect, it } from "vite-plus/test";

import {
  LabelPlacer,
  aroundDot,
  centredOn,
  glyphBoxes,
  longestInside,
  measure,
  pointAlong,
  setAlong,
} from "../src/map/label-placer.ts";

const canvas = { x: 0, y: 0, w: 400, h: 200 };

describe("one pass, first come first served", () => {
  it("places a label in free space and refuses the next one on top of it", () => {
    const placer = new LabelPlacer(canvas, 3);
    expect(placer.place([{ x: 100, y: 100, w: 60, h: 14 }])).toBe(true);
    expect(placer.place([{ x: 140, y: 105, w: 60, h: 14 }])).toBe(false);
    expect(placer.place([{ x: 100, y: 130, w: 60, h: 14 }])).toBe(true);
    expect(placer.count).toBe(2);
  });

  it("keeps a margin between neighbours", () => {
    const placer = new LabelPlacer(canvas, 3);
    placer.place([{ x: 100, y: 100, w: 60, h: 14 }]);
    expect(placer.fits([{ x: 162, y: 100, w: 40, h: 14 }])).toBe(false);
    expect(placer.fits([{ x: 164, y: 100, w: 40, h: 14 }])).toBe(true);
  });

  it("refuses a label that would be cut off by the canvas edge", () => {
    const placer = new LabelPlacer(canvas, 3);
    expect(placer.place([{ x: 370, y: 100, w: 60, h: 14 }])).toBe(false);
    expect(placer.place([{ x: 10, y: -4, w: 60, h: 14 }])).toBe(false);
    expect(placer.count).toBe(0);
  });

  it("places all the boxes of a label or none of them", () => {
    const placer = new LabelPlacer(canvas, 0);
    placer.place([{ x: 50, y: 50, w: 10, h: 10 }]);
    expect(
      placer.place([
        { x: 10, y: 10, w: 10, h: 10 },
        { x: 55, y: 55, w: 10, h: 10 },
      ]),
    ).toBe(false);
    expect(placer.fits([{ x: 10, y: 10, w: 10, h: 10 }])).toBe(true);
  });

  it("takes the first alternative that fits", () => {
    const placer = new LabelPlacer(canvas, 3);
    const spots = aroundDot(200, 100, 3, 50, 14);
    expect(placer.placeFirst(spots)).toBe(0);
    // The same town again: right is taken, so the name goes left.
    expect(placer.placeFirst(spots)).toBe(1);
    // Above and below would touch the two names already there.
    expect(placer.placeFirst(spots)).toBe(-1);
    expect(placer.count).toBe(2);
  });

  it("offers a town's name right, left, above and below its dot, clear of the dot", () => {
    const [right, left, above, below] = aroundDot(200, 100, 3, 50, 14);
    expect(right).toEqual({ x: 206, y: 93, w: 50, h: 14 });
    expect(left?.x).toBe(144);
    expect(above?.y).toBe(80);
    expect(below?.y).toBe(106);
    expect(centredOn(200, 100, 50, 14)).toEqual({ x: 175, y: 93, w: 50, h: 14 });
  });
});

describe("a measured line", () => {
  const line = measure([0, 0, 30, 0, 30, 40]);

  it("knows the distance along itself at every point", () => {
    expect([...line.along]).toEqual([0, 30, 70]);
  });

  it("finds the point at a distance, and stops at its ends", () => {
    expect(pointAlong(line, 15)).toEqual([15, 0]);
    expect(pointAlong(line, 50)).toEqual([30, 20]);
    expect(pointAlong(line, -5)).toEqual([0, 0]);
    expect(pointAlong(line, 500)).toEqual([30, 40]);
  });
});

describe("the part of a line in view", () => {
  it("is the whole line when all of it is inside", () => {
    expect(longestInside(measure([10, 10, 50, 10]), canvas)).toEqual([0, 40]);
  });

  it("is clipped at the edge, not dropped with the vertex outside", () => {
    // A straight line from far left to far right: neither end is in view.
    const run = longestInside(measure([-100, 50, 600, 50]), canvas) as [number, number];
    expect(run[0]).toBeCloseTo(100);
    expect(run[1]).toBeCloseTo(500);
  });

  it("is the longest of several runs when the line leaves and comes back", () => {
    const run = longestInside(
      measure([10, 10, 60, 10, 60, -50, 200, -50, 200, 10, 390, 10]),
      canvas,
    ) as [number, number];
    // In view: 50 px at the start, 10 px down, then 10 px back in and 190 along.
    expect(run[1] - run[0]).toBeCloseTo(200);
  });

  it("is nothing for a line that passes by", () => {
    expect(longestInside(measure([-50, -50, 500, -40]), canvas)).toBeNull();
  });
});

describe("lettering along a line", () => {
  const chars = [..."Donau"];
  const widths = chars.map(() => 8);

  it("spaces the letters along the line, centred, upright on a level line", () => {
    const glyphs = setAlong(measure([0, 100, 400, 100]), 200, chars, widths, 2) ?? [];
    expect(glyphs.map((glyph) => glyph.char).join("")).toBe("Donau");
    expect(glyphs.map((glyph) => Math.round(glyph.x * 1000) / 1000)).toEqual([
      180, 190, 200, 210, 220,
    ]);
    for (const glyph of glyphs) {
      expect(glyph.y).toBe(100);
      expect(glyph.angle).toBeCloseTo(0);
    }
  });

  it("reads left to right on a line that runs right to left", () => {
    const glyphs = setAlong(measure([400, 100, 0, 100]), 200, chars, widths, 2) ?? [];
    const xs = glyphs.map((glyph) => glyph.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    for (const glyph of glyphs) expect(Math.abs(glyph.angle)).toBeLessThan(0.01);
  });

  it("tilts with the line", () => {
    const glyphs = setAlong(measure([0, 0, 300, 300]), 200, chars, widths, 2) ?? [];
    for (const glyph of glyphs) expect(glyph.angle).toBeCloseTo(Math.PI / 4);
  });

  it("never stands a letter on its head", () => {
    // Every direction of the compass: the word is either set readable or not at all.
    for (let degrees = 0; degrees < 360; degrees += 15) {
      const angle = (degrees * Math.PI) / 180;
      const line = measure([
        200 - 150 * Math.cos(angle),
        100 - 150 * Math.sin(angle),
        200 + 150 * Math.cos(angle),
        100 + 150 * Math.sin(angle),
      ]);
      const glyphs = setAlong(line, 150, chars, widths, 2);
      for (const glyph of glyphs ?? [])
        expect(Math.abs(glyph.angle)).toBeLessThanOrEqual((100 * Math.PI) / 180);
    }
  });

  it("refuses a line that bends the word sharply", () => {
    expect(setAlong(measure([0, 100, 200, 100, 200, 300]), 200, chars, widths, 2)).toBeNull();
  });

  it("follows a gentle curve, each letter a little further round", () => {
    const xy: number[] = [];
    for (let step = 0; step <= 40; step += 1) {
      const angle = (step / 40) * (Math.PI / 3);
      xy.push(300 * Math.sin(angle), 300 * (1 - Math.cos(angle)));
    }
    const glyphs = setAlong(measure(xy), 150, chars, widths, 2) ?? [];
    expect(glyphs).toHaveLength(5);
    for (let index = 1; index < glyphs.length; index += 1) {
      expect(glyphs[index]!.angle).toBeGreaterThan(glyphs[index - 1]!.angle);
    }
  });

  it("claims one square per letter", () => {
    const glyphs = setAlong(measure([0, 100, 400, 100]), 200, chars, widths, 2) ?? [];
    const boxes = glyphBoxes(glyphs, 12);
    expect(boxes).toHaveLength(5);
    expect(boxes[0]).toEqual({ x: 174, y: 94, w: 12, h: 12 });
  });
});
