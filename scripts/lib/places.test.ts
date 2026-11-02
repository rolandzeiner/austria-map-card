import { describe, expect, it } from "vite-plus/test";

import {
  classFloor,
  NameIndex,
  nameKey,
  namedLike,
  nearCode,
  nearestSeat,
  rankPlaces,
  shorterNames,
  spellings,
} from "./places.ts";

describe("place names", () => {
  it("matches the BEV's spelling to the municipality register's", () => {
    expect(nameKey("Sankt Pölten")).toBe(nameKey("St. Pölten"));
    expect(nameKey("Klagenfurt am Wörthersee")).toBe("klagenfurtamwörthersee");
    expect(nameKey("Groß-Siegharts")).toBe(nameKey("Groß Siegharts"));
    expect(nameKey("Sankt Johann im Pongau")).toBe(nameKey("St. Johann im Pongau"));
    // The RTR writes an umlaut as a letter and a combining mark now and then.
    expect(nameKey("Fu\u0308rstenfeld")).toBe("fürstenfeld");
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
  const place = (
    name: string,
    kind: 0 | 1 | 2,
    sizeClass: string,
    municipality: number,
    x = 0,
  ) => ({
    name,
    kind,
    sizeClass,
    municipality,
    x,
    y: 0,
  });

  it("ranks a municipality's namesake by the official population, not by the BEV's stale class", () => {
    const ranked = rankPlaces(
      [
        place("Baden", 0, "25.000-100.000", 1),
        place("Klagenfurt am Wörthersee", 0, "25.000-100.000", 0),
      ],
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
      [
        place("Viktring", 2, "5.000-25.000", 0),
        place("Klagenfurt am Wörthersee", 0, "25.000-100.000", 0),
        place("Gurnitz", 2, "< 2.000", 2),
      ],
      municipalities,
      population,
    );
    expect(ranked.map((entry) => entry.name)).toEqual([
      "Klagenfurt am Wörthersee",
      "Viktring",
      "Gurnitz",
    ]);
    expect(ranked[1]).toMatchObject({ seat: false, rank: 5_000 });
    expect(ranked[2]).toMatchObject({ seat: false, rank: 0 });
  });

  it("caps a part at half its municipality, however large its class", () => {
    const [part] = rankPlaces(
      [place("Reichenau", 2, "5.000-25.000", 2)],
      municipalities,
      population,
    );
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
    const list = [
      place("B", 2, "< 2.000", 2, 5),
      place("A", 2, "< 2.000", 2, 9),
      place("A", 2, "< 2.000", 2, 3),
    ];
    const once = rankPlaces(list, municipalities, population).map(
      (entry) => `${entry.name}${entry.x}`,
    );
    const again = rankPlaces([...list].reverse(), municipalities, population).map(
      (entry) => `${entry.name}${entry.x}`,
    );
    expect(once).toEqual(["A3", "A9", "B5"]);
    expect(again).toEqual(once);
  });
});

describe("names written elsewhere", () => {
  it("spells the RTR's abbreviations out, the name as written first", () => {
    expect(spellings("Hainburg a.d. Donau")).toEqual([
      "Hainburg a.d. Donau",
      "Hainburg an der Donau",
    ]);
    expect(spellings("Hall i.Tirol")).toEqual(["Hall i.Tirol", "Hall in Tirol", "Hall im Tirol"]);
    expect(spellings("Stankt Oswald bei Plankenwarth")).toEqual(["Sankt Oswald bei Plankenwarth"]);
    expect(spellings("Sankt Oswald im Freiland.")).toEqual(["Sankt Oswald im Freiland"]);
    expect(spellings("Sankt Leonhard a.Forst")).toEqual([
      "Sankt Leonhard a.Forst",
      "Sankt Leonhard am Forst",
    ]);
    expect(spellings("Preßbaum")).toEqual(["Preßbaum", "Pressbaum"]);
  });

  it("shortens a name at its preposition and splits a double name", () => {
    expect(shorterNames("Krumpendorf am Wörther See")).toEqual(["Krumpendorf"]);
    expect(shorterNames("Kötschach-Mauthen")).toEqual(["Kötschach", "Mauthen"]);
    expect(shorterNames("Sankt Andrä-Wördern")).toEqual(["Sankt Andrä", "Wördern"]);
    expect(shorterNames("Semmering")).toEqual([]);
  });

  it("finds a place by its name, by what starts with it, by a shorter name, by what contains it", () => {
    const index = new NameIndex(
      [
        "Aflenz Kurort",
        "Krumpendorf",
        "Hall in Tirol",
        "Hallein",
        "Warth",
        "Warth",
        "Neustadtl-Markt",
        "Alt-Nagelberg",
        "Bad Dürrnberg",
        "Dürrnberg",
        "Fusch",
        "Fusch an der Großglocknerstraße",
      ].map((name) => ({ name, key: nameKey(name) })),
    );
    const found = (name: string, allowed?: (entry: { name: string }) => boolean): string[] =>
      namedLike(name, index, allowed).map((entry) => entry.name);
    expect(found("Hall i.Tirol")).toEqual(["Hall in Tirol"]);
    expect(found("Aflenz")).toEqual(["Aflenz Kurort"]);
    expect(found("Krumpendorf am Wörther See")).toEqual(["Krumpendorf"]);
    expect(found("Neustadtl an der Donau")).toEqual(["Neustadtl-Markt"]);
    expect(found("Nagelberg")).toEqual(["Alt-Nagelberg"]);
    expect(found("Heilbad Dürrnberg")).toEqual(["Bad Dürrnberg"]);
    expect(found("Fusch an der Glocknerstraße")).toEqual([
      "Fusch",
      "Fusch an der Großglocknerstraße",
    ]);
    expect(found("Warth")).toEqual(["Warth", "Warth"]);
    expect(found("Warth", (entry) => entry.name !== "Warth")).toEqual([]);
    expect(found("Nowhere")).toEqual([]);
    // A short name is not a prefix: "Hall" would find Hallein.
    expect(found("Hall")).toEqual([]);
  });
});

describe("area code seats", () => {
  const warthNoe = { name: "Warth", x: 530, y: 290, weight: 1 };
  const warthVbg = { name: "Warth", x: 20, y: 250, weight: 2 };
  const placed = [
    { code: "2627", x: 540, y: 280 },
    { code: "2630", x: 520, y: 300 },
    { code: "5582", x: 30, y: 240 },
  ].map((seat) => ({ ...seat, weight: 1 }));

  it("places a name shared by two Ortsnetze by the neighbouring codes", () => {
    expect(nearCode("2629", [warthNoe, warthVbg], placed)).toBe(warthNoe);
    expect(nearCode("5583", [warthNoe, warthVbg], placed)).toBe(warthVbg);
  });

  it("takes the town of a name before a farm of it, however the neighbours lie", () => {
    const town = { name: "Amstetten", x: 100, y: 100, weight: 5000 };
    const farm = { name: "Amstetten", x: 104, y: 100, weight: -1 };
    const near = [{ code: "7475", x: 106, y: 100, weight: 0 }];
    expect(nearCode("7472", [town, farm], near)).toBe(town);
    expect(nearCode("7472", [farm, town], near)).toBe(town);
  });

  it("falls back on the largest candidate when no neighbour is placed", () => {
    expect(nearCode("7777", [warthNoe, warthVbg], placed)).toBe(warthVbg);
    expect(nearCode("7777", [warthNoe], [])).toBe(warthNoe);
  });

  it("gives a city's code the reach to take in the suburbs", () => {
    const wien = { code: "1", x: 0, y: 0, reach: 3 };
    const fischamend = { code: "2232", x: 20, y: 0, reach: 1 };
    // Schwechat: 12 from Vienna's centre, 8 from Fischamend, and on 01.
    expect(nearestSeat(12, 0, [wien, fischamend])).toBe(wien);
    expect(nearestSeat(17, 0, [wien, fischamend])).toBe(fischamend);
    expect(nearestSeat(0, 0, [])).toBeUndefined();
  });
});
