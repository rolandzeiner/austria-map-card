/** Guards on the stylesheet's text: what a missing rule would cost cannot be
 *  seen in a DOM that does no layout. */
import { describe, expect, it } from "vitest";

import { cardStyles } from "../src/styles.ts";

const css = cardStyles.cssText;

describe("motion", () => {
  it("ends with the reduced-motion catch-all, so no later rule escapes it", () => {
    const block = css.lastIndexOf("@media (prefers-reduced-motion: reduce)");
    expect(block).toBeGreaterThan(0);
    const rest = css.slice(block);
    expect(rest).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(rest).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    // Nothing after the block but its own closing braces.
    expect(css.slice(css.indexOf("}", css.indexOf("scroll-behavior", block))).replace(/[\s}]/g, "")).toBe("");
  });

  it("animates nothing but the layer switch", () => {
    expect(css).not.toMatch(/@keyframes/);
    expect(css.match(/transition:/g)).toHaveLength(2);
  });
});

describe("touch", () => {
  it("lets the page scroll over the whole-country view and takes over only when zoomed in", () => {
    expect(css).toMatch(/canvas\s*{[^}]*touch-action:\s*pan-y/);
    expect(css).toMatch(/canvas\.zoomed\s*{[^}]*touch-action:\s*none/);
  });

  it("makes every control at least 40 px", () => {
    expect(css).toMatch(/--amc-control:\s*40px/);
    expect(css).toMatch(/\.tool,\s*\.icon\s*{[^}]*inline-size:\s*var\(--amc-control\)/);
    expect(css).toMatch(/\.layer\s*{[^}]*min-block-size:\s*var\(--amc-control\)/);
  });
});

describe("focus", () => {
  it("rings the map and every button for keyboard users, in forced colours too", () => {
    expect(css).toMatch(/canvas:focus-visible\s*{[^}]*outline:\s*2px solid/);
    expect(css).toMatch(/button:focus-visible\s*{[^}]*outline:\s*2px solid/);
    expect(css).toMatch(/forced-colors: active/);
  });

  it("shows the crosshair only while the map has keyboard focus", () => {
    expect(css).toMatch(/\.crosshair\s*{[^}]*display:\s*none/);
    expect(css).toMatch(/canvas:focus-visible ~ \.crosshair\s*{[^}]*display:\s*block/);
  });
});

describe("the stage", () => {
  it("has the map's proportions and may be squeezed into a fixed cell", () => {
    expect(css).toMatch(/\.stage\s*{[^}]*aspect-ratio:\s*1000 \/ 530/);
    expect(css).toMatch(/\.stage\s*{[^}]*flex:\s*1 1 auto/);
  });

  it("is never shorter than the column of buttons on it", () => {
    // Without an explicit minimum a flex item cannot shrink below its
    // aspect-ratio height; with a minimum of 0 a narrow card would be
    // shorter than its own toolbar.
    expect(css).toMatch(/\.stage\s*{[^}]*min-block-size:\s*calc\(4 \* var\(--amc-control\)/);
  });
});
