/**
 * What the card's test files share: the stubs happy-dom needs, a page-wide
 * loader that serves the real chunks, and helpers to mount and poke a card.
 *
 * happy-dom does not paint or lay out, so the canvas gets the recording
 * context from fake-canvas.ts, the resize observer is fired by hand, and the
 * theme colours come from a stubbed getComputedStyle.
 *
 * The card reads its data through one loader per page. Vitest gives every
 * test file its own copy of every module, so each file that calls `setUp`
 * gets a loader of its own: what one file breaks, the next does not see.
 */
import { vi } from "vite-plus/test";

import type { ChunkId } from "../src/data/format.ts";
import { sharedLoader, type ChunkLoader } from "../src/layers/loader.ts";
import { toScreen, type Camera } from "../src/map/camera.ts";
import type { Feature } from "../src/map/labels.ts";
import type { LayerId } from "../src/types.ts";
import { chunk } from "./chunks.ts";
import { FakePath, fakeContext, type FakeContext } from "./fake-canvas.ts";

type ResizeCallback = (entries: Array<{ contentRect: { width: number; height: number } }>) => void;
export const resizeCallbacks: ResizeCallback[] = [];
class StubResizeObserver {
  public constructor(callback: ResizeCallback) {
    resizeCallbacks.push(callback);
  }
  public observe(): void {}
  public disconnect(): void {}
}

/** The card's private surface the tests reach into. */
export interface CardInternals extends HTMLElement {
  hass: unknown;
  setConfig(config: unknown): void;
  getCardSize(): number;
  getGridOptions(): Record<string, number>;
  updateComplete: Promise<boolean>;
  _camera: Camera | null;
  _layers: ReadonlySet<LayerId>;
  _selection: Feature | null;
  _layersOpen: boolean;
  _drawNow(): void;
}

export const size = { width: 760, height: 403 };
export const hassDe = { locale: { language: "de" }, themes: { darkMode: false, theme: "default" } };
export const hassEn = { locale: { language: "en" }, themes: { darkMode: false, theme: "default" } };

/** What the page's loader serves instead of the real chunk; a test sets entries to break things. */
export const served: Partial<Record<ChunkId, () => Promise<unknown>>> = {};
/** Every address the loader asked for, in order. */
export const requested: string[] = [];
export const fake: FakeContext = fakeContext();

let loader: ChunkLoader | undefined;
export const pageLoader = (): ChunkLoader => loader as ChunkLoader;

/** Call once per test file, in beforeAll. */
export async function setUp(): Promise<void> {
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  vi.stubGlobal("Path2D", FakePath);
  vi.stubGlobal("getComputedStyle", () => ({ color: "rgb(40, 40, 40)", fontFamily: "sans-serif" }));
  HTMLCanvasElement.prototype.getContext = (() =>
    fake.ctx) as unknown as HTMLCanvasElement["getContext"];
  // The first caller makes the page's loader; the card then finds this one.
  loader = sharedLoader({
    base: "https://ha.example/hacsfiles/austria-map-card/austria-map-card.js",
    version: "test",
    importer: (url) => {
      requested.push(url);
      const id = /austria-map-data-([a-z-]+)\.js/.exec(url)?.[1] as ChunkId;
      return served[id]?.() ?? Promise.resolve({ default: chunk(id) });
    },
  });
  await import("../src/austria-map-card.ts");
}

/** Call in afterEach. */
export function tearDown(): void {
  document.body.innerHTML = "";
  resizeCallbacks.length = 0;
  for (const key of Object.keys(served)) delete served[key as ChunkId];
}

/** The chunk ids asked for so far. */
export const requestedIds = (from = 0): string[] =>
  requested.slice(from).map((url) => /data-([a-z-]+)\.js/.exec(url)?.[1] ?? "");

export const settle = async (card?: CardInternals): Promise<void> => {
  for (let round = 0; round < 4; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await card?.updateComplete;
  }
};

export async function mount(
  config: Record<string, unknown> = {},
  hass: unknown = hassDe,
): Promise<CardInternals> {
  const card = document.createElement("austria-map-card") as unknown as CardInternals;
  card.setConfig({ type: "custom:austria-map-card", ...config });
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  for (const callback of resizeCallbacks) callback([{ contentRect: size }]);
  await settle(card);
  card._drawNow();
  await settle(card);
  return card;
}

export const $ = <T extends Element = HTMLElement>(
  card: CardInternals,
  selector: string,
): T | null => card.shadowRoot?.querySelector<T>(selector) ?? null;
export const all = (card: CardInternals, selector: string): HTMLElement[] => [
  ...(card.shadowRoot?.querySelectorAll<HTMLElement>(selector) ?? []),
];
export const text = (card: CardInternals, selector: string): string =>
  ($(card, selector)?.textContent ?? "").replace(/\s+/g, " ").trim();
/** A button by its accessible name. */
export const tool = (card: CardInternals, label: string): HTMLButtonElement =>
  all(card, "button").find(
    (button) => button.getAttribute("aria-label") === label,
  ) as HTMLButtonElement;

export const pointer = (card: CardInternals, type: string, x: number, y: number, id = 1): void => {
  $(card, "canvas")?.dispatchEvent(
    new PointerEvent(type, {
      pointerId: id,
      clientX: x,
      clientY: y,
      bubbles: true,
      composed: true,
    }),
  );
};
export const tap = async (card: CardInternals, x: number, y: number): Promise<void> => {
  pointer(card, "pointerdown", x, y);
  pointer(card, "pointerup", x, y);
  await settle(card);
};
export const key = async (
  card: CardInternals,
  name: string,
  init: KeyboardEventInit = {},
): Promise<KeyboardEvent> => {
  const event = new KeyboardEvent("keydown", {
    key: name,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  $(card, "canvas")?.dispatchEvent(event);
  await settle(card);
  return event;
};

/** Press the zoom-in button a number of times and let the card catch up. */
export async function zoomIn(card: CardInternals, steps: number): Promise<void> {
  for (let step = 0; step < steps; step += 1) tool(card, "Hineinzoomen").click();
  await settle(card);
  card._drawNow();
  await settle(card);
}

/** Where a place is on the card's canvas right now. */
export function placeAt(card: CardInternals, name: string): [number, number] {
  const places = pageLoader().store.places!;
  const row = places.names.indexOf(name);
  return toScreen(card._camera!, size, places.at[row * 2]!, places.at[row * 2 + 1]!);
}
