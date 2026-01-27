import * as THREE from 'three'

export type CreateSkydomeOptions = {
  /** Seed for deterministic procedural details. Typically derived from `starSeed`. */
  seed: number

  /** Radius (world units) of the dome. */
  radiusWorld?: number
}

export function createSkydome(options: CreateSkydomeOptions): {
  object: THREE.Mesh
  syncToCamera: (camera: THREE.Camera) => void
  setTimeSeconds: (t: number) => void
  dispose: () => void
} {
  const radiusWorld = options.radiusWorld ?? 5000

  const geometry = new THREE.SphereGeometry(1, 32, 16)

  // Keep the shader “cheap-ish”:
  // - no derivatives
  // - no dynamic loops
  // - simple hashed value noise
  const vertexShader = /* glsl */ `
    varying vec3 vWorldDir;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldDir = normalize(worldPos.xyz - cameraPosition);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `

  const fragmentShader = /* glsl */ `
    precision highp float;

    uniform float uSeed;
    uniform float uTime;

    varying vec3 vWorldDir;

    const float PI = 3.14159265358979323846264;

    float hash11(float p) {
      // Good enough for visual noise; deterministic across platforms.
      p = fract(p * 0.1031);
      p *= p + 33.33;
      p *= p + p;
      return fract(p);
    }

    float hash21(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    mat3 rotY(float a) {
      float s = sin(a);
      float c = cos(a);
      return mat3(
        c, 0.0, -s,
        0.0, 1.0, 0.0,
        s, 0.0,  c
      );
    }

    vec3 acesApprox(vec3 x) {
      // Tiny, cheap filmic-ish curve.
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    void main() {
      // Direction in world space.
      vec3 dir = normalize(vWorldDir);

      // Rotate the sky deterministically based on seed, so different star seeds
      // also produce different milky way orientations.
      float seed01 = fract(uSeed * 0.000001);
      dir = rotY(seed01 * 2.0 * PI) * dir;

      // Spherical coordinates for 2D noise lookup.
      float u = atan(dir.z, dir.x) / (2.0 * PI) + 0.5;
      float v = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;
      vec2 uv = vec2(u, v);

      // Base gradient (slightly bluer at zenith).
      float up = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 base = mix(vec3(0.03, 0.04, 0.06), vec3(0.01, 0.015, 0.03), up);

      // Define a "galactic plane" using a fixed normal, then add a bit of seeded tilt.
      vec3 planeN = normalize(vec3(0.22, 0.92, 0.32));
      planeN = rotY(seed01 * 1.7 * PI) * planeN;

      float distToPlane = abs(dot(dir, planeN));

      // Milky Way band: concentrated around the plane, with noise modulation.
      float band = exp(-distToPlane * 9.5);
      float bandWide = exp(-distToPlane * 3.5);

      float bandNoise = valueNoise(uv * 6.0 + vec2(seed01 * 97.0, seed01 * 31.0));
      float bandNoise2 = valueNoise(uv * 20.0 + vec2(seed01 * 13.0, seed01 * 53.0));

      float bandMask = band * (0.55 + 0.85 * bandNoise) + 0.25 * bandWide * bandNoise2;
      bandMask = clamp(bandMask, 0.0, 2.0);

      // Subtle nebula: very low-frequency noise plus a little band bias.
      float neb = valueNoise(uv * 2.2 + vec2(seed01 * 19.0, seed01 * 29.0));
      neb = neb * neb;

      vec3 nebColorA = vec3(0.10, 0.22, 0.38);
      vec3 nebColorB = vec3(0.38, 0.16, 0.40);
      vec3 nebColor = mix(nebColorA, nebColorB, bandNoise);

      vec3 col = base;
      col += nebColor * neb * (0.08 + 0.22 * bandWide);

      // Core milky way glow (slightly warm center).
      vec3 mwCool = vec3(0.18, 0.32, 0.50);
      vec3 mwWarm = vec3(0.55, 0.38, 0.22);
      vec3 mw = mix(mwCool, mwWarm, clamp(bandNoise2 * 0.9, 0.0, 1.0));
      col += mw * bandMask * 0.22;

      // Procedural stars.
      // We generate stars in a grid over spherical UV and make only a few cells "active".
      float starGrid = 820.0;
      vec2 g = uv * starGrid;
      vec2 cell = floor(g);
      vec2 f = fract(g);

      float rnd = hash21(cell + vec2(uSeed, uSeed * 0.73));

      // Low baseline probability, slightly higher in the milky way band.
      float p = mix(0.0042, 0.010, clamp(bandWide, 0.0, 1.0));

      float isStar = step(rnd, p);

      // Star shape: small gaussian-ish blob in the cell.
      vec2 starPos = vec2(hash21(cell + 3.1), hash21(cell + 7.7));
      vec2 d = f - starPos;
      float r2 = dot(d, d);

      float starCore = exp(-r2 * 1400.0);
      float starGlow = exp(-r2 * 180.0);

      // Star color temperature: seeded between cool/neutral/warm.
      float t = hash21(cell + 11.3 + uSeed);
      vec3 cCool = vec3(0.70, 0.82, 1.00);
      vec3 cNeu = vec3(1.00, 1.00, 1.00);
      vec3 cWar = vec3(1.00, 0.86, 0.72);
      vec3 starCol = mix(cCool, cNeu, smoothstep(0.15, 0.55, t));
      starCol = mix(starCol, cWar, smoothstep(0.60, 0.95, t));

      float mag = pow(hash21(cell + 17.0 + uSeed * 0.21), 7.0);
      float tw = 0.85 + 0.15 * sin(uTime * (0.7 + 2.2 * hash21(cell + 23.0)) + hash21(cell + 29.0) * 6.28318);

      float starIntensity = isStar * (0.55 + 1.85 * (1.0 - mag)) * tw;
      col += starCol * (starCore * 1.6 + starGlow * 0.45) * starIntensity;

      // Slight vignette to keep focus in the center.
      float vign = smoothstep(1.25, 0.3, length(dir.xz));
      col *= mix(0.9, 1.05, vign);

      // Tone map + gentle lift.
      col = acesApprox(col);
      col = pow(col, vec3(0.95));

      gl_FragColor = vec4(col, 1.0);
    }
  `

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSeed: { value: options.seed },
      uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    transparent: false,
  })

  const object = new THREE.Mesh(geometry, material)
  object.scale.setScalar(radiusWorld)
  object.frustumCulled = false
  object.renderOrder = -10_000

  // Never allow the skydome to be picked.
  object.raycast = () => {}

  return {
    object,

    syncToCamera: (camera) => {
      object.position.copy(camera.position)
    },

    setTimeSeconds: (t) => {
      material.uniforms.uTime.value = t
    },

    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}
