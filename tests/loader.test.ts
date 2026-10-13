/** Loading the data chunks: once each, with a way back from every failure. */
import { describe, expect, it, vi } from "vitest";

import { DATA_FORMAT, type ChunkId } from "../src/data/format.ts";
import { ChunkLoader, type Importer } from "../src/layers/loader.ts";
import { MapStore } from "../src/layers/store.ts";
import { chunk } from "./chunks.ts";

const BASE = "https://ha.example/hacsfiles/austria-map-card/austria-map-card.js?hacstag=123";

/** An importer that serves the real chunks and remembers what it was asked for. */
function serving(overrides: Partial<Record<ChunkId, () => Promise<unknown>>> = {}) {
  const urls: string[] = [];
  const importer: Importer = (url) => {
    urls.push(url);
    const id = /austria-map-data-([a-z-]+)\.js/.exec(url)?.[1] as ChunkId;
    return overrides[id]?.() ?? Promise.resolve({ default: chunk(id) });
  };
  return { urls, importer };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function loaderWith(importer: Importer): ChunkLoader {
  return new ChunkLoader(new MapStore(), { base: BASE, version: "1.2.3", importer });
}

describe("where the chunks come from", () => {
  it("is beside the card, whatever HACS appended to the card's own address", () => {
    const loader = loaderWith(serving().importer);
    expect(loader.url("base")).toBe("https://ha.example/hacsfiles/austria-map-card/austria-map-data-base.js?v=1.2.3");
    expect(loader.url("terrain-detail")).toBe(
      "https://ha.example/hacsfiles/austria-map-card/austria-map-data-terrain-detail.js?v=1.2.3",
    );
  });

  it("carries the card version, so a new card never reads an old chunk from the cache", () => {
    const next = new ChunkLoader(new MapStore(), { base: BASE, version: "1.3.0", importer: serving().importer });
    expect(next.url("base")).toContain("?v=1.3.0");
  });
});

describe("loading", () => {
  it("imports a chunk, unpacks it into the store and says so", async () => {
    const { importer, urls } = serving();
    const loader = loaderWith(importer);
    const changed = vi.fn();
    loader.subscribe(changed);
    expect(loader.state("base")).toBe("idle");
    loader.request(["base"]);
    expect(loader.state("base")).toBe("loading");
    expect(loader.loading).toBe(true);
    await settle();
    expect(loader.state("base")).toBe("ready");
    expect(loader.store.overview?.provinces.count).toBe(9);
    expect(urls).toHaveLength(1);
    // Once for "loading", once for "ready".
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("asks for each chunk once, however often it is requested", async () => {
    const { importer, urls } = serving();
    const loader = loaderWith(importer);
    loader.request(["base", "places"]);
    loader.request(["base"]);
    await settle();
    loader.request(["base", "places", "borders"]);
    await settle();
    expect(urls.map((url) => /data-([a-z-]+)\.js/.exec(url)?.[1])).toEqual(["base", "places", "borders"]);
    expect(loader.loading).toBe(false);
  });

  it("stops telling a listener that unsubscribed", async () => {
    const loader = loaderWith(serving().importer);
    const changed = vi.fn();
    const unsubscribe = loader.subscribe(changed);
    unsubscribe();
    loader.request(["base"]);
    await settle();
    expect(changed).not.toHaveBeenCalled();
  });
});

describe("a chunk in another format", () => {
  it("is refused, not drawn: the browser holds files of two versions", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { importer } = serving({
      borders: () => Promise.resolve({ default: { ...chunk("borders"), format: DATA_FORMAT + 1 } }),
    });
    const loader = loaderWith(importer);
    loader.request(["base", "borders"]);
    await settle();
    expect(loader.state("borders")).toBe("outdated");
    expect(loader.outdated).toBe(true);
    expect(loader.store.detail).toBeUndefined();
    expect(loader.state("base")).toBe("ready");
    warn.mockRestore();
  });

  it("is also what a module without the expected export counts as", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { importer } = serving({
      places: () => Promise.resolve({}),
      gemeinden: () => Promise.resolve({ default: chunk("borders") }),
    });
    const loader = loaderWith(importer);
    loader.request(["places", "gemeinden"]);
    await settle();
    expect(loader.state("places")).toBe("outdated");
    expect(loader.state("gemeinden")).toBe("outdated");
    warn.mockRestore();
  });

  it("is not retried: only a reload brings matching files", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { importer, urls } = serving({ base: () => Promise.resolve({ default: { format: 0, id: "base" } }) });
    const loader = loaderWith(importer);
    loader.request(["base"]);
    await settle();
    loader.retry();
    loader.request(["base"]);
    await settle();
    expect(urls).toHaveLength(1);
    expect(loader.failed).toEqual([]);
    warn.mockRestore();
  });
});

describe("a chunk that does not load", () => {
  it("is marked failed and can be asked for again, at a new address", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let online = false;
    const { importer, urls } = serving({
      base: () => (online ? Promise.resolve({ default: chunk("base") }) : Promise.reject(new TypeError("Failed to fetch"))),
    });
    const loader = loaderWith(importer);
    loader.request(["base"]);
    await settle();
    expect(loader.state("base")).toBe("failed");
    expect(loader.failed).toEqual(["base"]);

    // Asking again without retry() does nothing: no request storm while offline.
    loader.request(["base"]);
    await settle();
    expect(urls).toHaveLength(1);

    online = true;
    loader.retry();
    await settle();
    expect(loader.state("base")).toBe("ready");
    expect(loader.failed).toEqual([]);
    // A browser may remember a failed import for the life of the page.
    expect(urls[1]).toBe(`${urls[0]}&retry=1`);
    warn.mockRestore();
  });

  it("leaves the chunks that did load alone", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { importer, urls } = serving({ places: () => Promise.reject(new Error("404")) });
    const loader = loaderWith(importer);
    loader.request(["base", "places"]);
    await settle();
    loader.retry();
    await settle();
    expect(urls.filter((url) => url.includes("data-base"))).toHaveLength(1);
    expect(urls.filter((url) => url.includes("data-places"))).toHaveLength(2);
    warn.mockRestore();
  });
});

describe("the real files", () => {
  it("import as ES modules through the loader's own import()", async () => {
    const loader = new ChunkLoader(new MapStore(), {
      base: new URL("../dist/austria-map-card.js", import.meta.url).href,
      version: "test",
    });
    loader.request(["base", "places"]);
    for (let wait = 0; wait < 200 && loader.loading; wait += 1) await new Promise((resolve) => setTimeout(resolve, 10));
    expect(loader.state("base")).toBe("ready");
    expect(loader.state("places")).toBe("ready");
    expect(loader.store.places?.names[0]).toBe("Wien");
  });
});
