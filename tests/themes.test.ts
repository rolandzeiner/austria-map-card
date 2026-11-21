/**
 * The themes: the default is the palette mixed from Home Assistant's
 * colours, untouched; Leonida is a look of its own.
 */
import { describe, expect, it } from "vite-plus/test";

import {
  DARK_THEME,
  LIGHT_THEME,
  derivePalette,
  parseColour,
  type Rgb,
} from "../src/map/palette.ts";
import { sorted } from "../src/sorted.ts";
import { LEONIDA_LUT, lookUp, paletteFor } from "../src/map/themes.ts";
import { THEME_IDS } from "../src/types.ts";
import { storeWith } from "./chunks.ts";

const rgb = (colour: string): Rgb => parseColour(colour) as Rgb;

/** WCAG relative luminance, and the contrast ratio of two colours. */
function luminance(colour: Rgb): number {
  const [r, g, b] = colour.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: Rgb, b: Rgb): number => {
  const [low, high] = sorted([luminance(a), luminance(b)], (p, q) => p - q) as [number, number];
  return (high + 0.05) / (low + 0.05);
};

describe("the default theme", () => {
  it("is the palette mixed from Home Assistant's theme, with no sea and no grid", () => {
    for (const theme of [LIGHT_THEME, DARK_THEME]) {
      const palette = paletteFor("default", theme);
      // Everything but `band`, which is a function: compared by what it returns.
      expect(JSON.stringify(palette)).toBe(JSON.stringify(derivePalette(theme)));
      expect(palette.band(1000)).toBe(derivePalette(theme).band(1000));
      expect(palette.sea).toBeUndefined();
      expect(palette.grid).toBeUndefined();
    }
  });
});

describe("the look-up table", () => {
  const table = [
    [0, [0, 0, 0]],
    [100, [100, 200, 50]],
    [300, [200, 200, 150]],
  ] as const;

  it("returns a listed height's own colour and mixes between two", () => {
    expect(lookUp(table, 100)).toEqual([100, 200, 50]);
    expect(lookUp(table, 50)).toEqual([50, 100, 25]);
    expect(lookUp(table, 200)).toEqual([150, 200, 100]);
  });

  it("holds the first and last colour beyond its ends", () => {
    expect(lookUp(table, -20)).toEqual([0, 0, 0]);
    expect(lookUp(table, 4000)).toEqual([200, 200, 150]);
  });

  it("lists Leonida's heights in rising order, up to the highest band in the data", () => {
    const heights = LEONIDA_LUT.map(([metres]) => metres);
    expect(heights).toEqual(sorted(heights, (a, b) => a - b));
    const store = storeWith();
    const highest = Math.max(...store.overview!.terrain.levels, ...store.terrainDetail!.levels);
    expect(heights.at(-1)).toBe(highest);
  });
});

describe("the Leonida theme", () => {
  const leonida = paletteFor("leonida", LIGHT_THEME);

  it("is offered as a theme", () => {
    expect(THEME_IDS).toContain("leonida");
  });

  it("brings its own colours whatever the dashboard's theme, and keeps its font", () => {
    const onDark = paletteFor("leonida", { ...DARK_THEME, font: "Inter, sans-serif" });
    expect(onDark.land).toBe(leonida.land);
    expect(onDark.sea).toEqual(leonida.sea);
    expect(onDark.accent).toBe(leonida.accent);
    expect(onDark.font).toBe("Inter, sans-serif");
  });

  it("floods the canvas with a sea and lays shallow water along the coast, widest band first", () => {
    const sea = leonida.sea!;
    expect(rgb(sea.deep)).toEqual([1, 171, 200]);
    const reaches = sea.shelf.map((band) => band.reach);
    expect(reaches).toEqual(sorted(reaches, (a, b) => b - a));
    expect(reaches.length).toBeGreaterThan(1);
  });

  it("shades a height the same whichever set of bands it comes from", () => {
    expect(leonida.band(1000)).toBe(leonida.band(1000));
    expect(leonida.band(400)).not.toBe(leonida.band(700));
    expect(rgb(leonida.band(0))).toEqual(rgb(leonida.land));
  });

  it("sets the land, the lakes and the coast off from the sea", () => {
    const deep = rgb(leonida.sea!.deep);
    expect(leonida.land).not.toBe(leonida.sea!.deep);
    expect(leonida.water).not.toBe(leonida.sea!.deep);
    expect(contrast(rgb(leonida.outline), deep)).toBeGreaterThan(1.5);
  });

  it("draws the inland borders darker than every height, heavier ones darker still", () => {
    const darkest = Math.min(...LEONIDA_LUT.map(([, colour]) => luminance(colour)));
    const borders = [leonida.province, leonida.district, leonida.municipality].map((colour) =>
      luminance(rgb(colour)),
    );
    expect(borders).toEqual(sorted(borders, (a, b) => a - b));
    expect(borders.at(-1)).toBeLessThan(darkest);
  });

  it("keeps names readable on their dark edge", () => {
    const edge = parseColour(leonida.halo) as Rgb;
    for (const name of [leonida.label, leonida.labelMuted, leonida.waterLabel]) {
      expect(contrast(rgb(name), edge), name).toBeGreaterThan(4.5);
    }
    expect(contrast(rgb(leonida.grid!.text), rgb(leonida.grid!.ruler))).toBeGreaterThan(4.5);
  });

  it("gives every colour the tilted map reads as a solid one it can parse", () => {
    for (const colour of [
      leonida.water,
      leonida.outline,
      leonida.province,
      leonida.district,
      leonida.municipality,
      leonida.motorway,
      leonida.motorwayCasing,
      leonida.road,
      leonida.roadCasing,
      leonida.accent,
      leonida.grid!.line,
      leonida.sea!.deep,
    ]) {
      expect(parseColour(colour), colour).not.toBeNull();
    }
  });
});
