/**
 * The pictogram of the Autobahn sign (§ 53 Abs. 1 Z 8a StVO): two
 * carriageways running to the horizon under a bridge. Drawn from its
 * geometry, as the pin is, so the browser, the preview script and the
 * tests' recording context all draw the same thing.
 */

/** The pictogram's box in pixels. */
export const SIGN_WIDTH = 16;
export const SIGN_HEIGHT = 11;

/**
 * Draw the pictogram with its top left corner at a point given in screen
 * pixels: `ink` for the roads and the bridge, `ground` for the sign behind
 * them, which shows where the roads pass under the bridge.
 */
export function drawAutobahnSign(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  ink: string,
  ground: string,
): void {
  ctx.save();
  ctx.translate(left, top);
  // The two carriageways: wide and apart at the foot, meeting at the horizon.
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(2.2, 11);
  ctx.lineTo(6.5, 11);
  ctx.lineTo(7.6, 0);
  ctx.lineTo(6.7, 0);
  ctx.closePath();
  ctx.moveTo(13.8, 11);
  ctx.lineTo(9.5, 11);
  ctx.lineTo(8.4, 0);
  ctx.lineTo(9.3, 0);
  ctx.closePath();
  ctx.fill();
  // The bridge across them, with a strip of the sign above and below it.
  ctx.fillStyle = ground;
  ctx.fillRect(0, 2.4, 16, 3.8);
  ctx.fillStyle = ink;
  ctx.fillRect(0.4, 3.2, 15.2, 1.7);
  ctx.fillRect(0.4, 4.9, 1.5, 2.2);
  ctx.fillRect(14.1, 4.9, 1.5, 2.2);
  ctx.restore();
}
