import { describe, expect, it } from "vite-plus/test";

import { gaussKruegerToGeographic, geographicToGaussKrueger } from "./datum.ts";

describe("MGI / Austria GK Central", () => {
  it("puts the grid's origin on the central meridian", () => {
    const [latitude, longitude] = gaussKruegerToGeographic(0, 300_000);
    expect(longitude).toBeCloseTo(13 + 1 / 3, 9);
    // 5 300 km from the equator along the meridian is a little south of 48° N.
    expect(latitude).toBeGreaterThan(47.8);
    expect(latitude).toBeLessThan(47.9);
  });

  it("goes there and back to within a centimetre across Austria", () => {
    for (const [latitude, longitude] of [
      [47.5031, 9.7471],
      [48.2082, 16.3738],
      [46.6247, 14.3053],
      [47.0707, 15.4395],
      [49.0, 15.0],
      [46.4, 17.1],
    ] as const) {
      const [easting, northing] = geographicToGaussKrueger(latitude, longitude);
      const [backLatitude, backLongitude] = gaussKruegerToGeographic(easting, northing);
      expect(backLatitude).toBeCloseTo(latitude, 7);
      expect(backLongitude).toBeCloseTo(longitude, 7);
    }
  });

  it("reads the BEV's own coordinates for Bregenz and Hallstatt", () => {
    // From NAM_7100_SIEDLUNG_P. The expected degrees are the towns' WGS84
    // positions; MGI differs from those by about 0.001 degrees.
    const [bregenzLatitude, bregenzLongitude] = gaussKruegerToGeographic(-269866, 268849);
    expect(bregenzLatitude).toBeCloseTo(47.503, 1);
    expect(bregenzLongitude).toBeCloseTo(9.747, 1);
    const [hallstattLatitude, hallstattLongitude] = gaussKruegerToGeographic(23775, 269449);
    expect(hallstattLatitude).toBeCloseTo(47.562, 1);
    expect(hallstattLongitude).toBeCloseTo(13.649, 1);
  });

  it("measures eastings along the ground: a kilometre east is a kilometre", () => {
    const [easting] = geographicToGaussKrueger(47.5, 13 + 1 / 3 + 1);
    // One degree of longitude at 47.5° N on the Bessel ellipsoid.
    expect(easting / 1000).toBeGreaterThan(75.2);
    expect(easting / 1000).toBeLessThan(75.5);
  });
});
