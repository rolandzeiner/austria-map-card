/**
 * The mark a theme prints in the open sea: the federal eagle with the
 * country's name under it, as a poster carries its seal.
 *
 * It is part of the map, not of the card: it lies north of Tyrol, where the
 * sea is widest, and moves and grows with the map like everything else.
 * The tilted map leaves it out, as it leaves out the sea's shallows.
 */
import { EAGLE_BODY, EAGLE_GOLD, EAGLE_HEIGHT, EAGLE_RED, EAGLE_WIDTH } from "./emblem-data.ts";
import type { Emblem } from "./palette.ts";
import type { ShapeCache } from "./tiles.ts";

/** Where the mark stands, in map units: the eagle's top, its height, the middle of both. */
export const EMBLEM = {
  centre: 215,
  top: 78,
  height: 108,
  /** The name: the middle of its line, and the height of its letters' box. */
  nameAt: 210,
  nameSize: 23,
  nameSpacing: 3.2,
} as const;

/** The country's own name for itself, as on every Austrian map. */
export const EMBLEM_NAME = "ÖSTERREICH";

/**
 * Trace path data as emblem-data.ts writes it onto a path: `M x y` starts
 * a ring, then `c` (three pairs) and `l` (one pair) are relative to the
 * point before. Numbers are whole, separated by a space or by a minus sign.
 */
export function tracePath(path: Path2D, data: string): void {
  let x = 0;
  let y = 0;
  for (const [, command, rest] of data.matchAll(/([Mcl])([^Mcl]*)/g)) {
    const n = (rest?.match(/-?\d+/g) ?? []).map(Number);
    if (command === "M") {
      x = n[0] as number;
      y = n[1] as number;
      path.moveTo(x, y);
    } else if (command === "l") {
      x += n[0] as number;
      y += n[1] as number;
      path.lineTo(x, y);
    } else {
      path.bezierCurveTo(
        x + (n[0] as number),
        y + (n[1] as number),
        x + (n[2] as number),
        y + (n[3] as number),
        x + (n[4] as number),
        y + (n[5] as number),
      );
      x += n[4] as number;
      y += n[5] as number;
    }
  }
}

/** Draw the mark. The context is in map units. */
export function drawEmblem(
  ctx: CanvasRenderingContext2D,
  shapes: ShapeCache,
  style: Emblem,
  font: string,
): void {
  const size = EMBLEM.height / EAGLE_HEIGHT;
  ctx.save();
  ctx.translate(EMBLEM.centre - (EAGLE_WIDTH * size) / 2, EMBLEM.top);
  ctx.scale(size, size);
  for (const [key, data, colour] of [
    ["body", EAGLE_BODY, style.body],
    ["gold", EAGLE_GOLD, style.gold],
    ["red", EAGLE_RED, style.red],
  ] as const) {
    ctx.fillStyle = colour;
    ctx.fill(
      shapes.get(`emblem:${key}`, (path) => tracePath(path, data)),
      "evenodd",
    );
  }
  ctx.restore();

  ctx.save();
  ctx.font = `700 ${EMBLEM.nameSize}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const spaced = "letterSpacing" in ctx;
  if (spaced) ctx.letterSpacing = `${EMBLEM.nameSpacing}px`;
  ctx.fillStyle = style.name;
  // Letter-spacing also follows the last letter: half of it back to centre the word.
  ctx.fillText(EMBLEM_NAME, EMBLEM.centre + (spaced ? EMBLEM.nameSpacing / 2 : 0), EMBLEM.nameAt);
  if (spaced) ctx.letterSpacing = "0px";
  ctx.restore();
}
