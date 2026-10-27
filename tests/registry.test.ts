/** Which data and which detail the map uses at which scale. */
import { describe, expect, it } from "vite-plus/test";

import { LAYERS, chunksFor, layerById, useFineBorders } from "../src/layers/registry.ts";
import { minimumRank } from "../src/layers/places.ts";
import { riversAt } from "../src/layers/rivers.ts";
import { SCALES, grown } from "../src/layers/scales.ts";
import { LABEL_SCALES, riverLabel, riverLabelLevel, shortTownName } from "../src/map/labels.ts";
import { LAYER_IDS, type LayerId } from "../src/types.ts";
import { storeWith } from "./chunks.ts";

const layers = (...ids: LayerId[]): Set<LayerId> => new Set(ids);

describe("the registry", () => {
  it("lists every layer once, in drawing order", () => {
    expect(LAYERS.map((layer) => layer.id)).toEqual([...LAYER_IDS]);
    for (const layer of LAYERS) expect(layer.icon).toMatch(/^mdi:/);
    expect(layerById("rivers").id).toBe("rivers");
  });

  it("clips only the terrain and the lakes to the country", () => {
    expect(LAYERS.filter((layer) => layer.clipped).map((layer) => layer.id)).toEqual([
      "terrain",
      "lakes",
    ]);
  });
});

describe("chunks by scale", () => {
  const standard = layers("terrain", "rivers", "provinces", "cities");

  it("needs only the base chunk and the places for the default map of the whole country", () => {
    expect(chunksFor(standard, 0.5)).toEqual(["base", "places"]);
    expect(chunksFor(layers(), 0.5)).toEqual(["base"]);
  });

  it("brings in the fine borders, terrain and rivers as the map zooms in", () => {
    expect(chunksFor(standard, SCALES.riversDetail)).toEqual(["base", "rivers-detail", "places"]);
    expect(chunksFor(standard, SCALES.fineBorders)).toEqual([
      "base",
      "borders",
      "terrain-detail",
      "rivers-detail",
      "places",
    ]);
  });

  it("loads no detail for a layer that is switched off", () => {
    expect(chunksFor(layers("provinces"), 10)).toEqual(["base", "borders"]);
  });

  it("loads the borders chunk for districts at any scale", () => {
    expect(chunksFor(layers("districts"), 0.4)).toEqual(["base", "borders"]);
  });

  it("holds the municipal borders back until they can be told apart", () => {
    expect(chunksFor(layers("municipalities"), SCALES.municipalities - 0.01)).not.toContain(
      "gemeinden",
    );
    expect(chunksFor(layers("municipalities"), SCALES.municipalities)).toEqual([
      "base",
      "borders",
      "gemeinden",
    ]);
    expect(layerById("municipalities").minScale).toBe(SCALES.municipalities);
  });

  it("depends on pixels per unit, so a wide card gets detail at a lower zoom", () => {
    // The same zoom of 3 on a 400 px and on a 1200 px wide card.
    expect(chunksFor(standard, 0.4 * 3)).not.toContain("terrain-detail");
    expect(chunksFor(standard, 1.2 * 3)).toContain("terrain-detail");
  });
});

describe("detail by what is loaded", () => {
  it("draws the generalised borders until the fine ones have arrived", () => {
    const base = storeWith("base");
    expect(useFineBorders(base, layers("districts"), 10)).toBe(false);
    const both = storeWith("base", "borders");
    expect(useFineBorders(both, layers("provinces"), 1)).toBe(false);
    expect(useFineBorders(both, layers("provinces"), SCALES.fineBorders)).toBe(true);
    expect(useFineBorders(both, layers("districts"), 0.4)).toBe(true);
  });

  it("draws the overview's rivers until the detail has arrived, then more streams with scale", () => {
    const base = storeWith("base");
    expect(riversAt(base, 20)).toMatchObject({ set: "overview", minOrder: 5 });
    const both = storeWith("base", "rivers-detail");
    expect(riversAt(both, SCALES.riversDetail - 0.1)).toMatchObject({
      set: "overview",
      minOrder: 5,
    });
    expect(riversAt(both, SCALES.riversDetail)).toMatchObject({ set: "detail", minOrder: 4 });
    expect(riversAt(both, SCALES.streams)).toMatchObject({ set: "detail", minOrder: 3 });
    expect(riversAt(storeWith("places"), 1)).toBeUndefined();
  });
});

describe("names by scale", () => {
  it("shows smaller towns the further in the map is", () => {
    const ranks = [0.4, 1, 1.5, 3, 5, 8, 20].map(minimumRank);
    for (let index = 1; index < ranks.length; index += 1)
      expect(ranks[index]!).toBeLessThan(ranks[index - 1]!);
    expect(minimumRank(20)).toBe(0);
  });

  it("names the largest rivers at every scale and streams only zoomed in", () => {
    expect(LABEL_SCALES.rivers[9]).toBe(0);
    expect(LABEL_SCALES.rivers[3]!).toBeGreaterThan(LABEL_SCALES.rivers[5]!);
  });

  it("letters rivers along a wider sweep the smaller the scale", () => {
    expect(riverLabelLevel(0.4)).toBe(2);
    expect(riverLabelLevel(1.5)).toBe(1);
    expect(riverLabelLevel(5)).toBe(0);
  });

  it("letters a river by its plain name", () => {
    expect(riverLabel("Thaya (Dyje)")).toBe("Thaya");
    expect(riverLabel("Weidenbach [March, bei Zwerndorf]")).toBe("Weidenbach");
    expect(riverLabel("Donau")).toBe("Donau");
  });

  it("shortens a capital's name for the small map", () => {
    expect(shortTownName("Klagenfurt am Wörthersee")).toBe("Klagenfurt");
    expect(shortTownName("St. Pölten")).toBe("St. Pölten");
    expect(shortTownName("Wien")).toBe("Wien");
  });
});

describe("line widths", () => {
  it("grow a little with the scale and never shrink", () => {
    expect(grown(1, 0.4)).toBe(1);
    expect(grown(1, 4)).toBeGreaterThan(1.3);
    expect(grown(1, 1000)).toBe(1.7);
  });
});
