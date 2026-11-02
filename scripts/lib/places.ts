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
    .normalize("NFC")
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
  ranked.sort(
    (p, q) =>
      q.rank - p.rank || p.kind - q.kind || byName(p.name, q.name) || p.x - q.x || p.y - q.y,
  );
  return ranked;
}

// ---------------------------------------------------------------------------
// Finding a place by a name written elsewhere: the RTR's postal places and
// Ortsnetze (area codes), the plate codes' districts.
// ---------------------------------------------------------------------------

/**
 * The spellings a name may have in the BEV's list, as written first. The
 * RTR abbreviates ("Hainburg a.d. Donau", "Hall i.Tirol", "Sankt Leonhard
 * a.Forst"), ends a name in a full stop now and then, has a "Stankt" or
 * two, and keeps an ß the BEV writes ss ("Preßbaum").
 */
export function spellings(name: string): string[] {
  const base = name
    .trim()
    .replace(/\.$/, "")
    .replace(/\bStankt\b/g, "Sankt");
  const out = [base];
  const expanded = base.replace(/\ba\.\s?d\.\s?/g, "an der ").replace(/\ba\.\s?/g, "am ");
  if (expanded !== base) out.push(expanded);
  for (const word of ["in", "im"]) {
    const spelt = expanded.replace(/\bi\.\s?/g, `${word} `);
    if (spelt !== expanded) out.push(spelt);
  }
  const withSs = out
    .filter((spelling) => spelling.includes("ß"))
    .map((spelling) => spelling.replaceAll("ß", "ss"));
  return [...out, ...withSs];
}

/**
 * Shorter names a long one may go by, the most of it kept first: what
 * stands before a preposition ("Krumpendorf am Wörther See" is the BEV's
 * "Krumpendorf"), then each half of a double name ("Kötschach-Mauthen").
 */
export function shorterNames(name: string): string[] {
  const out: string[] = [];
  const head = /^(.+?)\s+(am|an|auf|bei|im|in|ob|vor|unter)\b/.exec(name);
  if (head !== null) out.push(head[1] as string);
  if (name.includes("-")) {
    for (const part of name.split("-")) {
      const trimmed = part.trim();
      if (trimmed.length >= 3 && !out.includes(trimmed)) out.push(trimmed);
    }
  }
  return out;
}

export interface Named {
  readonly key: string;
}

/** A list of places by `nameKey`, for the searches `namedLike` makes. */
export class NameIndex<T extends Named> {
  private readonly byKey = new Map<string, T[]>();
  private readonly keys: string[];

  constructor(entries: Iterable<T>) {
    for (const entry of entries) {
      const found = this.byKey.get(entry.key);
      if (found === undefined) this.byKey.set(entry.key, [entry]);
      else found.push(entry);
    }
    this.keys = [...this.byKey.keys()];
  }

  public exact(key: string): T[] {
    return this.byKey.get(key) ?? [];
  }

  private matching(test: (known: string) => boolean): T[] {
    return this.keys.filter(test).flatMap((known) => this.byKey.get(known) as T[]);
  }

  public startingWith(key: string): T[] {
    return this.matching((known) => known.startsWith(key));
  }

  public containing(key: string): T[] {
    return this.matching((known) => known.includes(key));
  }

  /** Entries whose key the given one contains, the longest such key only. */
  public within(key: string): T[] {
    let longest = 0;
    for (const known of this.keys) {
      if (known.length > longest && known.length >= PART && key.includes(known)) {
        longest = known.length;
      }
    }
    return longest === 0
      ? []
      : this.matching((known) => known.length === longest && key.includes(known));
  }
}

/** The shortest key a part of a name may be: "Hall" is not Hallein, "Au" not anything. */
const PART = 5;

/**
 * The places a name may mean, from the first search that finds any: the
 * name's spellings as they are, then what starts with the name ("Aflenz"
 * for the BEV's "Aflenz Kurort"), then its shorter names together with what
 * starts with those ("Neustadtl an der Donau" for "Neustadtl-Markt"), then
 * what contains the name ("Nagelberg" for "Alt-Nagelberg"), then what the
 * name contains ("Heilbad Dürrnberg" for "Bad Dürrnberg"). `allowed` limits
 * every search to, say, one district.
 */
export function namedLike<T extends Named>(
  name: string,
  index: NameIndex<T>,
  allowed: (entry: T) => boolean = () => true,
): T[] {
  const tried = new Set<string>();
  const search = (
    spelling: string,
    how: "exact" | "startingWith" | "containing" | "within",
  ): T[] => {
    const key = nameKey(spelling);
    if (key === "" || tried.has(`${how}:${key}`)) return [];
    tried.add(`${how}:${key}`);
    if (how !== "exact" && key.length < PART) return [];
    return index[how](key).filter(allowed);
  };
  const spelt = spellings(name);
  for (const how of ["exact", "startingWith"] as const) {
    for (const spelling of spelt) {
      const found = search(spelling, how);
      if (found.length > 0) return found;
    }
  }
  // A shorter name is less certain, so what starts with it counts beside
  // what is it: the "Fusch" of "Fusch an der Glocknerstraße" may be a hamlet
  // elsewhere, and the caller settles which.
  const byShorter = new Set(
    spelt
      .flatMap(shorterNames)
      .flatMap((shorter) => [...search(shorter, "exact"), ...search(shorter, "startingWith")]),
  );
  if (byShorter.size > 0) return [...byShorter];
  for (const how of ["containing", "within"] as const) {
    for (const spelling of spelt) {
      const found = search(spelling, how);
      if (found.length > 0) return found;
    }
  }
  return [];
}

export interface Seat {
  readonly x: number;
  readonly y: number;
  /** Residents, or whatever says which of two candidates is the likelier. */
  readonly weight: number;
}

const heaviest = <T extends Seat>(candidates: readonly T[]): T =>
  candidates.reduce((best, candidate) => (candidate.weight > best.weight ? candidate : best));

/**
 * How far off the mark a candidate may be and still be meant: a city
 * before a village of its name, a village before a single farm.
 */
const likelihood = (weight: number): number => (weight < 0 ? 0.5 : 1 + Math.log10(1 + weight));

/**
 * Which of several places of one name an Ortsnetz means. The area codes are
 * numbered by region: 02629 lies among the 026xx around Neunkirchen, 05583
 * among the 055xx in the Bregenzerwald, so the Warth each means is the one
 * nearest the seats already placed under the longest shared prefix, each
 * candidate's distance divided by its `likelihood`. With no neighbour
 * placed yet, the largest candidate.
 */
export function nearCode<T extends Seat>(
  code: string,
  candidates: readonly T[],
  placed: ReadonlyArray<Seat & { readonly code: string }>,
): T {
  if (candidates.length === 1) return candidates[0] as T;
  for (let length = code.length - 1; length >= 1; length -= 1) {
    const prefix = code.slice(0, length);
    const near = placed.filter((seat) => seat.code !== code && seat.code.startsWith(prefix));
    if (near.length === 0) continue;
    const cx = near.reduce((sum, seat) => sum + seat.x, 0) / near.length;
    const cy = near.reduce((sum, seat) => sum + seat.y, 0) / near.length;
    let best = candidates[0] as T;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      const distance =
        Math.hypot(candidate.x - cx, candidate.y - cy) / likelihood(candidate.weight);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    return best;
  }
  return heaviest(candidates);
}

/**
 * The seat nearest a point, each seat's distance divided by its reach: a
 * city's Ortsnetz takes in the municipalities around it, a village's ends
 * at the next village.
 */
export function nearestSeat<
  T extends { readonly x: number; readonly y: number; readonly reach: number },
>(x: number, y: number, seats: readonly T[]): T | undefined {
  let best: T | undefined;
  let bestDistance = Infinity;
  for (const seat of seats) {
    const distance = Math.hypot(seat.x - x, seat.y - y) / seat.reach;
    if (distance < bestDistance) {
      best = seat;
      bestDistance = distance;
    }
  }
  return best;
}
