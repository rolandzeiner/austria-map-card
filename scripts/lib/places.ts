/**
 * Towns and villages for the map: which of the BEV's 58 000 settlement
 * names to keep, and in what order of importance.
 *
 * Pure functions on plain arrays; `build-data.mjs` reads the GeoPackage.
 */

/** The BEV's settlement classes that the map keeps, by their F_CODE. */
export const PLACE_KINDS = { 7101: 0, 7102: 1, 7103: 2 } as const;
export type PlaceKind = 0 | 1 | 2;

/**
 * The lowest number of residents the BEV's size class stands for.
 *
 * The class is a range and it is old: Klagenfurt, past 100 000 since 2016,
 * is still filed under 25 000 to 100 000. It ranks a place only where
 * nothing better is known.
 */
export function classFloor(einwohnerKlasse: string): number {
  if (einwohnerKlasse.startsWith(">")) return 100_000;
  const match = /^([\d.]+)-/.exec(einwohnerKlasse);
  if (match !== null) return Number((match[1] as string).replaceAll(".", ""));
  return 0;
}

/**
 * A name reduced to what two spellings of the same place have in common.
 *
 * The BEV writes "Sankt Pölten" where the municipality register writes
 * "St. Pölten", and the two differ in hyphens and spaces elsewhere.
 */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bsankt\b/g, "st")
    .replace(/\bst\./g, "st")
    .replace(/[^a-z0-9äöüß]/g, "");
}

export interface RawPlace {
  readonly name: string;
  readonly kind: PlaceKind;
  /** The BEV's EINWOHNER_KLASSE, as written. */
  readonly sizeClass: string;
  readonly x: number;
  readonly y: number;
}

export interface RankedPlace extends RawPlace {
  /** Row of the municipality the point lies in. */
  readonly municipality: number;
  /** True when the place gives its municipality its name. */
  readonly seat: boolean;
  /** Residents the place is ranked by: see `rankPlaces`. */
  readonly rank: number;
}

/**
 * Rank places by size.
 *
 * A place that carries its municipality's name is that municipality's main
 * town, and takes the municipality's population from Statistik Austria: an
 * official, current figure. Any other place is a part of a municipality and
 * is ranked by the floor of its BEV size class, but always below the place
 * the municipality is named after, since a part cannot outrank the whole.
 *
 * Returns the places largest first; ties go to the higher class (a Stadt
 * before a Markt before a Dorf), then to the name, so the order is the same
 * on every run.
 */
export function rankPlaces(
  places: ReadonlyArray<RawPlace & { readonly municipality: number }>,
  municipalityNames: readonly string[],
  population: ArrayLike<number>,
): RankedPlace[] {
  // If two places in a municipality share its name (a Dorf and the Markt it
  // grew into), the higher class is the seat.
  const seats = new Map<number, number>();
  places.forEach((place, index) => {
    if (nameKey(place.name) !== nameKey(municipalityNames[place.municipality] as string)) return;
    const current = seats.get(place.municipality);
    if (current === undefined || place.kind < (places[current] as RawPlace).kind) {
      seats.set(place.municipality, index);
    }
  });
  const ranked = places.map((place, index) => {
    const residents = population[place.municipality] as number;
    const seat = seats.get(place.municipality) === index;
    const rank = seat
      ? residents
      : Math.min(classFloor(place.sizeClass), Math.floor(residents / 2));
    return { ...place, seat, rank };
  });
  // By code unit, not by locale: the order must not depend on the ICU data
  // of the Node that runs the build.
  const byName = (p: string, q: string): number => (p < q ? -1 : p > q ? 1 : 0);
  return ranked.sort(
    (p, q) =>
      q.rank - p.rank || p.kind - q.kind || byName(p.name, q.name) || p.x - q.x || p.y - q.y,
  );
}
