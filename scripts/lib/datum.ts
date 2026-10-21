/**
 * MGI / Austria GK Central (EPSG:31255) to degrees.
 *
 * The BEV's place names come in this grid: Gauss-Krüger (transverse
 * Mercator) on the Bessel 1841 ellipsoid, central meridian 13°20' E, scale
 * factor 1, no false easting, false northing -5 000 000 m.
 *
 * It is the same MGI datum as the borders, the terrain and the rivers,
 * which arrive in Austria Lambert. So no datum shift is needed, and none is
 * applied: the whole map is in unshifted MGI degrees run through one
 * projection, and a town's dot lands on the town because every layer is
 * off true WGS84 by the same hundred metres.
 *
 * Krüger's series in the third flattening, to the third order: good to a
 * millimetre across Austria, which lies within four degrees of the central
 * meridian.
 */

const RADIANS = Math.PI / 180;

const BESSEL_A = 6377397.155;
const BESSEL_F = 1 / 299.1528128;
const N = BESSEL_F / (2 - BESSEL_F);
/** Radius of the sphere the meridian is rectified on. */
const RECTIFYING = (BESSEL_A / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64);

const CENTRAL_MERIDIAN = (13 + 1 / 3) * RADIANS;
const FALSE_NORTHING = -5_000_000;

const ALPHA = [
  N / 2 - (2 * N ** 2) / 3 + (5 * N ** 3) / 16,
  (13 * N ** 2) / 48 - (3 * N ** 3) / 5,
  (61 * N ** 3) / 240,
];
const BETA = [
  N / 2 - (2 * N ** 2) / 3 + (37 * N ** 3) / 96,
  N ** 2 / 48 + N ** 3 / 15,
  (17 * N ** 3) / 480,
];
const DELTA = [
  2 * N - (2 * N ** 2) / 3 - 2 * N ** 3,
  (7 * N ** 2) / 3 - (8 * N ** 3) / 5,
  (56 * N ** 3) / 15,
];

/** Gauss-Krüger metres to degrees on the MGI datum: [latitude, longitude]. */
export function gaussKruegerToGeographic(easting: number, northing: number): [number, number] {
  const xi = (northing - FALSE_NORTHING) / RECTIFYING;
  const eta = easting / RECTIFYING;
  let xiPrime = xi;
  let etaPrime = eta;
  BETA.forEach((beta, index) => {
    const j = 2 * (index + 1);
    xiPrime -= beta * Math.sin(j * xi) * Math.cosh(j * eta);
    etaPrime -= beta * Math.cos(j * xi) * Math.sinh(j * eta);
  });
  const chi = Math.asin(Math.sin(xiPrime) / Math.cosh(etaPrime));
  let latitude = chi;
  DELTA.forEach((delta, index) => {
    latitude += delta * Math.sin(2 * (index + 1) * chi);
  });
  const longitude = CENTRAL_MERIDIAN + Math.atan2(Math.sinh(etaPrime), Math.cos(xiPrime));
  return [latitude / RADIANS, longitude / RADIANS];
}

/** The way back: degrees on the MGI datum to Gauss-Krüger metres, [easting, northing]. */
export function geographicToGaussKrueger(latitude: number, longitude: number): [number, number] {
  const phi = latitude * RADIANS;
  const lambda = longitude * RADIANS - CENTRAL_MERIDIAN;
  const twoRootN = (2 * Math.sqrt(N)) / (1 + N);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - twoRootN * Math.atanh(twoRootN * Math.sin(phi)));
  const xiPrime = Math.atan2(t, Math.cos(lambda));
  const etaPrime = Math.atanh(Math.sin(lambda) / Math.sqrt(1 + t * t));
  let xi = xiPrime;
  let eta = etaPrime;
  ALPHA.forEach((alpha, index) => {
    const j = 2 * (index + 1);
    xi += alpha * Math.sin(j * xiPrime) * Math.cosh(j * etaPrime);
    eta += alpha * Math.cos(j * xiPrime) * Math.sinh(j * etaPrime);
  });
  return [RECTIFYING * eta, RECTIFYING * xi + FALSE_NORTHING];
}
