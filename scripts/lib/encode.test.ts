/** The packed strings, written here and read back by the card's own reader. */
import { describe, expect, it } from "vite-plus/test";

import {
  concatLines,
  decodeInts,
  decodeLines,
  lineBoxes,
  packChar,
} from "../../src/data/format.ts";
import { encodeInts, encodeLines, encodePoints } from "./encode.ts";

describe("packed integers", () => {
  it("round-trips small, large and negative values", () => {
    const values = [
      0, 1, -1, 22, -23, 23, 45, 46, -46, 2115, 2116, 97335, 97336, -97337, 9_215_956,
      -2_000_000_000,
    ];
    expect([...decodeInts(encodeInts(values))]).toEqual(values);
  });

  it("spends one character on a small step and two on a middling one", () => {
    expect(encodeInts([22])).toHaveLength(1);
    expect(encodeInts([-23])).toHaveLength(1);
    expect(encodeInts([23])).toHaveLength(2);
    expect(encodeInts([-1058])).toHaveLength(2);
    expect(encodeInts([1058])).toHaveLength(3);
  });

  it("uses 92 distinct characters, none of which needs escaping in a JS string", () => {
    const alphabet = Array.from({ length: 92 }, (_, value) => packChar(value));
    expect(new Set(alphabet).size).toBe(92);
    for (const char of alphabet) {
      expect(char).toMatch(/^[!-~]$/);
      expect(char).not.toBe('"');
      expect(char).not.toBe("\\");
    }
    expect(JSON.stringify(alphabet.join(""))).toBe(`"${alphabet.join("")}"`);
  });

  it("reads an empty string as no values", () => {
    expect(decodeInts("")).toHaveLength(0);
  });

  it("refuses a fraction", () => {
    expect(() => encodeInts([1.5])).toThrow(/not an integer/);
  });
});

describe("packed lines", () => {
  const lines = [
    [
      [10, 20],
      [10.5, 20.25],
      [400, 300.1],
    ],
    [
      [999.9, 0.1],
      [0, 529.9],
    ],
  ] as const;

  it("round-trips open lines to within half a grid step", () => {
    const decoded = decodeLines(encodeLines(lines, 0.05, { closed: false }));
    expect(decoded.count).toBe(2);
    expect([...decoded.start]).toEqual([0, 3, 5]);
    const flat = lines.flat();
    flat.forEach(([x, y], index) => {
      expect(decoded.xy[index * 2]).toBeCloseTo(x, 1);
      expect(Math.abs((decoded.xy[index * 2] as number) - x)).toBeLessThanOrEqual(0.0251);
      expect(Math.abs((decoded.xy[index * 2 + 1] as number) - y)).toBeLessThanOrEqual(0.0251);
    });
  });

  it("prints a vertex two lines share at exactly the same place", () => {
    const shared = [123.456, 78.912] as const;
    const decoded = decodeLines(
      encodeLines(
        [
          [[1, 1], [50.03, 60.07], shared],
          [shared, [300, 2]],
        ],
        0.05,
        { closed: false },
      ),
    );
    expect(decoded.xy[4]).toBe(decoded.xy[6]);
    expect(decoded.xy[5]).toBe(decoded.xy[7]);
  });

  it("drops points that land on their predecessor, and lines that then draw nothing", () => {
    const packed = encodeLines(
      [
        [
          [1, 1],
          [1.01, 1.01],
          [2, 2],
        ],
        [
          [5, 5],
          [5.01, 5],
        ],
      ],
      0.1,
      { closed: false },
    );
    const decoded = decodeLines(packed);
    expect(decoded.count).toBe(1);
    expect(decoded.xy).toHaveLength(4);
  });

  it("keeps a collapsed line as two points when asked to, so parallel tables stay aligned", () => {
    const decoded = decodeLines(
      encodeLines(
        [
          [
            [5, 5],
            [5.01, 5],
          ],
          [
            [7, 7],
            [9, 9],
          ],
        ],
        0.1,
        { closed: false, keepShort: true },
      ),
    );
    expect(decoded.count).toBe(2);
    expect(Array.from(decoded.xy.slice(0, 4))).toEqual([5, 5, 5, 5]);
  });

  it("stores a ring without its repeated first point", () => {
    const ring = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 0],
    ] as const;
    const decoded = decodeLines(encodeLines([ring], 0.5, { closed: true }));
    expect(decoded.closed).toBe(true);
    expect([...decoded.xy]).toEqual([0, 0, 4, 0, 4, 4]);
  });

  it("drops a ring that rounds to fewer than three corners", () => {
    expect(
      encodeLines(
        [
          [
            [0, 0],
            [0.01, 0],
            [0, 0.01],
          ],
        ],
        0.5,
        { closed: true },
      ).n,
    ).toBe(0);
  });

  it("packs table points as one line and keeps every one of them", () => {
    const points = [
      [1, 1],
      [1, 1],
      [500.05, 200],
    ] as const;
    const decoded = decodeLines(encodePoints(points, 0.05));
    expect(decoded.count).toBe(1);
    expect(decoded.xy).toHaveLength(6);
    expect(decoded.xy[4]).toBeCloseTo(500.05, 3);
  });

  it("notices a damaged string", () => {
    const packed = encodeLines(lines, 0.05, { closed: false });
    expect(() => decodeLines({ ...packed, n: 3 })).toThrow();
  });

  it("joins two sets and measures each line's box", () => {
    const first = decodeLines(
      encodeLines(
        [
          [
            [0, 0],
            [2, 1],
          ],
        ],
        0.5,
        { closed: false },
      ),
    );
    const second = decodeLines(
      encodeLines(
        [
          [
            [5, 5],
            [3, 9],
            [4, 4],
          ],
        ],
        0.5,
        { closed: false },
      ),
    );
    const both = concatLines(first, second);
    expect(both.count).toBe(2);
    expect([...both.start]).toEqual([0, 2, 5]);
    expect([...lineBoxes(both)]).toEqual([0, 0, 2, 1, 3, 4, 5, 9]);
  });
});
