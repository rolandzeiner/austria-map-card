/**
 * Pointer and keyboard input, kept free of the DOM so it can be tested on
 * its own. The card's event handlers translate events into calls here and
 * apply the camera that comes back.
 */
import { panBy, zoomAbout, type Camera, type Size } from "./camera.ts";

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

/**
 * Tracks the pointers on the map: one finger or the mouse drags it, two
 * fingers pinch and drag at once, and a press that barely moves is a tap.
 */
export class MapGesture {
  private readonly pointers = new Map<number, Pointer>();
  private travelled = 0;
  private pinched = false;
  private lastTap: { x: number; y: number; time: number } | null = null;

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
    const zoomed = zoomAbout(camera, size, before.x, before.y, before.distance > 0 ? after.distance / before.distance : 1);
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
    if (cancelled || this.pinched || this.travelled > TAP_SLOP || this.pointers.size > 0) return "none";
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

  private spread(): { x: number; y: number; distance: number } {
    const [a, b] = [...this.pointers.values()] as [Pointer, Pointer];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
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

/** What a key does while the map has focus, if anything. */
export function keyCommand(key: string): KeyCommand | null {
  return KEYS[key] ?? null;
}

/** Wheel movement as a zoom factor: a notch is about a sixth, a pinch on a trackpad is smooth. */
export function wheelFactor(deltaY: number): number {
  return Math.exp(-Math.max(-120, Math.min(120, deltaY)) * 0.004);
}
