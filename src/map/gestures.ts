/**
 * Pointer and keyboard input, kept free of the DOM so it can be tested on
 * its own. The card's event handlers translate events into calls here and
 * apply the camera that comes back.
 */
import { panBy, zoomAbout, type Camera, type Size } from "./camera.ts";
import { isFlat, orient, panTilted, zoomTilted, type Orientation } from "./view3d.ts";

/** Movement in pixels below which a press still counts as a tap. */
export const TAP_SLOP = 6;
/** A second tap this soon and this near is a double tap. */
export const DOUBLE_TAP_MS = 320;
export const DOUBLE_TAP_SLOP = 30;

interface Pointer {
  x: number;
  y: number;
}

export type Release = "none" | "tap" | "double-tap";

/** Where the map looks, flat or tilted. */
export interface Pose {
  readonly camera: Camera;
  readonly orientation: Orientation;
}

/** Radians of tilt or turn per pixel of drag. */
export const TILT_RATE = 0.006;
export const TURN_RATE = 0.006;
/** Fingers must travel this far before a two-finger gesture is read. */
const DECIDE_AFTER = 10;
/** A pinch turns the map only once the fingers have twisted this far. */
const TWIST_THRESHOLD = 0.21;

/** What two fingers are doing: pinching (zoom, turn, move) or tilting. */
type TwoFingers = "undecided" | "pinch" | "tilt";

/**
 * Tracks the pointers on the map: one finger or the mouse drags it, two
 * fingers pinch and drag at once, and a press that barely moves is a tap.
 */
export class MapGesture {
  private readonly pointers = new Map<number, Pointer>();
  private travelled = 0;
  private pinched = false;
  private lastTap: { x: number; y: number; time: number } | null = null;
  private twoFingers: TwoFingers = "undecided";
  private starts = new Map<number, Pointer>();
  private twist = 0;
  private turning = false;

  /** True while a finger or the mouse button is down on the map. */
  public get active(): boolean {
    return this.pointers.size > 0;
  }

  public down(id: number, x: number, y: number): void {
    if (this.pointers.size === 0) {
      this.travelled = 0;
      this.pinched = false;
    }
    this.pointers.set(id, { x, y });
    if (this.pointers.size > 1) this.pinched = true;
    if (this.pointers.size === 2) {
      this.twoFingers = "undecided";
      this.starts = new Map([...this.pointers].map(([key, at]) => [key, { ...at }]));
      this.twist = 0;
      this.turning = false;
    }
  }

  /**
   * The pose after this move, for a card that can tilt; null when the
   * pointer is not ours. One pointer moves the map, or with `turn` (Shift,
   * or the right mouse button) tilts it by dragging up and down and turns
   * it by dragging sideways. Two fingers pinch, twist, or tilt when they
   * slide up or down side by side.
   */
  public movePose(
    id: number,
    x: number,
    y: number,
    pose: Pose,
    size: Size,
    turn: boolean,
  ): Pose | null {
    const pointer = this.pointers.get(id);
    if (pointer === undefined) return null;
    const { camera, orientation } = pose;
    const flat = isFlat(orientation);
    if (this.pointers.size === 1) {
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      pointer.x = x;
      pointer.y = y;
      this.travelled += Math.abs(dx) + Math.abs(dy);
      if (this.travelled <= TAP_SLOP) return pose;
      if (turn)
        return { camera, orientation: orient(orientation, -dy * TILT_RATE, -dx * TURN_RATE) };
      return {
        camera: flat ? panBy(camera, size, dx, dy) : panTilted(camera, orientation, size, dx, dy),
        orientation,
      };
    }
    if (this.pointers.size !== 2) return pose;
    const before = this.spread();
    const dy = y - pointer.y;
    pointer.x = x;
    pointer.y = y;
    const after = this.spread();
    if (this.twoFingers === "undecided") this.twoFingers = this.decide();
    if (this.twoFingers === "undecided") return pose;
    if (this.twoFingers === "tilt") {
      // Each finger's move is half of the pair's.
      return { camera, orientation: orient(orientation, (-dy / 2) * TILT_RATE, 0) };
    }
    let turned = orientation;
    const angle = after.angle - before.angle;
    const twist = Math.atan2(Math.sin(angle), Math.cos(angle));
    if (this.turning) turned = orient(orientation, 0, -twist);
    else {
      this.twist += twist;
      if (Math.abs(this.twist) > TWIST_THRESHOLD) {
        this.turning = true;
        turned = orient(orientation, 0, -this.twist);
      }
    }
    const factor = before.distance > 0 ? after.distance / before.distance : 1;
    if (flat && isFlat(turned)) {
      // The point between the fingers stays under them while they spread.
      const zoomed = zoomAbout(camera, size, before.x, before.y, factor);
      return {
        camera: panBy(zoomed, size, after.x - before.x, after.y - before.y),
        orientation: turned,
      };
    }
    const zoomed = zoomTilted(camera, size, factor);
    return {
      camera: panTilted(zoomed, turned, size, after.x - before.x, after.y - before.y),
      orientation: turned,
    };
  }

  /** Tilt when both fingers slide the same way up or down and keep their distance. */
  private decide(): TwoFingers {
    const moves = [...this.pointers].map(([key, at]) => {
      const start = this.starts.get(key) ?? at;
      return { dx: at.x - start.x, dy: at.y - start.y };
    });
    const [a, b] = moves as [{ dx: number; dy: number }, { dx: number; dy: number }];
    if (Math.max(Math.hypot(a.dx, a.dy), Math.hypot(b.dx, b.dy)) < DECIDE_AFTER) return "undecided";
    const upright = (m: { dx: number; dy: number }): boolean =>
      Math.abs(m.dy) > 1.5 * Math.abs(m.dx);
    return upright(a) && upright(b) && Math.sign(a.dy) === Math.sign(b.dy) ? "tilt" : "pinch";
  }

  /** The camera after this move, or null when the pointer is not ours. */
  public move(id: number, x: number, y: number, camera: Camera, size: Size): Camera | null {
    const pointer = this.pointers.get(id);
    if (pointer === undefined) return null;
    if (this.pointers.size === 1) {
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      pointer.x = x;
      pointer.y = y;
      this.travelled += Math.abs(dx) + Math.abs(dy);
      // Below the slop nothing moves, so a tap with a shaky finger stays a tap.
      return this.travelled > TAP_SLOP ? panBy(camera, size, dx, dy) : camera;
    }
    if (this.pointers.size !== 2) return camera;
    const before = this.spread();
    pointer.x = x;
    pointer.y = y;
    const after = this.spread();
    // The point between the fingers stays under them while they spread.
    const zoomed = zoomAbout(
      camera,
      size,
      before.x,
      before.y,
      before.distance > 0 ? after.distance / before.distance : 1,
    );
    return panBy(zoomed, size, after.x - before.x, after.y - before.y);
  }

  /**
   * Ends a pointer. A tap is one pointer that barely moved and was lifted,
   * not cancelled, so a press can always be abandoned by moving away
   * (WCAG 2.5.2).
   */
  public up(id: number, cancelled: boolean, now: number): Release {
    const pointer = this.pointers.get(id);
    if (pointer === undefined) return "none";
    this.pointers.delete(id);
    if (cancelled || this.pinched || this.travelled > TAP_SLOP || this.pointers.size > 0)
      return "none";
    const previous = this.lastTap;
    if (
      previous !== null &&
      now - previous.time <= DOUBLE_TAP_MS &&
      Math.hypot(pointer.x - previous.x, pointer.y - previous.y) <= DOUBLE_TAP_SLOP
    ) {
      this.lastTap = null;
      return "double-tap";
    }
    this.lastTap = { x: pointer.x, y: pointer.y, time: now };
    return "tap";
  }

  /** Forget every pointer: the canvas lost them (blur, removal). */
  public reset(): void {
    this.pointers.clear();
  }

  private spread(): { x: number; y: number; distance: number; angle: number } {
    const [a, b] = [...this.pointers.values()] as [Pointer, Pointer];
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }
}

// ── Keyboard ─────────────────────────────────────────────────────────────

/** Pixels an arrow key moves the view. */
export const KEY_PAN = 64;
/** Factor of one zoom step, by key, button or double tap. */
export const ZOOM_STEP = 1.6;

export type KeyCommand =
  | { readonly kind: "pan"; readonly dx: number; readonly dy: number }
  | { readonly kind: "zoom"; readonly factor: number }
  | { readonly kind: "reset" }
  | { readonly kind: "orient"; readonly pitch: number; readonly bearing: number }
  | { readonly kind: "identify" };

// The arrows move the view, so the map goes the other way.
const KEYS: Readonly<Record<string, KeyCommand>> = {
  ArrowLeft: { kind: "pan", dx: KEY_PAN, dy: 0 },
  ArrowRight: { kind: "pan", dx: -KEY_PAN, dy: 0 },
  ArrowUp: { kind: "pan", dx: 0, dy: KEY_PAN },
  ArrowDown: { kind: "pan", dx: 0, dy: -KEY_PAN },
  "+": { kind: "zoom", factor: ZOOM_STEP },
  "=": { kind: "zoom", factor: ZOOM_STEP },
  "-": { kind: "zoom", factor: 1 / ZOOM_STEP },
  "0": { kind: "reset" },
  Enter: { kind: "identify" },
};

/** Radians a key tilts or turns the map. */
export const KEY_TILT = (10 * Math.PI) / 180;
export const KEY_TURN = (15 * Math.PI) / 180;

// With Shift, the arrows tilt and turn the map instead of moving it.
const SHIFTED_KEYS: Readonly<Record<string, KeyCommand>> = {
  ArrowUp: { kind: "orient", pitch: KEY_TILT, bearing: 0 },
  ArrowDown: { kind: "orient", pitch: -KEY_TILT, bearing: 0 },
  ArrowLeft: { kind: "orient", pitch: 0, bearing: KEY_TURN },
  ArrowRight: { kind: "orient", pitch: 0, bearing: -KEY_TURN },
};

/** What a key does while the map has focus, if anything. `tilt` offers the Shift keys. */
export function keyCommand(key: string, shift = false, tilt = false): KeyCommand | null {
  // "+" takes Shift on many keyboards, so a shifted key falls back to its plain meaning.
  if (shift && tilt && SHIFTED_KEYS[key] !== undefined) return SHIFTED_KEYS[key];
  return KEYS[key] ?? null;
}

/** Wheel movement as a zoom factor: a notch is about a sixth, a pinch on a trackpad is smooth. */
export function wheelFactor(deltaY: number): number {
  return Math.exp(-Math.max(-120, Math.min(120, deltaY)) * 0.004);
}
