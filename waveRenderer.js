const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 position = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D profile;
uniform vec2 resolution;
uniform bool portrait;
uniform vec3 base;
uniform vec3 reflection;
out vec4 color;
void main() {
  vec2 pixel = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);
  float along = portrait ? pixel.y : pixel.x;
  float across = portrait ? pixel.x : pixel.y;
  int length = int(portrait ? resolution.y : resolution.x);
  float breadth = portrait ? resolution.x : resolution.y;
  int index = clamp(int(along), 0, length - 1);
  float edge = texelFetch(profile, ivec2(index, 0), 0).r;
  float before = texelFetch(profile, ivec2(max(0, index - 1), 0), 0).r;
  float after = texelFetch(profile, ivec2(min(length - 1, index + 1), 0), 0).r;
  float slope = (after - before) * 0.5;
  float distance = across - edge;
  float absolute = abs(distance) * 900.0 / breadth / sqrt(1.0 + slope * slope);
  vec4 light = texelFetch(profile, ivec2(index, 1), 0);
  float progress = along / float(length);
  float litSide = smoothstep(0.35, 0.65, progress);
  float surface = distance < 0.0 ? 1.0 - litSide : litSide;
  float spread = (0.35 + 0.65 * abs(cos(progress * 3.14159265359))) * (1.0 + light.a * 0.28);
  float broad = 0.82 * exp(-pow(absolute / 145.0, 2.0)) + 0.16 * exp(-pow(absolute / 20.0, 2.0));
  float rim = 0.24 * exp(-pow(absolute / 22.0, 2.0)) + 0.74 * exp(-pow(absolute / 7.0, 2.0));
  float diffuse = (broad - rim) * surface * spread;
  float shade = 0.18 * surface * min(1.0, absolute / 24.0) * (1.0 - rim - diffuse);
  vec3 reflected = light.rgb * 0.35 + reflection * 0.65;
  color = vec4(base + (vec3(128.0 / 255.0) - base) * shade +
    (light.rgb - base) * rim + (reflected - base) * diffuse, 1.0);
}`

export function createWaveRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false })
  if (!gl) throw new Error('The 4K wave background requires WebGL 2.')
  const shaders = []
  const program = gl.createProgram()
  const texture = gl.createTexture()
  const dispose = () => {
    gl.deleteTexture(texture)
    gl.deleteProgram(program)
    shaders.forEach((shader) => gl.deleteShader(shader))
  }
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX_SHADER], [gl.FRAGMENT_SHADER, FRAGMENT_SHADER]]) {
      const shader = gl.createShader(type)
      shaders.push(shader)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader))
      gl.attachShader(program, shader)
    }
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
  } catch (error) {
    dispose()
    throw error
  }
  gl.useProgram(program)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const uniforms = Object.fromEntries(['resolution', 'portrait', 'base', 'reflection'].map((name) =>
    [name, gl.getUniformLocation(program, name)]))
  const maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))
  if (maxSize < 3840) console.warn(`Wave resolution is limited to ${maxSize}px by this device.`)
  return {
    resize(width, height) {
      const scale = Math.min(3840 / Math.max(width, height), 2160 / Math.min(width, height), maxSize / Math.max(width, height))
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
      gl.uniform1i(uniforms.portrait, height > width ? 1 : 0)
      const length = Math.max(canvas.width, canvas.height)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, length, 2, 0, gl.RGBA, gl.FLOAT, null)
      return new Float32Array(length * 8)
    },
    paint(profile, colors) {
      gl.uniform3fv(uniforms.base, Array.from(colors.base, (value) => value / 255))
      gl.uniform3fv(uniforms.reflection, Array.from(colors.b, (value) => value / 255))
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, profile.length / 8, 2, gl.RGBA, gl.FLOAT, profile)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose,
  }
}
