/**
 * Which lines the tilted map draws, and how they are cut to follow the ground.
 */
import { describe, expect, it } from "vitest";

import type { Lines } from "../src/data/format.ts";
import { LIGHT_THEME, derivePalette } from "../src/map/palette.ts";
import { reliefLines, segmentsOf } from "../src/map/relief-lines.ts";
import type { LayerId } from "../src/types.ts";
import { storeWith } from "./chunks.ts";

const palette = derivePalette(LIGHT_THEME);
const store = storeWith();
const keys = (layers: LayerId[], scale: number, selection = null as Parameters<typeof reliefLines>[3]): string[] =>
  reliefLines(store, new Set(layers), scale, selection, palette).map((set) => set.key);

describe("segments", () => {
  it("cuts long steps so a line follows the ground between cells", () => {
    const line: Lines = { xy: Float32Array.from([0, 0, 2, 0]), start: Uint32Array.from([0, 2]), count: 1, closed: false };
    const segments = segmentsOf(line, () => true);
    expect(segments.length / 4).toBe(4);
    expect([...segments.slice(0, 4)]).toEqual([0, 0, 0.5, 0]);
    expect([...segments.slice(-4)]).toEqual([1.5, 0, 2, 0]);
  });

  it("closes rings and leaves out lines not asked for", () => {
    const ring: Lines = {
      xy: Float32Array.from([0, 0, 0.3, 0, 0.3, 0.3, 9, 9, 9.2, 9]),
      start: Uint32Array.from([0, 3, 5]),
      count: 2,
      closed: true,
    };
    const segments = segmentsOf(ring, (line) => line === 0);
    // Three sides, the last one back to the start.
    expect(segments.length / 4).toBe(3);
    expect([...segments.slice(-2)]).toEqual([0, 0]);
  });
});

describe("the lines of the tilted map", () => {
  it("draws what the flat map strokes, rivers first and the national border last", () => {
    const drawn = keys(["terrain", "rivers", "provinces"], 0.8);
    expect(drawn[0]).toBe("rivers:overview:5");
    expect(drawn.slice(-2)).toEqual(["borders:coarse:1", "borders:coarse:0"]);
  });

  it("switches to the fine borders and the detailed rivers zoomed in, as the flat map does", () => {
    const drawn = keys(["rivers", "provinces", "districts"], 6);
    expect(drawn).toContain("rivers:detail:3");
    expect(drawn.slice(-3)).toEqual(["borders:fine:2", "borders:fine:1", "borders:fine:0"]);
  });

  it("keeps the national border with every layer off", () => {
    expect(keys([], 1)).toEqual(["borders:coarse:0"]);
  });

  it("outlines a selected area or river in the accent colour", () => {
    const area = reliefLines(store, new Set(), 1, { kind: "province", row: 2 }, palette).at(-1)!;
    expect(area.key).toBe("selected:province:2:coarse");
    expect(area.segments().length).toBeGreaterThan(0);
    expect(area.colour).toEqual([3, 169, 244]);
    const river = reliefLines(store, new Set(["rivers"]), 1, { kind: "river", name: "Donau", order: 9 }, palette).at(-1)!;
    expect(river.key).toMatch(/^selected:river:Donau:overview/);
  });

  it("keeps lines as wide on screen as the flat map does, growing a little with zoom", () => {
    const near = reliefLines(store, new Set(), 8, null, palette).at(-1)!;
    const far = reliefLines(store, new Set(), 1, null, palette).at(-1)!;
    expect(far.width).toBe(1.5);
    expect(near.width).toBeGreaterThan(far.width);
  });
});
