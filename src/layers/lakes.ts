import { fillRings } from "./filled.ts";
import type { DrawContext, LayerDef } from "./registry.ts";

/** Lakes, filled in the water colour; an island is a ring inside its lake. */
function draw(dc: DrawContext): void {
  const lakes = dc.store.lakes;
  if (lakes === undefined) return;
  fillRings(dc, "lakes", lakes.rings, lakes.lake, lakes.boxes, dc.palette.water);
}

export const lakesLayer: LayerDef = {
  id: "lakes",
  icon: "mdi:water",
  minScale: 0,
  // Cut at the border. The source is Austria's alone, so the Neusiedler See
  // and the Bodensee end where the country does, and the clip makes that
  // edge the border's own line.
  clipped: true,
  chunks: () => ["lakes"],
  draw,
};
