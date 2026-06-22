import * as THREE from 'three'
import { layerAccent } from '@/design/tokens'

/**
 * The globe's skin. A single ShaderMaterial that blends the daylit Earth, the
 * night-side city lights, and the signature Dawn Ribbon — a glowing twilight
 * band that hugs the live terminator (golden hour, seen from orbit).
 *
 * Everything is computed in texture space from the surface lat/lng, so it stays
 * geographically correct no matter how the camera orbits. The Sun is passed in
 * as the subsolar lat/lng (radians); `dayAmount` at any fragment is the cosine
 * of its angular distance from that point.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform float sunLat;
  uniform float sunLng;
  uniform float softness;       // half-width of the twilight blend
  uniform float ribbonStrength; // how hot the Dawn Ribbon glows
  uniform vec3 dawnColor;
  uniform float cityStrength;
  uniform float dayBrightness;  // lift the daylit side (blue-marble runs dark)
  uniform float terminatorMix;  // 1 = live day/night, 0 = full daylight (toggle)
  varying vec2 vUv;

  const float PI = 3.14159265359;

  void main() {
    // Equirectangular UV -> geographic coordinates.
    float lng = (vUv.x - 0.5) * 2.0 * PI;
    float lat = (vUv.y - 0.5) * PI;

    // Cosine of the angular distance to the subsolar point: >0 day, <0 night.
    float sun = sin(lat) * sin(sunLat) +
                cos(lat) * cos(sunLat) * cos(lng - sunLng);

    // Gamma lift (exponent < 1) brightens the dark blue-marble oceans far more
    // than the already-bright land. Then clamp the top end so bright ice and
    // desert stay below the bloom threshold and can't blow out to white.
    vec3 day = min(
      pow(texture2D(dayTexture, vUv).rgb, vec3(0.8)) * dayBrightness,
      vec3(0.8)
    );
    vec3 night = texture2D(nightTexture, vUv).rgb * cityStrength;

    float dayAmount = smoothstep(-softness, softness, sun);
    vec3 shaded = mix(night, day, dayAmount);

    // Dawn Ribbon: a thread of warm light right at the terminator (sun ~ 0),
    // leaning to the dusk side so it reads as dawn rather than a painted stripe.
    // A sharp core with a quick falloff keeps it a glow, not a bar.
    float width = softness * 1.05;
    float band = 1.0 - smoothstep(0.0, width, abs(sun));
    band = pow(band, 3.2);
    // Confine the glow to the dusk side of the line: nightLean is 0 on the
    // daylit side (so the ribbon never blows out over bright land) and rises
    // to 1 just past the terminator into night, where it blooms.
    float nightLean = smoothstep(softness * 1.5, -softness * 1.5, sun);
    shaded += dawnColor * band * ribbonStrength * nightLean;

    // Switching the terminator off eases the whole planet into full daylight.
    vec3 color = mix(day, shaded, terminatorMix);

    gl_FragColor = vec4(color, 1.0);
  }
`

export interface DayNightMaterial extends THREE.ShaderMaterial {
  setSun(latDeg: number, lngDeg: number): void
}

const DEG = Math.PI / 180

export function createDayNightMaterial(
  dayTexture: THREE.Texture,
  nightTexture: THREE.Texture,
): DayNightMaterial {
  const dawn = new THREE.Color(layerAccent.terminator)

  const material = new THREE.ShaderMaterial({
    uniforms: {
      dayTexture: { value: dayTexture },
      nightTexture: { value: nightTexture },
      sunLat: { value: 0 },
      sunLng: { value: 0 },
      softness: { value: 0.05 },
      ribbonStrength: { value: 1.0 },
      dawnColor: { value: dawn },
      cityStrength: { value: 1.4 },
      dayBrightness: { value: 1.25 },
      terminatorMix: { value: 1 },
    },
    vertexShader,
    fragmentShader,
  }) as DayNightMaterial

  material.setSun = (latDeg: number, lngDeg: number) => {
    material.uniforms.sunLat.value = latDeg * DEG
    material.uniforms.sunLng.value = lngDeg * DEG
  }

  return material
}
