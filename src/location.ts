/**
 * Where the "you are here" pin goes.
 *
 * Three sources: the home's position from Home Assistant's settings, the
 * position of the device showing the dashboard (the browser's geolocation),
 * or an entity carrying `latitude` and `longitude` attributes, which is what
 * a person or a Companion-app device tracker has. Nothing here leaves the
 * browser: the position is projected and drawn, never sent anywhere.
 *
 * Home Assistant's coordinates are WGS84 and the map's projection expects
 * MGI. The two differ by about 100 m in Austria, a sixth of one map unit,
 * so they are used as they are.
 */
import type { HomeAssistant, LocationSource } from "./types.ts";

export interface Position {
  readonly latitude: number;
  readonly longitude: number;
}

const isCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const position = (latitude: unknown, longitude: unknown): Position | null =>
  isCoordinate(latitude) && isCoordinate(longitude) && (latitude !== 0 || longitude !== 0)
    ? { latitude, longitude }
    : null;

export const homePosition = (hass: HomeAssistant | undefined): Position | null =>
  position(hass?.config?.latitude, hass?.config?.longitude);

/**
 * The position to mark, or null when there is none to show.
 *
 * `device` falls back to the home while the browser has not answered, and
 * for good when it refuses: a wall tablet that may not share its position
 * is in the home anyway. An entity without coordinates of its own that
 * reports `home` (a router-based tracker) is placed at the home too.
 */
export function locate(hass: HomeAssistant | undefined, source: LocationSource, device: Position | null): Position | null {
  if (source === "home") return homePosition(hass);
  if (source === "device") return device ?? homePosition(hass);
  const entity = hass?.states?.[source];
  if (entity === undefined) return null;
  return (
    position(entity.attributes.latitude, entity.attributes.longitude) ??
    (entity.state === "home" ? homePosition(hass) : null)
  );
}

/** A string that changes when the position to mark does, for `shouldUpdate`. */
export function locationKey(hass: HomeAssistant | undefined, source: LocationSource, device: Position | null): string {
  const here = locate(hass, source, device);
  return here === null ? "" : `${here.latitude},${here.longitude}`;
}
