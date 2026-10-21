/**
 * The summits: what the data holds, which of them the map names at which
 * scale, and what a tap on one says.
 */
import { describe, expect, it } from "vite-plus/test";

import { describeFeature } from "../src/layers/info.ts";
import { fitScale, homeCamera, type Camera } from "../src/map/camera.ts";
import { LIGHT_THEME, derivePalette } from "../src/map/palette.ts";
import { project } from "../src/map/projection.ts";
import { MapRenderer, type RenderState } from "../src/map/renderer.ts";
import { storeWith } from "./chunks.ts";
import { fakeCanvas, fakeContext, fakePath } from "./fake-canvas.ts";

const store = storeWith();
const peaks = store.peaks!;
const size = { width: 760, height: 403 };

function draw(camera: Camera): { texts: string[]; renderer: MapRenderer; state: RenderState } {
  const fake = fakeContext();
  const renderer = new MapRenderer(fakeCanvas(fake), store, fakePath);
  renderer.resize(size.width, size.height, 1);
  renderer.setPalette(derivePalette(LIGHT_THEME));
  const state: RenderState = {
    camera,
    layers: new Set(["peaks"]),
    showLabels: true,
    selection: null,
    here: null,
  };
  renderer.draw(state);
  return { texts: fake.texts(), renderer, state };
}

describe("the summit data", () => {
  it("leads with the Großglockner, the one summit without a higher one", () => {
    expect(peaks.names[0]).toBe("Großglockner");
    expect(peaks.height[0]).toBe(3798);
    expect(peaks.isolation[0]).toBe(9999);
  });

  it("keeps the summits that stand out, and not the shoulders of bigger ones", () => {
    expect(peaks.count).toBeGreaterThan(5000);
    expect(peaks.names).toContain("Wildspitze");
    expect(peaks.names).toContain("Hoher Dachstein");
    expect(peaks.names).toContain("Schneeberg");
    // 120 m from the Großglockner: a shoulder of it.
    expect(peaks.names).not.toContain("Kleinglockner");
  });
});

describe("naming summits", () => {
  it("names only the most isolated on the whole country, with their height", () => {
    const { texts } = draw(homeCamera(size));
    expect(texts).toContain("Großglockner");
    expect(texts).toContain("3798");
    // About two dozen: the highest of each range, spread over the country.
    expect(texts.filter((text) => /^\d+$/.test(text)).length).toBeGreaterThan(10);
    expect(texts.filter((text) => /^\d+$/.test(text)).length).toBeLessThan(30);
  });

  it("names more of them the further in the map is", () => {
    const [x, y] = project(47.07, 12.69);
    const near = draw({ x, y, k: fitScale(size) * 12 }).texts;
    expect(near.length).toBeGreaterThan(draw(homeCamera(size)).texts.length);
  });
});

describe("a tapped summit", () => {
  it("is found by its mark and described with its height and municipality", () => {
    const [x, y] = project(47.0742, 12.6947);
    const { renderer, state } = draw({ x, y, k: fitScale(size) * 8 });
    const hit = renderer.hit(state, size.width / 2, size.height / 2);
    expect(hit).toEqual({ kind: "peak", row: 0 });
    const info = describeFeature(store, hit!)!;
    expect(info.name).toBe("Großglockner");
    expect(info.kind).toBe("kinds.peak");
    expect(info.facts[0]).toMatchObject({ label: "facts.height", value: 3798, format: "metres" });
    expect(info.parents.at(-1)).toMatch(/Kärnten|Tirol/);
  });
});
