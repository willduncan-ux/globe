import * as THREE from 'three'
import { layerAccent } from '@/design/tokens'
import type { Flight } from '@/globe/flights'

/**
 * Flight layer rendered as instanced meshes — one GPU draw call each for the
 * plane glyphs and their motion trails, so thousands of planes cost almost
 * nothing. Each plane is a small silhouette laid tangent to the globe and
 * rotated to its heading; behind it a tapered, fading streak whose length
 * scales with ground speed implies direction and pace (real-time motion is
 * imperceptible at these zooms, so the trail is what reads as movement).
 *
 * Per-instance orientation + position are cached so planes can be re-scaled
 * cheaply on zoom (to hold a steady on-screen size). Matrices are only rebuilt
 * on a data refresh or a zoom — never per frame — so the layer is essentially
 * free to render once set. (Real-time gliding between polls is imperceptible at
 * these zooms; the speed-scaled trails are what convey movement.)
 *
 * Clicks use screen-space nearest-neighbour picking (~16px, front hemisphere).
 */

const CAPACITY = 3000
const ALT = 0.004
const DELTA = 0.5 // degrees, for tangent finite-differences
const PICK_RADIUS = 16 // px

// World size tracks camera distance to keep a steady on-screen size, clamped.
const REF_DIST = 350
const BASE_SCALE = 0.5
const MIN_SCALE = 0.18
const MAX_SCALE = 0.9

// Trail length (in local units; geometry tail sits at y = -1) by ground speed.
const TRAIL_BASE = 1.0
const TRAIL_GAIN = 5.5
const TRAIL_REF_SPEED = 280 // m/s mapped to the longest trail
const TRAIL_HALF_WIDTH = 0.19
const TRAIL_ALPHA = 0.6

interface GlobeLike {
  scene: () => THREE.Scene
  camera: () => THREE.Camera
  renderer: () => THREE.WebGLRenderer
  getCoords: (lat: number, lng: number, altitude?: number) => { x: number; y: number; z: number }
}

/** Top-down plane silhouette, nose pointing +Y. */
function planeShape(): THREE.Shape {
  const pts: [number, number][] = [
    [0, 1.0],
    [0.08, 0.55], [0.08, 0.18],
    [0.85, -0.18], [0.85, -0.32],
    [0.08, -0.05], [0.08, -0.62],
    [0.34, -0.85], [0.34, -0.97],
    [0, -0.78],
    [-0.34, -0.97], [-0.34, -0.85],
    [-0.08, -0.62], [-0.08, -0.05],
    [-0.85, -0.32], [-0.85, -0.18],
    [-0.08, 0.18], [-0.08, 0.55],
  ]
  const shape = new THREE.Shape()
  shape.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1])
  shape.closePath()
  return shape
}

/** A tapered streak from the plane (y=0, full width, opaque) to a transparent
 *  point behind it (y=-1). Alpha lives in the vertex-colour attribute; RGB is
 *  left white so the material's colour drives the hue (and its colour-space). */
function trailGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        -TRAIL_HALF_WIDTH, 0, 0,
        TRAIL_HALF_WIDTH, 0, 0,
        0, -1, 0,
      ]),
      3,
    ),
  )
  geo.setAttribute(
    'color',
    new THREE.BufferAttribute(
      new Float32Array([
        1, 1, 1, TRAIL_ALPHA,
        1, 1, 1, TRAIL_ALPHA,
        1, 1, 1, 0,
      ]),
      4,
    ),
  )
  return geo
}

export interface FlightLayer {
  update: (flights: Flight[]) => void
  setVisible: (visible: boolean) => void
  refreshScale: () => void
  dispose: () => void
}

export function createFlightLayer(
  globe: GlobeLike,
  onSelect: (flight: Flight) => void,
): FlightLayer {
  const accent = new THREE.Color(layerAccent.flights)

  const planeGeo = new THREE.ShapeGeometry(planeShape())
  planeGeo.center()
  const planeMat = new THREE.MeshBasicMaterial({
    color: accent,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.96,
  })
  const planeMesh = new THREE.InstancedMesh(planeGeo, planeMat, CAPACITY)
  planeMesh.count = 0
  planeMesh.frustumCulled = false
  planeMesh.renderOrder = 3

  const trailGeo = trailGeometry()
  const trailMat = new THREE.MeshBasicMaterial({
    color: accent,
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  })
  const trailMesh = new THREE.InstancedMesh(trailGeo, trailMat, CAPACITY)
  trailMesh.count = 0
  trailMesh.frustumCulled = false
  trailMesh.renderOrder = 2 // behind the planes

  globe.scene().add(trailMesh)
  globe.scene().add(planeMesh)

  let flights: Flight[] = []
  let count = 0
  let scale = BASE_SCALE
  const bases: THREE.Matrix4[] = []
  const positions: THREE.Vector3[] = []
  const trailLens: number[] = []

  // Scratch.
  const p = new THREE.Vector3()
  const pe = new THREE.Vector3()
  const pn = new THREE.Vector3()
  const n = new THREE.Vector3()
  const east = new THREE.Vector3()
  const north = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const planeScaleV = new THREE.Vector3()
  const trailScaleV = new THREE.Vector3()
  const matrix = new THREE.Matrix4()
  const DEG = Math.PI / 180
  const set = (c: { x: number; y: number; z: number }, v: THREE.Vector3) =>
    v.set(c.x, c.y, c.z)

  function writeInstance(i: number) {
    planeScaleV.set(scale, scale, scale)
    matrix.copy(bases[i]).scale(planeScaleV).setPosition(positions[i])
    planeMesh.setMatrixAt(i, matrix)
    trailScaleV.set(scale, scale * trailLens[i], scale)
    matrix.copy(bases[i]).scale(trailScaleV).setPosition(positions[i])
    trailMesh.setMatrixAt(i, matrix)
  }

  function recompose() {
    for (let i = 0; i < count; i++) writeInstance(i)
    planeMesh.instanceMatrix.needsUpdate = true
    trailMesh.instanceMatrix.needsUpdate = true
  }

  function scaleForCamera(): number {
    const d = globe.camera().position.length()
    return THREE.MathUtils.clamp((BASE_SCALE * d) / REF_DIST, MIN_SCALE, MAX_SCALE)
  }

  function update(data: Flight[]) {
    flights = data
    count = Math.min(data.length, CAPACITY)
    for (let i = 0; i < count; i++) {
      const f = data[i]
      set(globe.getCoords(f.lat, f.lng, ALT), p)
      set(globe.getCoords(f.lat, f.lng + DELTA, ALT), pe)
      set(globe.getCoords(f.lat + DELTA, f.lng, ALT), pn)
      n.copy(p).normalize()
      east.copy(pe).sub(p).normalize()
      north.copy(pn).sub(p).normalize()
      const h = (f.heading ?? 0) * DEG
      forward.copy(north).multiplyScalar(Math.cos(h)).addScaledVector(east, Math.sin(h))
      forward.addScaledVector(n, -forward.dot(n)).normalize()
      right.crossVectors(forward, n).normalize()

      const base = bases[i] ?? (bases[i] = new THREE.Matrix4())
      base.makeBasis(right, forward, n)
      const pos = positions[i] ?? (positions[i] = new THREE.Vector3())
      pos.copy(p)
      const speed = f.velocity ?? 0
      trailLens[i] =
        TRAIL_BASE + THREE.MathUtils.clamp(speed / TRAIL_REF_SPEED, 0, 1) * TRAIL_GAIN
    }
    scale = scaleForCamera()
    recompose()
    planeMesh.count = count
    trailMesh.count = count
  }

  function refreshScale() {
    if (count === 0) return
    const next = scaleForCamera()
    if (Math.abs(next - scale) < scale * 0.02) return
    scale = next
    recompose()
  }

  function setVisible(visible: boolean) {
    planeMesh.visible = visible
    trailMesh.visible = visible
  }

  // Screen-space click picking.
  const dom = globe.renderer().domElement
  let downX = 0
  let downY = 0
  let downT = 0
  const ndc = new THREE.Vector3()
  const camToPlane = new THREE.Vector3()

  const onDown = (e: PointerEvent) => {
    downX = e.clientX
    downY = e.clientY
    downT = performance.now()
  }
  const onUp = (e: PointerEvent) => {
    if (!planeMesh.visible || count === 0) return
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return
    if (performance.now() - downT > 500) return

    const rect = dom.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const cam = globe.camera()
    let best = -1
    let bestDist = PICK_RADIUS
    for (let i = 0; i < count; i++) {
      const pos = positions[i]
      n.copy(pos).normalize()
      camToPlane.copy(cam.position).sub(pos)
      if (camToPlane.dot(n) <= 0) continue
      ndc.copy(pos).project(cam)
      if (ndc.z > 1) continue
      const sx = (ndc.x * 0.5 + 0.5) * rect.width
      const sy = (-ndc.y * 0.5 + 0.5) * rect.height
      const d = Math.hypot(sx - mx, sy - my)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    if (best >= 0) onSelect(flights[best])
  }
  dom.addEventListener('pointerdown', onDown)
  dom.addEventListener('pointerup', onUp)

  function dispose() {
    dom.removeEventListener('pointerdown', onDown)
    dom.removeEventListener('pointerup', onUp)
    globe.scene().remove(planeMesh)
    globe.scene().remove(trailMesh)
    planeGeo.dispose()
    planeMat.dispose()
    trailGeo.dispose()
    trailMat.dispose()
  }

  return { update, setVisible, refreshScale, dispose }
}
