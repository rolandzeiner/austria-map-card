import { describe, expect, it } from "vite-plus/test";

import {
  DARK_THEME,
  LIGHT_THEME,
  css,
  derivePalette,
  mix,
  parseColour,
} from "../src/map/palette.ts";

const luminance = (colour: string): number => {
  const [r, g, b] = parseColour(colour) as readonly [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("computed colours", () => {
  it("reads the shapes getComputedStyle returns", () => {
    expect(parseColour("rgb(33, 33, 33)")).toEqual([33, 33, 33]);
    expect(parseColour("rgba(3, 169, 244, 0.9)")).toEqual([3, 169, 244]);
    expect(parseColour("rgb(3 169 244 / 80%)")).toEqual([3, 169, 244]);
    expect(parseColour("color(srgb 1 0.5 0)")).toEqual([255, 127.5, 0]);
    expect(parseColour("color(srgb 0.2 0.4 0.6 / 0.75)")?.map(Math.round)).toEqual([51, 102, 153]);
  });

  it("has nothing to say about a see-through or an unreadable colour", () => {
    expect(parseColour("rgba(0, 0, 0, 0)")).toBeNull();
    expect(parseColour("rgba(255, 255, 255, 0.2)")).toBeNull();
    expect(parseColour("transparent")).toBeNull();
    expect(parseColour("")).toBeNull();
  });

  it("mixes and prints", () => {
    expect(mix([0, 0, 0], [200, 100, 50], 0.5)).toEqual([100, 50, 25]);
    expect(css([300, -5, 127.6])).toBe("rgb(255, 0, 128)");
    expect(css([1, 2, 3], 0.5)).toBe("rgba(1, 2, 3, 0.5)");
  });
});

describe("the palette", () => {
  const light = derivePalette(LIGHT_THEME);
  const dark = derivePalette(DARK_THEME);

  it("sets the land off from the card on both themes", () => {
    expect(luminance(light.land)).toBeLessThan(250);
    expect(luminance(light.land)).toBeGreaterThan(225);
    expect(luminance(dark.land)).toBeGreaterThan(35);
    expect(luminance(dark.land)).toBeLessThan(70);
  });

  it("darkens the terrain with height on a light theme", () => {
    const shades = [400, 1000, 1600, 2500].map((level) => luminance(light.band(level)));
    for (let index = 1; index < shades.length; index += 1)
      expect(shades[index]!).toBeLessThan(shades[index - 1]!);
    expect(shades[0]!).toBeLessThan(luminance(light.land));
  });

  it("lightens the terrain with height on a dark theme", () => {
    const shades = [400, 1000, 1600, 2500].map((level) => luminance(dark.band(level)));
    for (let index = 1; index < shades.length; index += 1)
      expect(shades[index]!).toBeGreaterThan(shades[index - 1]!);
    expect(shades[0]!).toBeGreaterThan(luminance(dark.land));
  });

  it("shades a height the same whichever set of bands it comes from", () => {
    // 1000 m is the overview's third level and lies between two of the detail's.
    expect(luminance(light.band(1030))).toBeLessThan(luminance(light.band(1000)));
    expect(luminance(light.band(1030))).toBeGreaterThan(luminance(light.band(1300)));
  });

  it("draws heavier borders darker: country, province, district, municipality", () => {
    for (const palette of [light, dark]) {
      const contrast = (colour: string): number =>
        Math.abs(luminance(colour) - luminance(palette.land));
      expect(contrast(palette.outline)).toBeGreaterThan(contrast(palette.province));
      expect(contrast(palette.province)).toBeGreaterThan(contrast(palette.district));
      expect(contrast(palette.district)).toBeGreaterThan(contrast(palette.municipality));
      expect(contrast(palette.municipality)).toBeGreaterThan(20);
    }
  });

  it("keeps names readable on the highest ground", () => {
    for (const palette of [light, dark]) {
      expect(Math.abs(luminance(palette.label) - luminance(palette.band(2500)))).toBeGreaterThan(
        110,
      );
    }
  });

  it("takes the accent and the font from the theme", () => {
    const custom = derivePalette({ ...LIGHT_THEME, accent: [200, 16, 46], font: "Inter" });
    expect(custom.accent).toBe("rgb(200, 16, 46)");
    expect(custom.accentFill).toBe("rgba(200, 16, 46, 0.18)");
    expect(custom.font).toBe("Inter");
  });
});
