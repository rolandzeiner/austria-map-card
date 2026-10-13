/**
 * The scales at which the map changes what it draws.
 *
 * In a file of its own because both the registry and the layers it lists
 * read these values while they load, and neither may wait for the other.
 */

/** The scales, in pixels per map unit, at which more detail comes in. */
export const SCALES = {
  /** The generalised borders give way to the fine ones. */
  fineBorders: 2.2,
  terrainDetail: 2.2,
  /** Streams of order 4 join the rivers; the finer river lines load. */
  riversDetail: 2,
  /** Streams of order 3. */
  streams: 5,
  /** Below this, 2092 municipalities are a grey smear. */
  municipalities: 2.5,
} as const;

/** A line's width on screen, growing a little as the map zooms in. */
export function grown(pixels: number, scale: number): number {
  return pixels * Math.min(1.7, Math.max(1, 1 + 0.18 * Math.log2(scale)));
}
