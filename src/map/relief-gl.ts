/**
 * Draws the tilted map with WebGL 2: the relief as a mesh, with the flat
 * map laid over it like a cloth.
 *
 * The heights go up once, as a float texture of one texel per cell. There
 * is no vertex buffer: each instance is one row of the grid drawn as a
 * triangle strip, and the vertex shader works out its cell from the vertex
 * and instance number, reads the height there and the slope round it. So a
 * 1000 × 530 grid costs one texture and one draw call, and drawing every
 * second cell for the whole-country view is a uniform.
 *
 * The "cloth" is the flat map's fills, drawn by the 2D renderer into a
 * canvas of its own: land, terrain, a selected area. Borders and rivers are
 * lines of their own (relief-lines.ts), drawn a constant number of pixels
 * wide however far the cloth is magnified. The names and the pin are drawn
 * over it all in screen pixels, upright, by the card's own canvas.
 *
 * Without WebGL 2 `create` returns null and the card stays flat.
 */
import type { Relief } from "../layers/store.ts";
import type { LineSet } from "./relief-lines.ts";
import { MAP_HEIGHT, MAP_WIDTH } from "./projection.ts";
import { METRES_PER_UNIT, type View3D } from "./view3d.ts";

const VERTEX = `#version 300 es
uniform highp sampler2D u_height;
uniform mat4 u_matrix;
uniform int u_stride;
uniform ivec2 u_grid;
uniform float u_zscale;
uniform vec2 u_map;
out vec2 v_uv;
out vec3 v_normal;

float heightAt(ivec2 cell) {
  return texelFetch(u_height, clamp(cell, ivec2(0), u_grid - 1), 0).r * u_zscale;
}

void main() {
  ivec2 cell = ivec2((gl_VertexID >> 1) * u_stride, (gl_InstanceID + (gl_VertexID & 1)) * u_stride);
  cell = min(cell, u_grid - 1);
  vec2 at = vec2(cell) + 0.5;
  ivec2 dx = ivec2(u_stride, 0);
  ivec2 dy = ivec2(0, u_stride);
  float run = 2.0 * float(u_stride);
  v_normal = vec3(
    (heightAt(cell - dx) - heightAt(cell + dx)) / run,
    (heightAt(cell - dy) - heightAt(cell + dy)) / run,
    1.0
  );
  v_uv = at / u_map;
  gl_Position = u_matrix * vec4(at, heightAt(cell), 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision mediump float;
uniform sampler2D u_drape;
uniform vec3 u_light;
uniform float u_shade;
in vec2 v_uv;
in vec3 v_normal;
out vec4 colour;

void main() {
  vec4 map = texture(u_drape, v_uv);
  // Abroad: the flat map draws nothing there.
  if (map.a < 0.5) discard;
  float light = dot(normalize(v_normal), u_light);
  // Flat ground keeps its colour; slopes facing the light brighten, the
  // others darken.
  float shade = 1.0 + u_shade * (light - u_light.z);
  colour = vec4(map.rgb / map.a * shade, 1.0);
}
`;

// A line is a segment instance, drawn as a quad of four corners. Both ends
// are set on the ground exactly as the mesh has it: the same cells, the same
// split of each cell into two triangles, at the same stride. (A smooth
// interpolation instead differs from the mesh by up to hundreds of metres
// on a steep slope, and the line sinks into the mountain in pieces.) The
// ends are then projected and pushed apart sideways on screen by half the
// width and a pixel more for the soft edge.
const LINE_VERTEX = `#version 300 es
uniform highp sampler2D u_height;
uniform mat4 u_matrix;
uniform ivec2 u_grid;
uniform int u_stride;
uniform float u_zscale;
uniform float u_lift;
uniform vec2 u_half;
uniform float u_width;
in vec4 a_segment;
out float v_across;

float texel(ivec2 cell) {
  return texelFetch(u_height, clamp(cell, ivec2(0), u_grid - 1), 0).r;
}

float groundAt(vec2 at) {
  float s = float(u_stride);
  vec2 f = (at - 0.5) / s;
  vec2 base = floor(f);
  vec2 t = f - base;
  ivec2 c = ivec2(base) * u_stride;
  ivec2 right = ivec2(u_stride, 0);
  ivec2 down = ivec2(0, u_stride);
  // The mesh's strip runs top, bottom, top, bottom: its triangles meet on
  // the diagonal from the bottom-left corner to the top-right one.
  float h;
  if (t.x + t.y <= 1.0) {
    float h00 = texel(c);
    h = h00 + (texel(c + right) - h00) * t.x + (texel(c + down) - h00) * t.y;
  } else {
    float h11 = texel(c + right + down);
    h = h11 + (texel(c + down) - h11) * (1.0 - t.x) + (texel(c + right) - h11) * (1.0 - t.y);
  }
  return h * u_zscale + u_lift;
}

void main() {
  float along = float(gl_VertexID >> 1);
  float side = float(gl_VertexID & 1) * 2.0 - 1.0;
  vec4 a = u_matrix * vec4(a_segment.xy, groundAt(a_segment.xy), 1.0);
  vec4 b = u_matrix * vec4(a_segment.zw, groundAt(a_segment.zw), 1.0);
  if (a.w <= 0.0 || b.w <= 0.0) {
    // Behind the eye: nothing to draw.
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_across = 0.0;
    return;
  }
  vec2 sa = a.xy / a.w * u_half;
  vec2 sb = b.xy / b.w * u_half;
  vec2 d = sb - sa;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);
  float reach = u_width * 0.5 + 1.0;
  vec4 end = along > 0.5 ? b : a;
  vec2 at = (along > 0.5 ? sb : sa) + normal * side * reach + dir * (along * 2.0 - 1.0) * u_width * 0.5;
  v_across = side * reach;
  gl_Position = vec4(at / u_half * end.w, end.z, end.w);
}
`;

const LINE_FRAGMENT = `#version 300 es
// highp: u_width is shared with the vertex shader, and a uniform must have
// the same precision in both or the program does not link.
precision highp float;
uniform vec3 u_colour;
uniform float u_width;
in float v_across;
out vec4 colour;

void main() {
  // Full inside the line, fading over the last pixel: lines thinner than a
  // pixel come out fainter, not jagged.
  float cover = clamp(u_width * 0.5 + 0.5 - abs(v_across), 0.0, 1.0) * min(u_width, 1.0);
  if (cover <= 0.0) discard;
  colour = vec4(u_colour * cover, cover);
}
`;

/** Where a cell is under a pixel wide, every second one is enough. */
const meshStride = (view: View3D): number => (view.scale < 1 ? 2 : 1);

/** The shader pairs, for the tests: a browser is the only place they compile. */
export const SHADERS = {
  relief: { vertex: VERTEX, fragment: FRAGMENT },
  lines: { vertex: LINE_VERTEX, fragment: LINE_FRAGMENT },
} as const;

interface LineBuffer {
  readonly vao: WebGLVertexArrayObject;
  readonly buffer: WebGLBuffer;
  readonly count: number;
}

/** Light from the north-west, 40° above the horizon: the hill-shading of every atlas. */
const LIGHT = (() => {
  const altitude = (40 * Math.PI) / 180;
  const v = [
    -Math.cos(altitude) / Math.SQRT2,
    -Math.cos(altitude) / Math.SQRT2,
    Math.sin(altitude),
  ];
  return new Float32Array(v);
})();

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  if (program === null) throw new Error("no program");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program: ${gl.getProgramInfoLog(program) ?? "did not link"}`);
  }
  return program;
}

const locations = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: readonly string[],
): Record<string, WebGLUniformLocation | null> =>
  Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (shader === null) throw new Error("no shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(shader) ?? "did not compile"}`);
  }
  return shader;
}

export class ReliefGL {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly lineProgram: WebGLProgram;
  private readonly lineUniforms: Record<string, WebGLUniformLocation | null>;
  /** Segment buffers by LineSet key; the data never changes once loaded. */
  private readonly lines = new Map<string, LineBuffer>();
  private readonly heights: WebGLTexture;
  private readonly drape: WebGLTexture;
  private readonly uniforms: Record<string, WebGLUniformLocation | null>;
  private relief: Relief | undefined;
  private drapeKey = "";
  private lostContext = false;

  /** A renderer on the canvas, or null where WebGL 2 is not available. */
  public static create(canvas: HTMLCanvasElement): ReliefGL | null {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true });
    } catch {
      gl = null;
    }
    if (gl === null || !(gl instanceof WebGL2RenderingContext)) return null;
    try {
      return new ReliefGL(canvas, gl);
    } catch (error) {
      console.warn("[austria-map-card] no 3D view:", error);
      return null;
    }
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.gl = gl;
    const program = link(gl, VERTEX, FRAGMENT);
    this.program = program;
    this.uniforms = locations(gl, program, [
      "u_height",
      "u_matrix",
      "u_stride",
      "u_grid",
      "u_zscale",
      "u_map",
      "u_drape",
      "u_light",
      "u_shade",
    ]);
    this.lineProgram = link(gl, LINE_VERTEX, LINE_FRAGMENT);
    this.lineUniforms = locations(gl, this.lineProgram, [
      "u_height",
      "u_matrix",
      "u_grid",
      "u_stride",
      "u_zscale",
      "u_lift",
      "u_half",
      "u_width",
      "u_colour",
    ]);
    const texture = (): WebGLTexture => {
      const made = gl.createTexture();
      if (made === null) throw new Error("no texture");
      return made;
    };
    this.heights = texture();
    this.drape = texture();
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.lostContext = true;
    });
  }

  /** True once the browser took the GPU back; the card goes flat. */
  public get lost(): boolean {
    return this.lostContext || this.gl.isContextLost();
  }

  public get hasRelief(): boolean {
    return this.relief !== undefined;
  }

  public setRelief(relief: Relief): void {
    if (this.relief === relief) return;
    const { gl } = this;
    this.relief = relief;
    gl.bindTexture(gl.TEXTURE_2D, this.heights);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      relief.columns,
      relief.rows,
      0,
      gl.RED,
      gl.FLOAT,
      relief.metres,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  /** Lay a new flat map over the relief, unless it is the one already there. */
  public setDrape(image: TexImageSource, key: string): void {
    if (key === this.drapeKey) return;
    const { gl } = this;
    this.drapeKey = key;
    gl.bindTexture(gl.TEXTURE_2D, this.drape);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Ground seen at a grazing angle stays sharp with anisotropic filtering.
    const anisotropic = gl.getExtension("EXT_texture_filter_anisotropic");
    if (anisotropic !== null) {
      const most = gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number;
      gl.texParameterf(gl.TEXTURE_2D, anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, most));
    }
  }

  /** Size the drawing buffer to the canvas's CSS size. */
  public resize(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    devicePixelRatio: number,
  ): void {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  public clear(): void {
    const { gl } = this;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  private lineBuffer(set: LineSet): LineBuffer | null {
    const known = this.lines.get(set.key);
    if (known !== undefined) return known;
    const { gl } = this;
    const segments = set.segments();
    if (segments.length === 0) return null;
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (vao === null || buffer === null) return null;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, segments, gl.STATIC_DRAW);
    const location = gl.getAttribLocation(this.lineProgram, "a_segment");
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(location, 1);
    gl.bindVertexArray(null);
    const made = { vao, buffer, count: segments.length / 4 };
    this.lines.set(set.key, made);
    return made;
  }

  /** Lines on the ground: depth-tested against the relief, never writing depth themselves. */
  private drawLines(view: View3D, sets: readonly LineSet[]): void {
    const { gl, relief, lineUniforms: u } = this;
    if (relief === undefined || sets.length === 0) return;
    const dpr = gl.drawingBufferHeight / Math.max(view.size.height, 1);
    gl.useProgram(this.lineProgram);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.heights);
    gl.uniform1i(u.u_height!, 0);
    gl.uniformMatrix4fv(u.u_matrix!, false, view.matrix());
    gl.uniform2i(u.u_grid!, relief.columns, relief.rows);
    gl.uniform1i(u.u_stride!, meshStride(view));
    gl.uniform1f(u.u_zscale!, view.stretch / METRES_PER_UNIT);
    // A hair off the ground, so the mesh does not win the depth test against
    // a line lying on it; more the further away, where depth is coarser.
    gl.uniform1f(u.u_lift!, view.distance * 0.0015);
    gl.uniform2f(u.u_half!, gl.drawingBufferWidth / 2, gl.drawingBufferHeight / 2);
    for (const set of sets) {
      const buffer = this.lineBuffer(set);
      if (buffer === null) continue;
      gl.uniform1f(u.u_width!, set.width * dpr);
      gl.uniform3f(u.u_colour!, set.colour[0] / 255, set.colour[1] / 255, set.colour[2] / 255);
      gl.bindVertexArray(buffer.vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, buffer.count);
    }
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
  }

  /** Draw a frame. Nothing until both the relief and a drape are there. */
  public draw(view: View3D, lines: readonly LineSet[] = []): void {
    const { gl, relief, uniforms: u } = this;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    this.clear();
    if (relief === undefined || this.drapeKey === "" || this.lost) return;
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.heights);
    gl.uniform1i(u.u_height!, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.drape);
    gl.uniform1i(u.u_drape!, 1);
    const stride = meshStride(view);
    gl.uniformMatrix4fv(u.u_matrix!, false, view.matrix());
    gl.uniform1i(u.u_stride!, stride);
    gl.uniform2i(u.u_grid!, relief.columns, relief.rows);
    gl.uniform1f(u.u_zscale!, view.stretch / METRES_PER_UNIT);
    gl.uniform2f(u.u_map!, MAP_WIDTH, MAP_HEIGHT);
    gl.uniform3fv(u.u_light!, LIGHT);
    gl.uniform1f(u.u_shade!, 0.45);
    const across = Math.ceil((relief.columns - 1) / stride) + 1;
    const strips = Math.ceil((relief.rows - 1) / stride);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, across * 2, strips);
    gl.disable(gl.DEPTH_TEST);
    this.drawLines(view, lines);
  }
}
