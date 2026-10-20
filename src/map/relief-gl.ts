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
 * The "cloth" is the flat map drawn by the 2D renderer into a canvas of its
 * own, without names: the names and the pin are drawn over the 3D map in
 * screen pixels, upright, by the card's own canvas.
 *
 * Without WebGL 2 `create` returns null and the card stays flat.
 */
import type { Relief } from "../layers/store.ts";
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

/** Light from the north-west, 40° above the horizon: the hill-shading of every atlas. */
const LIGHT = (() => {
  const altitude = (40 * Math.PI) / 180;
  const v = [-Math.cos(altitude) / Math.SQRT2, -Math.cos(altitude) / Math.SQRT2, Math.sin(altitude)];
  return new Float32Array(v);
})();

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
    const program = gl.createProgram();
    if (program === null) throw new Error("no program");
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`program: ${gl.getProgramInfoLog(program) ?? "did not link"}`);
    }
    this.program = program;
    this.uniforms = Object.fromEntries(
      ["u_height", "u_matrix", "u_stride", "u_grid", "u_zscale", "u_map", "u_drape", "u_light", "u_shade"].map(
        (name) => [name, gl.getUniformLocation(program, name)],
      ),
    );
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, relief.columns, relief.rows, 0, gl.RED, gl.FLOAT, relief.metres);
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
  public resize(canvas: HTMLCanvasElement, width: number, height: number, devicePixelRatio: number): void {
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

  /** Draw a frame. Nothing until both the relief and a drape are there. */
  public draw(view: View3D): void {
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
    // Where a cell is under a pixel wide, every second one is enough.
    const stride = view.scale < 1 ? 2 : 1;
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
  }
}
