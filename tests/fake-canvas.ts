/**
 * A stand-in 2D context and Path2D for node and happy-dom, neither of which
 * paints. Every context method is a recorded no-op; `measureText` returns a
 * width of six pixels a character. A call's record carries the fill and
 * stroke style in force when it was made, so a test can ask what was drawn
 * in which colour and in which order.
 */
export interface Call {
  readonly name: string;
  readonly args: unknown[];
  readonly fillStyle: unknown;
  readonly strokeStyle: unknown;
  readonly lineWidth: unknown;
}

export class FakePath {
  public readonly ops: string[] = [];
  public moveTo(): void {
    this.ops.push("M");
  }
  public lineTo(): void {
    this.ops.push("L");
  }
  public quadraticCurveTo(): void {
    this.ops.push("Q");
  }
  public closePath(): void {
    this.ops.push("Z");
  }
}

export interface FakeContext {
  readonly calls: Call[];
  readonly ctx: CanvasRenderingContext2D;
  /** Every text drawn with fillText, in order. */
  texts(): string[];
  /** The calls of one method. */
  named(name: string): Call[];
  reset(): void;
}

export function fakeContext(): FakeContext {
  const calls: Call[] = [];
  const state: Record<string | symbol, unknown> = {
    measureText: (text: string) => ({ width: text.length * 6 }),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    letterSpacing: "0px",
  };
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        calls.push({
          name: String(key),
          args,
          fillStyle: target.fillStyle,
          strokeStyle: target.strokeStyle,
          lineWidth: target.lineWidth,
        });
      };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
    has(target, key) {
      return key in target;
    },
  }) as unknown as CanvasRenderingContext2D;
  return {
    calls,
    ctx,
    texts: () => calls.filter((call) => call.name === "fillText").map((call) => String(call.args[0])),
    named: (name) => calls.filter((call) => call.name === name),
    reset: () => {
      calls.length = 0;
    },
  };
}

export function fakeCanvas(fake: FakeContext): HTMLCanvasElement {
  return { getContext: () => fake.ctx, width: 0, height: 0, style: {} } as unknown as HTMLCanvasElement;
}

export const fakePath = (): Path2D => new FakePath() as unknown as Path2D;
