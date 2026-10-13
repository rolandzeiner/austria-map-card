/**
 * @vitest-environment happy-dom
 *
 * The built files, as a browser gets them: dist/austria-map-card.js is
 * imported as it is, and has to find, import and draw its data chunks from
 * beside itself with nothing injected.
 *
 * Every other suite runs the TypeScript sources. This one is what would
 * notice a bundle that does not evaluate (an import cycle the bundler
 * ordered badly), a chunk address worked out wrongly from import.meta.url,
 * or a card and chunks that no longer speak the same format.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

import { FakePath, fakeContext } from "./fake-canvas.ts";

/** The one thing these tests need from Node, without pulling in its types. */
declare const process: { cwd(): string };

type ResizeCallback = (entries: Array<{ contentRect: { width: number; height: number } }>) => void;
const resizeCallbacks: ResizeCallback[] = [];
const fake = fakeContext();

interface BuiltCard extends HTMLElement {
  hass: unknown;
  setConfig(config: unknown): void;
  updateComplete: Promise<boolean>;
}

beforeAll(async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      public constructor(callback: ResizeCallback) {
        resizeCallbacks.push(callback);
      }
      public observe(): void {}
      public disconnect(): void {}
    },
  );
  vi.stubGlobal("Path2D", FakePath);
  vi.stubGlobal("getComputedStyle", () => ({ color: "rgb(40, 40, 40)", fontFamily: "sans-serif" }));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  HTMLCanvasElement.prototype.getContext = (() => fake.ctx) as unknown as HTMLCanvasElement["getContext"];
  // A file address from the working directory: in a DOM environment
  // import.meta.url is a pretend http address, which Node cannot import.
  // And a variable, so neither TypeScript nor the test runner follows it.
  const bundle = `file://${process.cwd()}/dist/austria-map-card.js`;
  await import(/* @vite-ignore */ bundle);
});

describe("the built card", () => {
  it("registers its element and its editor", () => {
    expect(customElements.get("austria-map-card")).toBeDefined();
    expect(customElements.get("austria-map-card-editor")).toBeDefined();
  });

  it("loads its data from the files beside it and draws the map", async () => {
    const card = document.createElement("austria-map-card") as BuiltCard;
    card.setConfig({ type: "custom:austria-map-card", layers: ["terrain", "rivers", "provinces", "districts", "cities"] });
    card.hass = { locale: { language: "de" }, themes: { darkMode: false } };
    document.body.appendChild(card);
    await card.updateComplete;
    for (const callback of resizeCallbacks) callback([{ contentRect: { width: 760, height: 403 } }]);

    // Three chunks, each a real import() of a real file.
    for (let wait = 0; wait < 300 && !fake.texts().includes("Wien"); wait += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(fake.texts()).toContain("Wien");
    expect(fake.texts()).toContain("TIROL");
    expect(fake.named("clip").length).toBeGreaterThan(0);

    // Zoom in twice with the keyboard: district names are shown from there,
    // and they come from the borders chunk.
    const canvas = card.shadowRoot?.querySelector("canvas");
    for (let press = 0; press < 2; press += 1) {
      canvas?.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true, cancelable: true }));
    }
    for (let wait = 0; wait < 300 && !fake.texts().includes("LIEZEN"); wait += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(fake.texts()).toContain("LIEZEN");

    await card.updateComplete;
    const credit = card.shadowRoot?.querySelector(".credit")?.textContent?.replace(/\s+/g, " ").trim();
    expect(credit).toBe("Daten: BEV, BMLUK, Statistik Austria · CC BY 4.0");
    expect(card.shadowRoot?.querySelector(".notice")).toBeNull();
  });
});
