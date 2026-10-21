/**
 * The tilted, turnable map: pure arithmetic between the map, its relief and
 * the canvas, shared by the WebGL renderer, the names drawn over it and the
 * hit test.
 *
 * The flat camera (`camera.ts`) stays the source of truth for where the map
 * looks and how far in: its centre becomes the point the 3D camera orbits,
 * and its scale the pixels per map unit at that point. An orientation adds
 * a pitch (0 looks straight down) and a bearing (the compass heading at the
 * top of the canvas). With both at 0 the 3D view and the flat map show the
 * same thing, so tilting starts from exactly what is on screen.
 *
 * World space is the map's own: x east, y south, both in view-box units,
 * and z up, in the same units, with the heights exaggerated.
 */
import { heightAt, type Relief } from "../layers/store.ts";
import { MAX_ZOOM, fitScale, type Camera, type Size } from "./camera.ts";
import { MAP_HEIGHT, MAP_WIDTH } from "./projection.ts";

export interface Orientation {
  /** Radians from straight down; 0 is the flat map. */
  readonly pitch: number;
  /** Radians clockwise from north: the heading at the top of the canvas. */
  readonly bearing: number;
}

export const FLAT: Orientation = { pitch: 0, bearing: 0 };

const DEGREES = Math.PI / 180;
/** The steepest tilt: beyond it the horizon swallows the map. */
export const MAX_PITCH = 65 * DEGREES;
/** What the 3D button tilts to. */
export const TILT_PITCH = 55 * DEGREES;
/** Vertical field of view. Narrow, so the tilted map is not distorted much. */
export const FIELD_OF_VIEW = 36 * DEGREES;
/** Ground metres per view-box unit (see projection.ts). */
export const METRES_PER_UNIT = 585;
/**
 * How much the heights are stretched, by zoom. At true scale the Alps rise
 * 6 units over a map 1000 wide and the whole country looks flat; close up
 * the same stretch turns every ridge into a spike.
 */
export function exaggeration(zoom: number): number {
  return Math.min(3, Math.max(1.6, 3 / Math.max(zoom, 1) ** 0.4));
}

/** True when the orientation draws the flat map: no tilt, north up. */
export const isFlat = (orientation: Orientation): boolean =>
  orientation.pitch < 1e-4 && Math.abs(normalBearing(orientation.bearing)) < 1e-4;

/** A bearing in (-π, π]. */
export function normalBearing(bearing: number): number {
  const turned = bearing % (2 * Math.PI);
  if (turned > Math.PI) return turned - 2 * Math.PI;
  if (turned <= -Math.PI) return turned + 2 * Math.PI;
  return turned;
}

export function orient(orientation: Orientation, dPitch: number, dBearing: number): Orientation {
  return {
    pitch: Math.min(Math.max(orientation.pitch + dPitch, 0), MAX_PITCH),
    bearing: normalBearing(orientation.bearing + dBearing),
  };
}

type Vec3 = readonly [number, number, number];

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Height of the ground in world units, 0 without a relief. */
export function groundZ(relief: Relief | undefined, x: number, y: number, stretch: number): number {
  return relief === undefined ? 0 : (heightAt(relief, x, y) / METRES_PER_UNIT) * stretch;
}

export class View3D {
  public readonly size: Size;
  /** Pixels per map unit at the centre, as on the flat camera. */
  public readonly scale: number;
  /** How much the heights are stretched in this view. */
  public readonly stretch: number;
  /** From the eye to the point it orbits, in world units. */
  public readonly distance: number;
  public readonly eye: Vec3;
  /** Unit vectors: where the camera looks, and the canvas's right and down. */
  public readonly forward: Vec3;
  public readonly right: Vec3;
  public readonly down: Vec3;
  /** Pixels per world unit at distance 1. */
  public readonly focal: number;
  public readonly near: number;
  public readonly far: number;

  public constructor(
    camera: Camera,
    orientation: Orientation,
    size: Size,
    relief: Relief | undefined,
  ) {
    this.size = size;
    this.scale = camera.k;
    this.stretch = exaggeration(camera.k / fitScale(size));
    const { pitch, bearing } = orientation;
    const heading: [number, number] = [Math.sin(bearing), -Math.cos(bearing)];
    this.forward = [heading[0] * Math.sin(pitch), heading[1] * Math.sin(pitch), -Math.cos(pitch)];
    this.right = [Math.cos(bearing), Math.sin(bearing), 0];
    this.down = [-heading[0] * Math.cos(pitch), -heading[1] * Math.cos(pitch), -Math.sin(pitch)];
    this.focal = size.height / 2 / Math.tan(FIELD_OF_VIEW / 2);
    // Far enough that the map point at the centre shows at the camera's scale.
    const distance = this.focal / camera.k;
    this.distance = distance;
    const target: Vec3 = [camera.x, camera.y, groundZ(relief, camera.x, camera.y, this.stretch)];
    const eye: [number, number, number] = [
      target[0] - this.forward[0] * distance,
      target[1] - this.forward[1] * distance,
      target[2] - this.forward[2] * distance,
    ];
    // Never inside a mountain: a low camera over a valley can have a ridge
    // between it and the centre.
    eye[2] = Math.max(eye[2], groundZ(relief, eye[0], eye[1], this.stretch) + distance * 0.08);
    this.eye = eye;
    this.near = Math.max(distance * 0.02, 0.02);
    this.far = distance * 6 + MAP_WIDTH * 2;
  }

  /** Clip space from world space, column-major, for WebGL. */
  public matrix(): Float32Array {
    const { eye, forward: f, right: r, down: d, near, far } = this;
    const sx = this.focal / (this.size.width / 2);
    const sy = this.focal / (this.size.height / 2);
    const a = (far + near) / (far - near);
    const b = (-2 * far * near) / (far - near);
    const rows = [
      [sx * r[0], sx * r[1], sx * r[2], -sx * dot(r, eye)],
      [-sy * d[0], -sy * d[1], -sy * d[2], sy * dot(d, eye)],
      [a * f[0], a * f[1], a * f[2], -a * dot(f, eye) + b],
      [f[0], f[1], f[2], -dot(f, eye)],
    ];
    const out = new Float32Array(16);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) out[column * 4 + row] = rows[row]![column]!;
    }
    return out;
  }

  /** Where a map point on the ground lands on the canvas, or null behind the camera. */
  public projectGround(relief: Relief | undefined, x: number, y: number): [number, number] | null {
    return this.project(x, y, groundZ(relief, x, y, this.stretch));
  }

  /** Where a world point lands on the canvas, or null behind the camera. */
  public project(x: number, y: number, z: number): [number, number] | null {
    const v: Vec3 = [x - this.eye[0], y - this.eye[1], z - this.eye[2]];
    const depth = dot(v, this.forward);
    if (depth < this.near) return null;
    return [
      this.size.width / 2 + (this.focal * dot(v, this.right)) / depth,
      this.size.height / 2 + (this.focal * dot(v, this.down)) / depth,
    ];
  }

  /** The direction from the eye through a pixel, as a unit vector. */
  public ray(px: number, py: number): Vec3 {
    const u = (px - this.size.width / 2) / this.focal;
    const v = (py - this.size.height / 2) / this.focal;
    const { forward: f, right: r, down: d } = this;
    const out: Vec3 = [
      f[0] + r[0] * u + d[0] * v,
      f[1] + r[1] * u + d[1] * v,
      f[2] + r[2] * u + d[2] * v,
    ];
    const length = Math.hypot(...out);
    return [out[0] / length, out[1] / length, out[2] / length];
  }

  /**
   * The map point under a pixel: where the ray through it first meets the
   * ground. Null for a pixel above the horizon or off the map.
   */
  public pick(px: number, py: number, relief: Relief | undefined): [number, number] | null {
    const ray = this.ray(px, py);
    const at = (t: number): Vec3 => [
      this.eye[0] + ray[0] * t,
      this.eye[1] + ray[1] * t,
      this.eye[2] + ray[2] * t,
    ];
    const above = (t: number): number => {
      const p = at(t);
      return p[2] - groundZ(relief, p[0], p[1], this.stretch);
    };
    // March in steps of about half a cell on the ground, then halve the
    // last step until it is a hundredth of a unit.
    const step = Math.max(0.4, this.near);
    let previous = this.near;
    if (above(previous) < 0) return null;
    for (let t = previous + step; t < this.far; t += step) {
      if (above(t) <= 0) {
        let low = previous;
        let high = t;
        while (high - low > 0.01) {
          const middle = (low + high) / 2;
          if (above(middle) > 0) low = middle;
          else high = middle;
        }
        const hit = at(high);
        if (hit[0] < 0 || hit[1] < 0 || hit[0] > MAP_WIDTH || hit[1] > MAP_HEIGHT) return null;
        return [hit[0], hit[1]];
      }
      previous = t;
      // Below the lowest ground and heading down: nothing more to meet.
      if (ray[2] >= 0 && at(t)[2] > this.eye[2] + 1) return null;
    }
    return null;
  }
}

/**
 * Move a tilted, turned map by a drag of (dx, dy) pixels. The point under
 * the middle of the canvas follows the finger; a drag along the tilt covers
 * more ground, as the ground there is further away.
 */
export function panTilted(
  camera: Camera,
  orientation: Orientation,
  size: Size,
  dx: number,
  dy: number,
): Camera {
  const { pitch, bearing } = orientation;
  const heading: [number, number] = [Math.sin(bearing), -Math.cos(bearing)];
  const right: [number, number] = [Math.cos(bearing), Math.sin(bearing)];
  const along = dy / (camera.k * Math.cos(pitch));
  return clampTilted(
    {
      x: camera.x - (right[0] * dx) / camera.k + heading[0] * along,
      y: camera.y - (right[1] * dx) / camera.k + heading[1] * along,
      k: camera.k,
    },
    size,
  );
}

/** Zoom a tilted map about the middle of the canvas. */
export function zoomTilted(camera: Camera, size: Size, factor: number): Camera {
  return clampTilted({ ...camera, k: camera.k * factor }, size);
}

/** Keep a tilted camera's centre on the map and its scale in range. */
export function clampTilted(camera: Camera, size: Size): Camera {
  const fit = fitScale(size);
  return {
    x: Math.min(Math.max(camera.x, 0), MAP_WIDTH),
    y: Math.min(Math.max(camera.y, 0), MAP_HEIGHT),
    k: Math.min(Math.max(camera.k, fit), fit * MAX_ZOOM),
  };
}
