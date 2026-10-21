/**
 * @vitest-environment happy-dom
 *
 * What the card says when its data does not arrive. In a file of its own:
 * the page has one loader, and a chunk that was refused stays refused, so
 * these tests must not share a loader with the ones that expect a map.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";

import { DATA_FORMAT } from "../src/data/format.ts";
import { chunk } from "./chunks.ts";
import {
  $,
  all,
  mount,
  pageLoader,
  served,
  settle,
  setUp,
  tearDown,
  text,
  tool,
  zoomIn,
} from "./card-harness.ts";

beforeAll(setUp);
afterEach(tearDown);

describe("when the data does not arrive", () => {
  it("says so and offers to try again, and recovers", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let online = false;
    served["terrain-detail"] = () =>
      online
        ? Promise.resolve({ default: chunk("terrain-detail") })
        : Promise.reject(new TypeError("Failed to fetch"));
    const card = await mount({ layers: ["terrain"] });
    await zoomIn(card, 5);
    expect(text(card, ".notice")).toBe(
      "Die Kartendaten wurden nicht geladen. Prüfe deine Verbindung. Erneut versuchen",
    );
    expect($(card, ".notice")?.getAttribute("role")).toBe("alert");
    online = true;
    $<HTMLButtonElement>(card, ".notice button")?.click();
    await settle(card);
    expect($(card, ".notice")).toBeNull();
    expect(pageLoader().state("terrain-detail")).toBe("ready");
    warn.mockRestore();
  });

  it("asks for a reload when a chunk is from another version of the card", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    served.gemeinden = () =>
      Promise.resolve({ default: { ...chunk("gemeinden"), format: DATA_FORMAT + 7 } });
    const card = await mount({ layers: ["municipalities"] });
    await zoomIn(card, 6);
    expect(pageLoader().state("gemeinden")).toBe("outdated");
    expect(text(card, ".notice")).toBe(
      "Die Karte wurde aktualisiert. Lade die Seite neu, um sie anzuzeigen. Seite neu laden",
    );
    tool(card, "Ebenen").click();
    await settle(card);
    const row = all(card, ".layer").find((entry) => entry.textContent?.includes("Gemeinden"))!;
    expect(row.querySelector(".layer-note")?.textContent).toBe("Nicht geladen");
    warn.mockRestore();
  });
});
