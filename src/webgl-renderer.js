const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_uv;

uniform vec2 u_resolution;
uniform int u_mirror;

varying vec2 v_uv;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  v_uv = u_mirror == 1 ? vec2(1.0 - a_uv.x, a_uv.y) : a_uv;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_video;
uniform int u_mode;
uniform int u_region;
uniform int u_filtered;
uniform vec2 u_texel;
uniform float u_time;

varying vec2 v_uv;

vec3 sampleVideo(vec2 uv) {
  return texture2D(u_video, clamp(uv, 0.0, 1.0)).rgb;
}

float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float edgeMask(vec2 uv) {
  vec3 center = sampleVideo(uv);
  vec3 right = sampleVideo(uv + vec2(u_texel.x * 2.4, 0.0));
  vec3 down = sampleVideo(uv + vec2(0.0, u_texel.y * 2.4));
  return smoothstep(0.12, 0.44, length(center - right) + length(center - down));
}

float halftone(vec2 uv, float scale) {
  vec2 cell = fract(uv * scale) - 0.5;
  float shade = luminance(sampleVideo(uv));
  float dotSize = 0.36 * (1.0 - shade) + 0.05;
  return 1.0 - smoothstep(dotSize, dotSize + 0.018, length(cell));
}

float diagonalLines(vec2 uv, float scale, float width) {
  float line = abs(fract((uv.x + uv.y + u_time * 0.18) * scale) - 0.5);
  return 1.0 - smoothstep(width, width + 0.014, line);
}

vec3 halftonePop(vec2 uv) {
  vec3 color = sampleVideo(uv);
  float dots = halftone(uv + vec2(float(u_region) * 0.023, 0.0), 72.0);
  float edge = edgeMask(uv);
  vec3 poster = floor(pow(color, vec3(0.76)) * 4.0) / 3.0;
  vec3 paperYellow = vec3(1.0, 0.9, 0.18);
  vec3 magentaBlue = poster * vec3(1.3, 0.72, 1.62);
  vec3 pop = mix(magentaBlue, paperYellow, dots * 0.5);
  return mix(pop, vec3(0.0, 0.0, 0.03), edge * 0.78);
}

vec3 chromaticPunch(vec2 uv) {
  float wave = sin((uv.y + u_time * 0.7 + float(u_region) * 0.13) * 104.0) * 0.01;
  float block = step(0.83, fract((uv.y + u_time * 0.28) * 20.0)) * 0.028;
  vec2 shift = vec2(wave + block, 0.0);
  float r = sampleVideo(uv + shift).r;
  float g = sampleVideo(uv).g;
  float b = sampleVideo(uv - shift).b;
  float edge = edgeMask(uv);
  float scan = diagonalLines(uv, 44.0, 0.026);
  return vec3(r, g, b) * vec3(1.44, 1.08, 1.62) + vec3(scan * 0.2, edge * 0.12, edge * 0.42);
}

vec3 inkBurst(vec2 uv) {
  vec3 color = sampleVideo(uv);
  float value = luminance(color);
  float edge = edgeMask(uv);
  float hatchA = diagonalLines(uv, 60.0, 0.022);
  float hatchB = diagonalLines(vec2(uv.x, 1.0 - uv.y), 46.0, 0.018);
  vec3 paper = vec3(1.0, 0.91, 0.72);
  vec3 ink = vec3(0.015, 0.012, 0.026);
  vec3 wash = mix(vec3(0.78, 0.06, 0.22), vec3(0.08, 0.16, 0.95), smoothstep(0.18, 0.88, value));
  float lines = max(edge, max(hatchA, hatchB) * (1.0 - value));
  return mix(mix(paper, wash, 0.58), ink, clamp(lines * 1.14, 0.0, 1.0));
}

vec3 speedLines(vec2 uv) {
  vec3 color = sampleVideo(uv);
  vec2 center = vec2(0.5, 0.48);
  vec2 delta = uv - center;
  float angle = atan(delta.y, delta.x);
  float radius = length(delta);
  float rays = 1.0 - smoothstep(0.018, 0.052, abs(fract((angle + u_time * 0.75) * 8.0 + radius * 18.0) - 0.5));
  float edge = edgeMask(uv);
  vec3 poster = floor(color * 5.0) / 4.0;
  return poster * vec3(0.82, 1.22, 1.45) + vec3(rays * 0.45, rays * 0.34, rays * 0.08) + vec3(edge * 0.12);
}

vec3 posterHeat(vec2 uv) {
  vec3 color = sampleVideo(uv);
  float value = luminance(color);
  vec3 cold = vec3(0.02, 0.12, 0.72);
  vec3 mid = vec3(0.0, 0.88, 0.48);
  vec3 hot = vec3(1.0, 0.12, 0.04);
  vec3 heatColor = mix(cold, mid, smoothstep(0.0, 0.58, value));
  heatColor = mix(heatColor, hot, smoothstep(0.52, 1.0, value));
  float dots = halftone(uv * vec2(1.2, 1.0), 52.0);
  float edge = edgeMask(uv);
  return floor(heatColor * 5.0) / 4.0 + vec3(dots * 0.14) - vec3(edge * 0.24, edge * 0.12, 0.0);
}

vec3 mangaScreen(vec2 uv) {
  vec3 color = sampleVideo(uv);
  float value = luminance(color);
  float dotsFine = halftone(uv + vec2(0.01 * sin(u_time), 0.0), 96.0);
  float dotsLarge = halftone(uv * vec2(0.72, 1.18), 38.0);
  float hatch = diagonalLines(vec2(uv.x * 1.4, uv.y), 72.0, 0.018) * (1.0 - value);
  float ink = max(edgeMask(uv), max(dotsFine * (1.0 - value), dotsLarge * 0.38));
  vec3 paper = vec3(0.98, 0.96, 0.9);
  return mix(paper, vec3(0.03), clamp(ink + hatch * 0.45, 0.0, 1.0));
}

vec3 noirInk(vec2 uv) {
  vec3 color = sampleVideo(uv);
  float value = luminance(color);
  float edge = edgeMask(uv);
  float threshold = smoothstep(0.36, 0.62, value + sin((uv.x - uv.y) * 110.0) * 0.035);
  vec3 ink = mix(vec3(0.0, 0.0, 0.015), vec3(0.92, 0.9, 0.82), threshold);
  return mix(ink, vec3(0.0), edge * 0.9);
}

vec3 comicPanel(vec2 uv) {
  vec3 color = sampleVideo(uv);
  vec2 grid = abs(fract(uv * vec2(5.0, 3.0)) - 0.5);
  float panelLine = 1.0 - smoothstep(0.018, 0.034, min(grid.x, grid.y));
  float burst = diagonalLines(uv + vec2(sin(u_time) * 0.015, 0.0), 34.0, 0.02);
  vec3 poster = floor(color * 4.0) / 3.0;
  vec3 panelColor = poster * vec3(1.18, 0.9, 0.72) + vec3(burst * 0.18, burst * 0.08, 0.0);
  return mix(panelColor, vec3(0.02), max(panelLine, edgeMask(uv) * 0.55));
}

vec3 popArt(vec2 uv) {
  vec3 color = sampleVideo(uv);
  float value = luminance(color);
  float dots = halftone(uv + vec2(float(u_region) * 0.04, u_time * 0.015), 64.0);
  vec3 a = vec3(1.0, 0.05, 0.28);
  vec3 b = vec3(0.0, 0.72, 1.0);
  vec3 c = vec3(1.0, 0.92, 0.05);
  vec3 d = vec3(0.08, 0.02, 0.16);
  vec3 palette = mix(mix(a, b, step(0.32, value)), mix(c, d, step(0.78, value)), step(0.56, value));
  return mix(palette, vec3(0.02), edgeMask(uv) * 0.78) + dots * vec3(0.12);
}

void main() {
  vec3 color = sampleVideo(v_uv);

  if (u_filtered == 1) {
    if (u_mode == 0) {
      color = halftonePop(v_uv);
    } else if (u_mode == 1) {
      color = chromaticPunch(v_uv);
    } else if (u_mode == 2) {
      color = inkBurst(v_uv);
    } else if (u_mode == 3) {
      color = speedLines(v_uv);
    } else if (u_mode == 4) {
      color = posterHeat(v_uv);
    } else if (u_mode == 5) {
      color = mangaScreen(v_uv);
    } else if (u_mode == 6) {
      color = noirInk(v_uv);
    } else if (u_mode == 7) {
      color = comicPanel(v_uv);
    } else {
      color = popArt(v_uv);
    }
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed");
  }

  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Shader link failed");
  }

  return program;
}

export class FingerMagicRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      preserveDrawingBuffer: false
    });

    if (!this.gl) {
      throw new Error("WebGL is not available in this browser.");
    }

    const gl = this.gl;
    this.program = createProgram(gl);
    this.positionBuffer = gl.createBuffer();
    this.uvBuffer = gl.createBuffer();
    this.texture = gl.createTexture();

    this.locations = {
      position: gl.getAttribLocation(this.program, "a_position"),
      uv: gl.getAttribLocation(this.program, "a_uv"),
      resolution: gl.getUniformLocation(this.program, "u_resolution"),
      mirror: gl.getUniformLocation(this.program, "u_mirror"),
      video: gl.getUniformLocation(this.program, "u_video"),
      mode: gl.getUniformLocation(this.program, "u_mode"),
      region: gl.getUniformLocation(this.program, "u_region"),
      filtered: gl.getUniformLocation(this.program, "u_filtered"),
      texel: gl.getUniformLocation(this.program, "u_texel"),
      time: gl.getUniformLocation(this.program, "u_time")
    };

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  render({ video, quads }) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.02, 0.02, 0.03, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    gl.uniform1i(this.locations.video, 0);
    gl.uniform2f(this.locations.resolution, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.locations.texel, 1 / video.videoWidth, 1 / video.videoHeight);
    gl.uniform1f(this.locations.time, performance.now() / 1000);

    this.drawFullFrame();

    for (let index = 0; index < quads.length; index += 1) {
      this.drawQuad(quads[index].points, quads[index].effectIndex, index);
    }
  }

  drawFullFrame() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const positions = new Float32Array([
      0, 0,
      width, 0,
      0, height,
      0, height,
      width, 0,
      width, height
    ]);
    const uvs = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1
    ]);

    this.drawTriangles(positions, uvs, { filtered: false, mirror: true });
  }

  drawQuad(points, effectIndex, regionIndex) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const toCanvas = (point) => [(1 - point.x) * width, point.y * height];
    const [a, b, c, d] = points.map(toCanvas);

    const positions = new Float32Array([
      ...a,
      ...b,
      ...d,
      ...d,
      ...b,
      ...c
    ]);

    const uvs = new Float32Array([
      points[0].x, points[0].y,
      points[1].x, points[1].y,
      points[3].x, points[3].y,
      points[3].x, points[3].y,
      points[1].x, points[1].y,
      points[2].x, points[2].y
    ]);

    this.drawTriangles(positions, uvs, {
      filtered: true,
      mirror: false,
      mode: effectIndex,
      region: regionIndex
    });
  }

  drawTriangles(positions, uvs, { filtered, mirror, mode = 0, region = 0 }) {
    const gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.locations.uv);
    gl.vertexAttribPointer(this.locations.uv, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1i(this.locations.filtered, filtered ? 1 : 0);
    gl.uniform1i(this.locations.mirror, mirror ? 1 : 0);
    gl.uniform1i(this.locations.mode, mode);
    gl.uniform1i(this.locations.region, region);
    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);
  }
}
