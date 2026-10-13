import { describe, expect, it } from "vitest";

import { classFloor, nameKey, rankPlaces } from "./places.ts";

describe("place names", () => {
  it("matches the BEV's spelling to the municipality register's", () => {
    expect(nameKey("Sankt Pölten")).toBe(nameKey("St. Pölten"));
    expect(nameKey("Klagenfurt am Wörthersee")).toBe("klagenfurtamwörthersee");
    expect(nameKey("Groß-Siegharts")).toBe(nameKey("Groß Siegharts"));
    expect(nameKey("Sankt Johann im Pongau")).toBe(nameKey("St. Johann im Pongau"));
  });

  it("keeps different places apart", () => {
    expect(nameKey("Gmünd")).not.toBe(nameKey("Gmunden"));
    expect(nameKey("Stankt")).not.toBe(nameKey("St."));
  });
});

describe("the BEV's size classes", () => {
  it.each([
    ["> 100.000", 100_000],
    ["25.000-100.000", 25_000],
    ["5.000-25.000", 5_000],
    ["2.000-5.000", 2_000],
    ["< 2.000", 0],
    ["Keine Erfassung", 0],
  ])("%s starts at %i", (label, floor) => {
    expect(classFloor(label)).toBe(floor);
  });
});

describe("ranking", () => {
  const municipalities = ["Klagenfurt am Wörthersee", "Baden", "Ebenthal"];
  const population = [104_000, 26_000, 8_000];
  const place = (name: string, kind: 0 | 1 | 2, sizeClass: string, municipality: number, x = 0) => ({
    name,
    kind,
    sizeClass,
    municipality,
    x,
    y: 0,
  });

  it("ranks a municipality's namesake by the official population, not by the BEV's stale class", () => {
    const ranked = rankPlaces(
      [place("Baden", 0, "25.000-100.000", 1), place("Klagenfurt am Wörthersee", 0, "25.000-100.000", 0)],
      municipalities,
      population,
    );
    expect(ranked.map((entry) => [entry.name, entry.rank, entry.seat])).toEqual([
      ["Klagenfurt am Wörthersee", 104_000, true],
      ["Baden", 26_000, true],
    ]);
  });

  it("keeps a part of a municipality below the place the municipality is named after", () => {
    const ranked = rankPlaces(
      [place("Viktring", 2, "5.000-25.000", 0), place("Klagenfurt am Wörthersee", 0, "25.000-100.000", 0), place("Gurnitz", 2, "< 2.000", 2)],
      municipalities,
      population,
    );
    expect(ranked.map((entry) => entry.name)).toEqual(["Klagenfurt am Wörthersee", "Viktring", "Gurnitz"]);
    expect(ranked[1]).toMatchObject({ seat: false, rank: 5_000 });
    expect(ranked[2]).toMatchObject({ seat: false, rank: 0 });
  });

  it("caps a part at half its municipality, however large its class", () => {
    const [part] = rankPlaces([place("Reichenau", 2, "5.000-25.000", 2)], municipalities, population);
    expect(part).toMatchObject({ rank: 4_000, seat: false });
  });

  it("names one seat when two places share the municipality's name", () => {
    const ranked = rankPlaces(
      [place("Ebenthal", 2, "< 2.000", 2, 1), place("Ebenthal", 1, "2.000-5.000", 2, 2)],
      municipalities,
      population,
    );
    expect(ranked.filter((entry) => entry.seat)).toHaveLength(1);
    expect(ranked[0]).toMatchObject({ kind: 1, seat: true, rank: 8_000 });
  });

  it("orders equals the same way on every run", () => {
    const list = [place("B", 2, "< 2.000", 2, 5), place("A", 2, "< 2.000", 2, 9), place("A", 2, "< 2.000", 2, 3)];
    const once = rankPlaces(list, municipalities, population).map((entry) => `${entry.name}${entry.x}`);
    const again = rankPlaces([...list].reverse(), municipalities, population).map((entry) => `${entry.name}${entry.x}`);
    expect(once).toEqual(["A3", "A9", "B5"]);
    expect(again).toEqual(once);
  });
});
