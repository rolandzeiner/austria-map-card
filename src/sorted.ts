/**
 * A sorted copy of `items`; the input is never touched. Stands in for
 * `Array#toSorted()`, which is ES2023: the card is built for ES2022, and
 * tsconfig holds everything it checks (tests and build libraries too) to
 * that.
 */
export function sorted<T>(items: Iterable<T>, compare?: (a: T, b: T) => number): T[] {
  const out = [...items];
  out.sort(compare);
  return out;
}
