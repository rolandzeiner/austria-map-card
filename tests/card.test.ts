/**
 * @vitest-environment happy-dom
 *
 * The card element end to end: mounting, loading, the layer list, taps and
 * the info panel, keyboard and wheel. The set-up is in card-harness.ts.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { toScreen, zoomOf } from "../src/map/camera.ts";
import { PROVINCE_IDS } from "../src/types.ts";
import {
  $,
  all,
  fake,
  hassEn,
  key,
  mount,
  pageLoader,
  placeAt,
  pointer,
  requested,
  requestedIds,
  resizeCallbacks,
  settle,
  setUp,
  size,
  tap,
  tearDown,
  text,
  tool,
  zoomIn,
  type CardInternals,
} from "./card-harness.ts";

beforeAll(setUp);
afterEach(tearDown);

describe("the card contract", () => {
  it("registers itself with the card picker, once", () => {
    const cards = (window as unknown as { customCards: Array<{ type: string; preview?: boolean }> }).customCards;
    expect(cards.filter((entry) => entry.type === "austria-map-card")).toHaveLength(1);
    expect(cards[0]?.preview).toBe(true);
  });

  it("needs no configuration: the stub is empty and the defaults do the rest", async () => {
    const element = customElements.get("austria-map-card") as unknown as {
      getStubConfig(): Record<string, unknown>;
      getConfigElement(): HTMLElement;
    };
    expect(element.getStubConfig()).toEqual({});
    expect(element.getConfigElement().tagName.toLowerCase()).toBe("austria-map-card-editor");
    const card = await mount();
    expect([...card._layers]).toEqual(["terrain", "rivers", "provinces", "cities"]);
  });

  it("asks for a full-width cell and says how tall it is", async () => {
    const card = await mount();
    expect(card.getGridOptions()).toEqual({ columns: 12, rows: 7, min_columns: 6, min_rows: 5 });
    expect(card.getCardSize()).toBe(8);
  });

  it("throws on a config it cannot use, so Lovelace shows what is wrong", () => {
    const card = document.createElement("austria-map-card") as unknown as CardInternals;
    expect(() => card.setConfig({ type: "custom:austria-map-card", view: "AT-0" })).toThrow(/"view"/);
  });

  it("shows the title only when there is one", async () => {
    expect($(await mount(), ".title")).toBeNull();
    expect(text(await mount({ title: "Österreich" }), ".title")).toBe("Österreich");
  });
});

describe("loading", () => {
  it("loads the base chunk and the places for the default map, and nothing else", async () => {
    await mount();
    expect(new Set(requestedIds())).toEqual(new Set(["base", "places"]));
    expect(requested.every((url) => url.startsWith("https://ha.example/hacsfiles/austria-map-card/"))).toBe(true);
  });

  it("draws the map and credits its sources once the data is there", async () => {
    fake.reset();
    const card = await mount();
    expect(fake.named("fill").length).toBeGreaterThan(8);
    expect(fake.texts()).toContain("Wien");
    expect($(card, ".loading")).toBeNull();
    expect(text(card, ".credit")).toBe("Daten: BEV, BMLUK, Statistik Austria · CC BY 4.0");
    expect($(card, ".credit a")?.getAttribute("href")).toBe("https://creativecommons.org/licenses/by/4.0/");
  });

  it("labels the map for assistive technology and explains its keys", async () => {
    const card = await mount();
    const canvas = $(card, "canvas")!;
    expect(canvas.getAttribute("aria-label")).toBe("Karte von Österreich");
    expect(canvas.getAttribute("tabindex")).toBe("0");
    expect(text(card, `#${canvas.getAttribute("aria-describedby")}`)).toContain("Pfeiltasten");
  });

  it("loads more as layers come on and the map zooms in, each chunk once", async () => {
    const card = await mount();
    const before = requested.length;
    tool(card, "Ebenen").click();
    await settle(card);
    all(card, ".layer").find((row) => row.textContent?.includes("Bezirke"))?.click();
    await settle(card);
    expect(requestedIds(before)).toEqual(["borders"]);
    await zoomIn(card, 5);
    const ids = requestedIds();
    expect(new Set(ids)).toEqual(new Set(["base", "places", "borders", "terrain-detail", "rivers-detail"]));
    expect(ids).toHaveLength(new Set(ids).size);
  });
});

describe("the toolbar", () => {
  it("zooms in and out about the centre and resets", async () => {
    const card = await mount();
    const start = card._camera!;
    expect(zoomOf(start, size)).toBeCloseTo(1);
    expect(tool(card, "Herauszoomen").disabled).toBe(true);
    tool(card, "Hineinzoomen").click();
    await settle(card);
    expect(zoomOf(card._camera!, size)).toBeCloseTo(1.6);
    expect(card._camera!.x).toBeCloseTo(start.x);
    expect(tool(card, "Herauszoomen").disabled).toBe(false);
    tool(card, "Ansicht zurücksetzen").click();
    await settle(card);
    expect(card._camera).toEqual(start);
  });

  it("stops zooming in at the limit and says so by disabling the button", async () => {
    const card = await mount();
    for (let step = 0; step < 12; step += 1) tool(card, "Hineinzoomen").click();
    await settle(card);
    expect(zoomOf(card._camera!, size)).toBeCloseTo(40);
    expect(tool(card, "Hineinzoomen").disabled).toBe(true);
  });

  it("lets a vertical swipe scroll the page until the map is zoomed in", async () => {
    const card = await mount();
    expect($(card, "canvas")?.classList.contains("zoomed")).toBe(false);
    tool(card, "Hineinzoomen").click();
    await settle(card);
    expect($(card, "canvas")?.classList.contains("zoomed")).toBe(true);
  });

  it("names every button in the user's language", async () => {
    const card = await mount({}, hassEn);
    expect(all(card, ".toolbar button").map((button) => button.getAttribute("aria-label"))).toEqual([
      "Layers",
      "Zoom in",
      "Zoom out",
      "Reset view",
    ]);
  });
});

describe("the layer list", () => {
  it("opens from its button and lists every layer as a switch", async () => {
    const card = await mount();
    const button = tool(card, "Ebenen");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect($(card, ".layers")).toBeNull();
    button.click();
    await settle(card);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-controls")).toBe($(card, ".layers")?.id);
    const rows = all(card, ".layer");
    expect(rows.map((row) => row.querySelector("span span")?.textContent)).toEqual([
      "Gelände",
      "Flüsse",
      "Gemeinden",
      "Bezirke",
      "Bundesländer",
      "Städte und Orte",
    ]);
    expect(rows.map((row) => row.getAttribute("aria-checked"))).toEqual(["true", "true", "false", "false", "true", "true"]);
    for (const row of rows) expect(row.getAttribute("role")).toBe("switch");
  });

  it("switches a layer on and off, for this session only", async () => {
    const card = await mount();
    tool(card, "Ebenen").click();
    await settle(card);
    const terrain = all(card, ".layer")[0]!;
    fake.reset();
    terrain.click();
    await settle(card);
    expect(card._layers.has("terrain")).toBe(false);
    expect(terrain.getAttribute("aria-checked")).toBe("false");
    // Redrawn without the terrain: the land, and no bands.
    expect(fake.named("fill").filter((call) => call.args[1] === "evenodd")).toHaveLength(1);
    terrain.click();
    await settle(card);
    expect(card._layers.has("terrain")).toBe(true);
  });

  it("says when a layer is on but waits for zoom", async () => {
    const card = await mount({ layers: ["municipalities", "provinces"] });
    tool(card, "Ebenen").click();
    await settle(card);
    const row = all(card, ".layer").find((entry) => entry.textContent?.includes("Gemeinden"))!;
    expect(row.querySelector(".layer-note")?.textContent).toBe("Erscheint, wenn du hineinzoomst");
    await zoomIn(card, 6);
    expect(row.querySelector(".layer-note")).toBeNull();
  });

  it("closes on Escape and gives the focus back to its button", async () => {
    const card = await mount();
    const button = tool(card, "Ebenen");
    button.click();
    await settle(card);
    all(card, ".layer")[2]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    await settle(card);
    expect($(card, ".layers")).toBeNull();
    expect(card.shadowRoot?.activeElement).toBe(button);
  });

  it("closes when the map or the page is pressed", async () => {
    const card = await mount();
    tool(card, "Ebenen").click();
    await settle(card);
    pointer(card, "pointerdown", 300, 200);
    pointer(card, "pointerup", 300, 200);
    await settle(card);
    expect(card._layersOpen).toBe(false);
  });

  it("is not offered when the config locks the layers", async () => {
    const card = await mount({ show_layer_control: false });
    expect(tool(card, "Ebenen")).toBeUndefined();
    expect(all(card, ".toolbar button")).toHaveLength(3);
  });
});

describe("tapping the map", () => {
  it("describes a town under the map, with its municipality, district and province once those are loaded", async () => {
    const card = await mount();
    expect(text(card, ".info-idle")).toBe("Tippe auf die Karte, um zu sehen, was dort ist.");
    await tap(card, ...placeAt(card, "Graz"));
    expect(card._selection).toEqual({ kind: "city", row: pageLoader().store.places!.names.indexOf("Graz") });
    expect(text(card, ".info-name")).toBe("Graz Stadt");
    // The tap asked for the borders chunk, which holds the parents.
    expect(pageLoader().state("borders")).toBe("ready");
    expect(text(card, ".info-parents")).toBe("Graz(Stadt) · Steiermark");
    expect(text(card, ".facts")).toMatch(/^Einwohner der Gemeinde [\d.]+ Statistik Austria, Stand 01\.01\.2026$/);
    expect($(card, ".info-text")?.getAttribute("aria-live")).toBe("polite");
  });

  it("describes a province where there is no town", async () => {
    const card = await mount({ layers: ["provinces"] });
    const table = pageLoader().store.overview!.provinces;
    const row = PROVINCE_IDS.indexOf("AT-7");
    await tap(card, ...toScreen(card._camera!, size, table.at[row * 2]!, table.at[row * 2 + 1]!));
    expect(text(card, ".info-name")).toBe("Tirol Bundesland");
    expect($(card, ".info-parents")).toBeNull();
    expect(text(card, ".facts")).toContain("Einwohner");
  });

  it("formats numbers for the user's language", async () => {
    const card = await mount({ layers: ["provinces"] }, hassEn);
    const table = pageLoader().store.overview!.provinces;
    const row = PROVINCE_IDS.indexOf("AT-9");
    await tap(card, ...toScreen(card._camera!, size, table.at[row * 2]!, table.at[row * 2 + 1]!));
    expect(text(card, ".info-name")).toBe("Wien Province");
    expect(text(card, ".facts")).toMatch(/Population 2,\d{3},\d{3} Statistik Austria, as of 01\.01\.2026/);
  });

  it("clears the selection on a tap abroad and with the close button", async () => {
    const card = await mount();
    await tap(card, ...placeAt(card, "Linz"));
    expect(card._selection).not.toBeNull();
    tool(card, "Auswahl aufheben").click();
    await settle(card);
    expect(card._selection).toBeNull();
    await tap(card, ...placeAt(card, "Linz"));
    await tap(card, 20, 20);
    expect(card._selection).toBeNull();
    expect($(card, ".info-actions")).toBeNull();
  });

  it("zooms to what is selected", async () => {
    const card = await mount();
    await tap(card, ...placeAt(card, "Salzburg"));
    all(card, ".info-actions button").find((button) => button.textContent?.includes("Hierher zoomen"))?.click();
    await settle(card);
    expect(zoomOf(card._camera!, size)).toBeGreaterThan(10);
    const [x, y] = placeAt(card, "Salzburg");
    expect(x).toBeCloseTo(size.width / 2, 0);
    expect(y).toBeCloseTo(size.height / 2, 0);
  });

  it("does not select when the press turned into a drag", async () => {
    const card = await mount();
    tool(card, "Hineinzoomen").click();
    await settle(card);
    const before = card._camera!;
    const [x, y] = placeAt(card, "Wien");
    pointer(card, "pointerdown", x, y);
    pointer(card, "pointermove", x - 60, y - 20);
    pointer(card, "pointerup", x - 60, y - 20);
    await settle(card);
    expect(card._selection).toBeNull();
    expect(card._camera!.x).toBeGreaterThan(before.x);
  });

  it("does not select when the press was cancelled", async () => {
    const card = await mount();
    const [x, y] = placeAt(card, "Wien");
    pointer(card, "pointerdown", x, y);
    pointer(card, "pointercancel", x, y);
    await settle(card);
    expect(card._selection).toBeNull();
  });

  it("zooms in on a double tap, about the tapped spot", async () => {
    const card = await mount({ layers: [] });
    await tap(card, 500, 150);
    await tap(card, 500, 150);
    expect(zoomOf(card._camera!, size)).toBeCloseTo(1.6 * 1.6);
    expect(card._camera!.x).toBeGreaterThan(500);
  });
});

describe("the keyboard", () => {
  it("zooms with plus and minus and resets with 0", async () => {
    const card = await mount();
    const start = card._camera!;
    expect((await key(card, "+")).defaultPrevented).toBe(true);
    expect(zoomOf(card._camera!, size)).toBeCloseTo(1.6);
    await key(card, "-");
    expect(zoomOf(card._camera!, size)).toBeCloseTo(1);
    await key(card, "+");
    await key(card, "0");
    expect(card._camera).toEqual(start);
  });

  it("moves the view with the arrows once zoomed in", async () => {
    const card = await mount();
    await key(card, "+");
    await key(card, "+");
    const before = card._camera!;
    await key(card, "ArrowRight");
    expect(card._camera!.x).toBeGreaterThan(before.x);
    await key(card, "ArrowUp");
    expect(card._camera!.y).toBeLessThan(before.y);
  });

  it("reads out what is at the centre on Enter", async () => {
    const card = await mount({ layers: ["provinces"] });
    await key(card, "Enter");
    expect(card._selection?.kind).toBe("province");
    expect(text(card, ".info-text")).toMatch(/Bundesland/);
  });

  it("says so when there is nothing at the centre", async () => {
    const card = await mount({ layers: [] });
    await key(card, "Enter");
    expect(card._selection).toBeNull();
    expect(text(card, ".info-idle")).toBe("An dieser Stelle gibt es nichts anzuzeigen.");
  });

  it("leaves Tab and browser shortcuts alone", async () => {
    const card = await mount();
    const start = card._camera!;
    expect((await key(card, "Tab")).defaultPrevented).toBe(false);
    expect((await key(card, "+", { ctrlKey: true })).defaultPrevented).toBe(false);
    expect((await key(card, "0", { metaKey: true })).defaultPrevented).toBe(false);
    expect(card._camera).toEqual(start);
  });
});

describe("the wheel", () => {
  const wheel = async (card: CardInternals, init: WheelEventInit): Promise<WheelEvent> => {
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, clientX: 380, clientY: 200, ...init });
    // happy-dom's WheelEvent does not take the modifier keys from its init.
    for (const modifier of ["ctrlKey", "metaKey"] as const) {
      Object.defineProperty(event, modifier, { value: init[modifier] ?? false });
    }
    $(card, "canvas")?.dispatchEvent(event);
    await settle(card);
    return event;
  };

  it("leaves plain scrolling to the dashboard and says how to zoom", async () => {
    const card = await mount();
    const start = card._camera!;
    const event = await wheel(card, { deltaY: -100 });
    expect(event.defaultPrevented).toBe(false);
    expect(card._camera).toEqual(start);
    expect(text(card, ".toast")).toBe("Halte Strg oder ⌘ gedrückt und scrolle, um zu zoomen.");
    expect($(card, ".toast")?.getAttribute("role")).toBe("status");
  });

  it("zooms with Ctrl or Cmd held, and keeps the page from scrolling", async () => {
    const card = await mount();
    const event = await wheel(card, { deltaY: -100, ctrlKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(zoomOf(card._camera!, size)).toBeGreaterThan(1.3);
    await wheel(card, { deltaY: -100, metaKey: true });
    expect(zoomOf(card._camera!, size)).toBeGreaterThan(1.9);
  });
});

describe("configuration", () => {
  it("opens on a province when asked to", async () => {
    const card = await mount({ view: "AT-8" });
    const table = pageLoader().store.overview!.provinces;
    const row = PROVINCE_IDS.indexOf("AT-8");
    expect(zoomOf(card._camera!, size)).toBeGreaterThan(3);
    // Vorarlberg's label point is somewhere near the middle of the view.
    const [x, y] = toScreen(card._camera!, size, table.at[row * 2]!, table.at[row * 2 + 1]!);
    expect(Math.abs(x - size.width / 2)).toBeLessThan(size.width / 4);
    expect(Math.abs(y - size.height / 2)).toBeLessThan(size.height / 4);
    // Reset goes back to the province, not to the country.
    tool(card, "Hineinzoomen").click();
    await settle(card);
    const opened = { ...card._camera! };
    tool(card, "Ansicht zurücksetzen").click();
    await settle(card);
    expect(zoomOf(card._camera!, size)).toBeLessThan(zoomOf(opened, size));
    expect(zoomOf(card._camera!, size)).toBeGreaterThan(3);
  });

  it("takes the layers from the config, and again when the config changes", async () => {
    const card = await mount({ layers: ["rivers"] });
    expect([...card._layers]).toEqual(["rivers"]);
    tool(card, "Ebenen").click();
    await settle(card);
    all(card, ".layer")[0]!.click();
    await settle(card);
    expect([...card._layers].sort()).toEqual(["rivers", "terrain"]);
    // Saving something else in the editor does not undo the session's choice.
    card.setConfig({ type: "custom:austria-map-card", layers: ["rivers"], title: "Karte" });
    expect([...card._layers].sort()).toEqual(["rivers", "terrain"]);
    card.setConfig({ type: "custom:austria-map-card", layers: ["cities"], title: "Karte" });
    expect([...card._layers]).toEqual(["cities"]);
  });

  it("draws no names when they are switched off", async () => {
    fake.reset();
    await mount({ show_labels: false });
    expect(fake.texts()).toEqual([]);
  });

  it("follows the user's language", async () => {
    const card = await mount();
    expect(text(card, ".info-idle")).toBe("Tippe auf die Karte, um zu sehen, was dort ist.");
    card.hass = hassEn;
    await settle(card);
    expect(text(card, ".info-idle")).toBe("Tap the map to see what is there.");
    expect($(card, "canvas")?.getAttribute("aria-label")).toBe("Map of Austria");
  });

  it("keeps its view when the card is resized", async () => {
    const card = await mount();
    for (let step = 0; step < 3; step += 1) tool(card, "Hineinzoomen").click();
    await settle(card);
    const before = card._camera!;
    for (const callback of resizeCallbacks) callback([{ contentRect: { width: 380, height: 201 } }]);
    await settle(card);
    expect(card._camera!.x).toBeCloseTo(before.x);
    expect(zoomOf(card._camera!, { width: 380, height: 201 })).toBeCloseTo(zoomOf(before, size));
  });
});
