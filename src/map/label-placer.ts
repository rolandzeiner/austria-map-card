/**
 * Where names go, and which of them get to stay.
 *
 * One pass, in order of importance: a label is drawn if its box is free,
 * and then the box is taken. Whoever comes first wins, so the caller's
 * order is the map's hierarchy.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const overlaps = (a: Rect, b: Rect, margin: number): boolean =>
  a.x - margin < b.x + b.w && b.x < a.x + a.w + margin && a.y - margin < b.y + b.h && b.y < a.y + a.h + margin;

export class LabelPlacer {
  private readonly taken: Rect[] = [];
  private readonly bounds: Rect;
  private readonly margin: number;

  /** `bounds` is the canvas; `margin` the clear space a label wants around it. */
  public constructor(bounds: Rect, margin: number) {
    this.bounds = bounds;
    this.margin = margin;
  }

  /** True when every box is on the canvas and clear of everything placed so far. */
  public fits(boxes: readonly Rect[]): boolean {
    const { bounds } = this;
    return boxes.every(
      (box) =>
        box.x >= bounds.x &&
        box.y >= bounds.y &&
        box.x + box.w <= bounds.x + bounds.w &&
        box.y + box.h <= bounds.y + bounds.h &&
        !this.taken.some((other) => overlaps(box, other, this.margin)),
    );
  }

  public take(boxes: readonly Rect[]): void {
    this.taken.push(...boxes);
  }

  /** Place the boxes if they fit. */
  public place(boxes: readonly Rect[]): boolean {
    if (!this.fits(boxes)) return false;
    this.take(boxes);
    return true;
  }

  /** The first of several alternatives that fits, placed; or -1. */
  public placeFirst(alternatives: readonly Rect[]): number {
    for (let index = 0; index < alternatives.length; index += 1) {
      if (this.place([alternatives[index] as Rect])) return index;
    }
    return -1;
  }

  public get count(): number {
    return this.taken.length;
  }
}

/** Where a town's name may sit round its dot: right, left, above, below. */
export function aroundDot(x: number, y: number, radius: number, w: number, h: number): Rect[] {
  const gap = radius + 3;
  return [
    { x: x + gap, y: y - h / 2, w, h },
    { x: x - gap - w, y: y - h / 2, w, h },
    { x: x - w / 2, y: y - gap - h, w, h },
    { x: x - w / 2, y: y + gap, w, h },
  ];
}

export const centredOn = (x: number, y: number, w: number, h: number): Rect => ({ x: x - w / 2, y: y - h / 2, w, h });

// ── Lettering along a line ───────────────────────────────────────────────

export interface Glyph {
  readonly char: string;
  readonly x: number;
  readonly y: number;
  /** Rotation in radians; 0 is upright. */
  readonly angle: number;
  readonly width: number;
}

/** A polyline with the distance along it at every point. */
export interface Measured {
  readonly xy: ArrayLike<number>;
  readonly along: Float32Array;
}

export function measure(xy: ArrayLike<number>): Measured {
  const along = new Float32Array(xy.length / 2);
  for (let point = 1; point < along.length; point += 1) {
    along[point] =
      (along[point - 1] as number) +
      Math.hypot(
        (xy[point * 2] as number) - (xy[point * 2 - 2] as number),
        (xy[point * 2 + 1] as number) - (xy[point * 2 - 1] as number),
      );
  }
  return { xy, along };
}

/** The point at a distance along a measured line, clamped to its ends. */
export function pointAlong(line: Measured, distance: number): [number, number] {
  const { xy, along } = line;
  const last = along.length - 1;
  if (distance <= 0) return [xy[0] as number, xy[1] as number];
  if (distance >= (along[last] as number)) return [xy[last * 2] as number, xy[last * 2 + 1] as number];
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if ((along[middle] as number) <= distance) low = middle;
    else high = middle;
  }
  const span = (along[high] as number) - (along[low] as number);
  const t = span === 0 ? 0 : (distance - (along[low] as number)) / span;
  return [
    (xy[low * 2] as number) + t * ((xy[high * 2] as number) - (xy[low * 2] as number)),
    (xy[low * 2 + 1] as number) + t * ((xy[high * 2 + 1] as number) - (xy[low * 2 + 1] as number)),
  ];
}

/**
 * The longest stretch of a line that lies inside a box, as distances along
 * it; or null when none of it does. Segments are clipped, not just their
 * end points tested, so a long straight piece crossing the box counts.
 */
export function longestInside(line: Measured, box: Rect): [number, number] | null {
  const { xy, along } = line;
  let best: [number, number] | null = null;
  let run: [number, number] | null = null;
  const close = (): void => {
    if (run !== null && (best === null || run[1] - run[0] > best[1] - best[0])) best = run;
    run = null;
  };
  for (let point = 0; point + 1 < along.length; point += 1) {
    const x1 = xy[point * 2] as number;
    const y1 = xy[point * 2 + 1] as number;
    const dx = (xy[point * 2 + 2] as number) - x1;
    const dy = (xy[point * 2 + 3] as number) - y1;
    // Liang-Barsky: the part of the segment, as 0..1, that is inside the box.
    let from = 0;
    let to = 1;
    const edges: Array<[number, number]> = [
      [-dx, x1 - box.x],
      [dx, box.x + box.w - x1],
      [-dy, y1 - box.y],
      [dy, box.y + box.h - y1],
    ];
    for (const [p, q] of edges) {
      if (p === 0) {
        if (q < 0) from = 2;
      } else if (p < 0) {
        from = Math.max(from, q / p);
      } else {
        to = Math.min(to, q / p);
      }
    }
    if (from > to) {
      close();
      continue;
    }
    const length = (along[point + 1] as number) - (along[point] as number);
    const start = (along[point] as number) + from * length;
    const end = (along[point] as number) + to * length;
    if (run !== null && from === 0) run = [run[0], end];
    else {
      close();
      run = [start, end];
    }
    if (to < 1) close();
  }
  close();
  return best;
}

/** How far a letter may lean before it reads as upside down, in radians. */
const MAX_LEAN = (100 * Math.PI) / 180;
/** How much two neighbouring letters may differ in angle. */
const MAX_KINK = (28 * Math.PI) / 180;

/**
 * Set a word along a line, centred on a distance along it.
 *
 * Each letter sits on the line and takes the direction of the chord under
 * it, so it follows the line's sweep and ignores wiggles smaller than
 * itself. The word always reads left to right. Returns null when the line
 * would stand a letter on its head or bend the word too sharply.
 */
export function setAlong(
  line: Measured,
  centre: number,
  chars: readonly string[],
  widths: readonly number[],
  spacing: number,
): Glyph[] | null {
  const total = widths.reduce((sum, width) => sum + width, 0) + spacing * (chars.length - 1);
  const start = centre - total / 2;
  const [startX] = pointAlong(line, start);
  const [endX] = pointAlong(line, start + total);
  // Read from the left: walk the line backwards if it runs right to left here.
  const direction = endX >= startX ? 1 : -1;
  const glyphs: Glyph[] = [];
  let offset = direction === 1 ? start : start + total;
  let previous: number | undefined;
  for (let index = 0; index < chars.length; index += 1) {
    const width = widths[index] as number;
    const middle = offset + (direction * width) / 2;
    const reach = Math.max(width, 6);
    const [ax, ay] = pointAlong(line, middle - direction * reach);
    const [bx, by] = pointAlong(line, middle + direction * reach);
    const angle = Math.atan2(by - ay, bx - ax);
    if (Math.abs(angle) > MAX_LEAN) return null;
    if (previous !== undefined && Math.abs(angle - previous) > MAX_KINK) return null;
    previous = angle;
    const [x, y] = pointAlong(line, middle);
    glyphs.push({ char: chars[index] as string, x, y, angle, width });
    offset += direction * (width + spacing);
  }
  return glyphs;
}

/** The boxes a set word occupies, one square per letter. */
export const glyphBoxes = (glyphs: readonly Glyph[], height: number): Rect[] =>
  glyphs.map((glyph) => {
    const side = Math.max(glyph.width, height);
    return { x: glyph.x - side / 2, y: glyph.y - side / 2, w: side, h: side };
  });
