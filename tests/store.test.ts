import { describe, expect, it } from "vite-plus/test";

import { DATA_FORMAT } from "../src/data/format.ts";
import { MapStore } from "../src/layers/store.ts";
import { chunk, storeWith } from "./chunks.ts";

describe("the store", () => {
  it("starts empty and fills chunk by chunk, in any order", () => {
    const store = new MapStore();
    expect(store.has("base")).toBe(false);
    expect(store.overview).toBeUndefined();
    store.add(chunk("gemeinden"));
    expect(store.municipalityIndex).toBeUndefined();
    store.add(chunk("borders"));
    expect(store.municipalityIndex?.groups).toBe(2092);
    expect(store.revision).toBe(2);
  });

  it("ignores a chunk it already has", () => {
    const store = storeWith("base");
    const overview = store.overview;
    store.add(chunk("base"));
    expect(store.overview).toBe(overview);
    expect(store.revision).toBe(1);
  });

  it("refuses a chunk in another format", () => {
    const store = new MapStore();
    expect(() => store.add({ ...chunk("base"), format: DATA_FORMAT + 1 })).toThrow(/format/);
    expect(store.has("base")).toBe(false);
  });

  it("lists every source once, however many chunks carry it", () => {
    const store = storeWith();
    const sources = store.sources();
    expect(sources.map((source) => source.id).sort()).toEqual(
      [
        "bev-dgm",
        "bev-dlm-namen",
        "bev-dlm-verkehr",
        "bev-vgd",
        "bmluk-ggn",
        "statistik-bev",
      ].sort(),
    );
    expect(store.source("statistik-bev")?.holder).toBe("Statistik Austria");
    expect(store.source("nasa")).toBeUndefined();
    expect(
      storeWith("gemeinden")
        .sources()
        .map((source) => source.holder),
    ).toEqual(["BEV"]);
  });

  it("lists the sources in the same order whichever chunk arrived first", () => {
    // Chunks load in parallel; the credit line is built from this list.
    const holders = (store: MapStore): string[] => [
      ...new Set(store.sources().map((source) => source.holder)),
    ];
    const forwards = storeWith("base", "borders", "places");
    const backwards = storeWith("places", "borders", "base");
    expect(holders(backwards)).toEqual(holders(forwards));
    expect(holders(forwards)).toEqual(["BEV", "BMLUK", "Statistik Austria"]);
  });

  it("tells the three levels of the fine borders apart", () => {
    const { level, arcs } = storeWith("borders").detail!;
    expect(level).toHaveLength(arcs.lines.count);
    expect(new Set(level)).toEqual(new Set([0, 1, 2]));
  });
});
