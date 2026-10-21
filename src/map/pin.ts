/**
 * The "you are here" pin: mdi:map-marker, drawn from the icon's own
 * geometry on its 24-unit grid. A circle of radius 7 round (12, 9) narrows
 * to the tip at (12, 22), with a hole of radius 2.5 at the centre. Drawn
 * with arcs and curves instead of from the SVG path text, so the preview
 * script's canvas and the tests' recording context draw it the same way.
 */
import type { Palette } from "./palette.ts";

/** From the top of the head to the tip, in screen pixels. */
const PIN_HEIGHT = 30;
/** The icon's height on its own grid: y 2 to 22. */
const ICON_HEIGHT = 20;

/** Draw the pin with its tip on a point given in screen pixels. */
export function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: Palette,
): void {
  const s = PIN_HEIGHT / ICON_HEIGHT;
  ctx.save();
  ctx.translate(x - 12 * s, y - 22 * s);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(12, 22);
  ctx.bezierCurveTo(12, 22, 5, 14.25, 5, 9);
  ctx.arc(12, 9, 7, Math.PI, Math.PI * 2);
  ctx.bezierCurveTo(19, 14.25, 12, 22, 12, 22);
  ctx.closePath();
  // A rim in the land's colour first, so the pin stands off terrain,
  // borders and names alike; the fill then covers its inner half.
  ctx.lineJoin = "round";
  ctx.lineWidth = 3 / s;
  ctx.strokeStyle = palette.land;
  ctx.stroke();
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(12, 9, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = palette.land;
  ctx.fill();
  ctx.restore();
}
