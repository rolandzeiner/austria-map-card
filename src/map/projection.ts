/**
 * The one projection for this card.
 *
 * `scripts/build-data.mjs` runs every source through `project`: borders,
 * terrain, rivers and places. The card then works in the view-box units
 * that come out, and never projects anything itself. There is no second
 * implementation anywhere, so a town cannot drift away from the border it
 * is drawn beside.
 *
 * Lambert conformal conic with the parameters of Austria's own grid
 * (MGI / Austria Lambert, EPSG:31287): standard parallels 46° and 49° N,
 * central meridian 13°20' E. On a sphere rather than the Bessel ellipsoid:
 * the difference is a few hundred metres across the country, and it is the
 * same for every layer. The point of using it is the shape. The meridians
 * converge, so Vorarlberg and the Burgenland tilt the way they do in every
 * Austrian atlas, which a plain lat/lon grid does not give.
 */

const RADIANS = Math.PI / 180;

const PARALLEL_SOUTH = 46 * RADIANS;
const PARALLEL_NORTH = 49 * RADIANS;
const ORIGIN_LATITUDE = 47.5 * RADIANS;
const CENTRAL_MERIDIAN = (13 + 20 / 60) * RADIANS;

const half = (latitude: number): number => Math.tan(Math.PI / 4 + latitude / 2);

const CONE =
  Math.log(Math.cos(PARALLEL_SOUTH) / Math.cos(PARALLEL_NORTH)) /
  Math.log(half(PARALLEL_NORTH) / half(PARALLEL_SOUTH));
const SCALE_FACTOR = (Math.cos(PARALLEL_SOUTH) * Math.pow(half(PARALLEL_SOUTH), CONE)) / CONE;
const ORIGIN_RADIUS = SCALE_FACTOR / Math.pow(half(ORIGIN_LATITUDE), CONE);

/** The drawing's coordinate space. One unit is about 585 m on the ground. */
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 530;

// Chosen once so the outline sits in the view box with a margin of at
// least 11 units on every side. `scripts/build-data.mjs` fails if the
// borders ever leave that margin, so these cannot go stale without the
// build saying so.
const UNITS_PER_RADIAN = 10890;
const ORIGIN_X = 503.3;
const ORIGIN_Y = 303.6;

/** A point in view-box units: x to the right, y down. */
export type MapPoint = readonly [x: number, y: number];

/** Project degrees (on the MGI datum, like every source) onto the card's map. */
export function project(latitude: number, longitude: number): MapPoint {
  const radius = SCALE_FACTOR / Math.pow(half(latitude * RADIANS), CONE);
  const angle = CONE * (longitude * RADIANS - CENTRAL_MERIDIAN);
  const east = radius * Math.sin(angle);
  const north = ORIGIN_RADIUS - radius * Math.cos(angle);
  return [ORIGIN_X + UNITS_PER_RADIAN * east, ORIGIN_Y - UNITS_PER_RADIAN * north];
}
