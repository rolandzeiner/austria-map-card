/**
 * Where the map is looking: pure arithmetic between map units and pixels.
 *
 * The camera is the map point at the centre of the canvas and a scale in
 * pixels per map unit. That scale, not a zoom factor, decides how much
 * detail is drawn: a card twice as wide shows twice the pixels per
 * kilometre at the same zoom, and gets the finer data sooner.
 */
import { MAP_HEIGHT, MAP_WIDTH } from "./projection.ts";

export interface Camera {
  /** Map point at the centre of the canvas. */
  readonly x: number;
  readonly y: number;
  /** Pixels per map unit. */
  readonly k: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** left, top, right, bottom, in map units. */
export type Box = readonly [left: number, top: number, right: number, bottom: number];

/** How far in the map zooms, as a multiple of the whole-country view. */
export const MAX_ZOOM = 40;

/** The scale at which the whole map fits the canvas. */
export function fitScale(size: Size): number {
  return Math.max(Math.min(size.width / MAP_WIDTH, size.height / MAP_HEIGHT), 1e-6);
}

/** The camera's zoom: 1 shows the whole country. */
export function zoomOf(camera: Camera, size: Size): number {
  return camera.k / fitScale(size);
}

/**
 * Keep the camera within the zoom range and the map on the canvas.
 *
 * On the whole-country view the map cannot be moved at all. The further in
 * the view is, the further it may run past the map's edge, up to half a
 * canvas at the deepest zoom: otherwise nothing near the border could ever
 * be brought to the middle, and a card that opens on Vorarlberg would show
 * it squeezed against its left edge. An axis along which the map is smaller
 * than the canvas even so stays centred.
 */
export function clampCamera(camera: Camera, size: Size): Camera {
  const fit = fitScale(size);
  const k = Math.min(Math.max(camera.k, fit), fit * MAX_ZOOM);
  const past = 1 - fit / k;
  const along = (centre: number, extent: number, pixels: number): number => {
    const half = pixels / (2 * k);
    const low = half * (1 - past);
    const high = extent - low;
    return low >= high ? extent / 2 : Math.min(Math.max(centre, low), high);
  };
  return { x: along(camera.x, MAP_WIDTH, size.width), y: along(camera.y, MAP_HEIGHT, size.height), k };
}

/** The whole country. */
export function homeCamera(size: Size): Camera {
  return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, k: fitScale(size) };
}

/** A camera that shows a box with `padding` pixels to spare on every side. */
export function fitBox(box: Box, size: Size, padding: number): Camera {
  const width = Math.max(box[2] - box[0], 1e-6);
  const height = Math.max(box[3] - box[1], 1e-6);
  const k = Math.min(
    Math.max(size.width - 2 * padding, 1) / width,
    Math.max(size.height - 2 * padding, 1) / height,
  );
  return clampCamera({ x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, k }, size);
}

export function toScreen(camera: Camera, size: Size, x: number, y: number): [number, number] {
  return [(x - camera.x) * camera.k + size.width / 2, (y - camera.y) * camera.k + size.height / 2];
}

export function toMap(camera: Camera, size: Size, px: number, py: number): [number, number] {
  return [(px - size.width / 2) / camera.k + camera.x, (py - size.height / 2) / camera.k + camera.y];
}

/** The part of the map the canvas shows. */
export function visibleBox(camera: Camera, size: Size): Box {
  const halfWidth = size.width / (2 * camera.k);
  const halfHeight = size.height / (2 * camera.k);
  return [camera.x - halfWidth, camera.y - halfHeight, camera.x + halfWidth, camera.y + halfHeight];
}

/** Zoom by `factor`, keeping the map point under the pixel (px, py) under it. */
export function zoomAbout(camera: Camera, size: Size, px: number, py: number, factor: number): Camera {
  const fit = fitScale(size);
  const k = Math.min(Math.max(camera.k * factor, fit), fit * MAX_ZOOM);
  const [x, y] = toMap(camera, size, px, py);
  return clampCamera({ x: x - (px - size.width / 2) / k, y: y - (py - size.height / 2) / k, k }, size);
}

/** Move the map by a number of pixels: a drag to the right is a positive dx. */
export function panBy(camera: Camera, size: Size, dx: number, dy: number): Camera {
  return clampCamera({ x: camera.x - dx / camera.k, y: camera.y - dy / camera.k, k: camera.k }, size);
}

/** The same view on a canvas of another size: same centre, same zoom. */
export function resizeCamera(camera: Camera, from: Size, to: Size): Camera {
  return clampCamera({ ...camera, k: zoomOf(camera, from) * fitScale(to) }, to);
}

export const boxesTouch = (a: Box, b: Box): boolean => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
