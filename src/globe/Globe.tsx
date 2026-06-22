import { useEffect, useRef } from 'react'
import GlobeGL from 'globe.gl'
import * as THREE from 'three'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { globeConfig } from '@/design/tokens'
import { subsolarPoint } from '@/globe/terminator'
import { createDayNightMaterial } from '@/globe/dayNightMaterial'
import { createFlightLayer } from '@/globe/flightLayer'
import { useLayers } from '@/state/layers'
import { useFlights } from '@/state/flights'
import { WORLD_REGION } from '@/globe/regions'

/** How often the Sun's position is recomputed. It drifts ~0.25°/min, so this
 *  only needs to keep the terminator honest, not be smooth — cheap either way. */
const SUN_TICK_MS = 10_000

const CITY_FULL = 1.4 // night-side city brightness when the layer is on
const STAR_RADIUS = 6000 // enclosing starfield sphere, well outside the globe

/**
 * The globe. A custom day/night shader renders the live terminator, city
 * lights and the Dawn Ribbon; an UnrealBloomPass makes the bright points
 * genuinely glow. The canvas is transparent so the starfield (a DOM layer)
 * shows through and can fade independently.
 *
 * Layer toggles drive shader uniforms, eased over ~400ms so layers dissolve
 * rather than pop. Idle auto-rotation yields the instant a pointer touches the
 * globe and resumes after a stretch of stillness.
 */
export function Globe() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    let disposed = false
    let sunTimer: number | undefined
    let resumeTimer: number | undefined
    let raf = 0
    const cleanups: Array<() => void> = []

    // 8K Earth maps on roomy screens; 4K on small/phone screens to bound the
    // download and GPU memory. Offline falls back to 4K (the precached set).
    // Resolution doesn't affect frame rate.
    const hi = window.innerWidth >= 900 && navigator.onLine
    const earth = (base: string) => `/textures/${base}${hi ? '-8k' : ''}.jpg`

    const loader = new THREE.TextureLoader()
    Promise.all([
      loader.loadAsync(earth('earth-day')),
      loader.loadAsync(earth('earth-night')),
      loader.loadAsync('/textures/night-sky.png'),
    ]).then(([dayTex, nightTex, skyTex]) => {
      if (disposed) return
      dayTex.colorSpace = THREE.SRGBColorSpace
      nightTex.colorSpace = THREE.SRGBColorSpace
      skyTex.colorSpace = THREE.SRGBColorSpace
      // Anisotropic filtering — the big sharpness win at the grazing angles a
      // globe is always viewed at. three clamps to the GPU's max. Near-free.
      dayTex.anisotropy = 16
      nightTex.anisotropy = 16

      const material = createDayNightMaterial(dayTex, nightTex)

      // preserveDrawingBuffer lets the capture button read the canvas pixels.
      const globe = new GlobeGL(el, {
        rendererConfig: { preserveDrawingBuffer: true },
      })
        .globeMaterial(material)
        .backgroundColor('#070A12')
        .showAtmosphere(true)
        .atmosphereColor(globeConfig.atmosphereColor)
        .atmosphereAltitude(globeConfig.atmosphereAltitude)
        .width(el.clientWidth)
        .height(el.clientHeight)

      // Bloom — bright points (Dawn Ribbon, cities) glow rather than sit flat.
      const { strength, radius, threshold } = globeConfig.bloom
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(el.clientWidth, el.clientHeight),
        strength,
        radius,
        threshold,
      )
      globe.postProcessingComposer().addPass(bloom)

      // Starfield — an enclosing sphere inside the scene, so it survives the
      // post-processing composer (a transparent canvas does not) and can fade
      // independently. Drawn behind everything, ignoring depth.
      // depthTest stays ON so the opaque globe occludes the sphere where they
      // overlap (it's transparent, so it renders after the globe — without the
      // test it would paint the dark sky over the planet). depthWrite stays off
      // so it never occludes anything itself.
      const stars = new THREE.Mesh(
        new THREE.SphereGeometry(STAR_RADIUS, 64, 64),
        new THREE.MeshBasicMaterial({
          map: skyTex,
          side: THREE.BackSide,
          transparent: true,
          opacity: 1,
          depthWrite: false,
        }),
      )
      globe.scene().add(stars)
      const cam = globe.camera() as THREE.PerspectiveCamera
      cam.far = Math.max(cam.far, STAR_RADIUS * 2)
      cam.updateProjectionMatrix()

      // Live flights — one instanced mesh of plane glyphs (see flightLayer),
      // rebuilt only on data refresh, so thousands render for ~one draw call.
      const flightLayer = createFlightLayer(globe, (f) =>
        useFlights.getState().select(f),
      )
      const applyFlights = () => {
        const on = useLayers.getState().enabled.flights
        flightLayer.setVisible(on)
        flightLayer.update(on ? useFlights.getState().flights : [])
      }
      applyFlights()
      const unsubFlights = useFlights.subscribe(applyFlights)

      // Region framing is tuned for a wide screen; on a tall/portrait viewport
      // the same altitude pushes the region off the edge, so pull back to fit.
      const regionView = (region: typeof WORLD_REGION) => {
        if (region.id === 'world') return region.view
        const aspect = el.clientWidth / el.clientHeight
        const mul = aspect < 1 ? Math.min(2, (1 / aspect) * 0.8) : 1
        return { ...region.view, altitude: region.view.altitude * mul }
      }

      // Cinematic intro: ease the camera from far out to framed. If flights
      // open on the viewer's region, frame that region; otherwise the world.
      const startOnRegion =
        useLayers.getState().enabled.flights &&
        useFlights.getState().region.id !== 'world'
      const framed = startOnRegion
        ? regionView(useFlights.getState().region)
        : WORLD_REGION.view
      if (reduceMotion) {
        globe.pointOfView(framed, 0)
      } else {
        globe.pointOfView({ ...framed, altitude: framed.altitude + 1.7 }, 0)
        window.setTimeout(() => {
          if (!disposed) globe.pointOfView(framed, 2600)
        }, 80)
      }

      const controls = globe.controls()
      controls.enableZoom = true
      controls.minDistance = 125
      controls.maxDistance = 600
      controls.zoomSpeed = 0.6
      // Spin only in the ambient (flights-off) state; hold still when framed.
      controls.autoRotate = !reduceMotion && !useLayers.getState().enabled.flights
      controls.autoRotateSpeed = globeConfig.autoRotateSpeed

      // Keep plane sizes steady on screen as the camera zooms.
      const onControlsChange = () => flightLayer.refreshScale()
      controls.addEventListener('change', onControlsChange)

      // Camera regime, keyed off (flights on/off) + region. It only re-issues a
      // move when the regime actually changes, so unrelated toggles don't yank
      // the view. Flights OFF -> zoom out and spin; ON + whole world -> hold
      // where it is (let the user zoom/click); ON + region -> frame it and hold.
      const framingKey = () => {
        if (!useLayers.getState().enabled.flights) return 'world-spin'
        const { region } = useFlights.getState()
        return region.id === 'world' ? 'free' : `region:${region.id}`
      }
      let lastKey = framingKey() // 'world-spin' at mount; the intro frames it
      const updateCamera = () => {
        const key = framingKey()
        if (key === lastKey) return
        lastKey = key
        if (key === 'world-spin') {
          globe.pointOfView(WORLD_REGION.view, reduceMotion ? 0 : 1200)
          controls.autoRotate = !reduceMotion
        } else if (key === 'free') {
          controls.autoRotate = false
        } else {
          globe.pointOfView(regionView(useFlights.getState().region), reduceMotion ? 0 : 1200)
          controls.autoRotate = false
        }
      }
      const unsubRegion = useFlights.subscribe(updateCamera)

      // Keep the Sun current.
      const tickSun = () => {
        const { lat, lng } = subsolarPoint()
        material.setSun(lat, lng)
      }
      tickSun()
      sunTimer = window.setInterval(tickSun, SUN_TICK_MS)

      // Ease shader uniforms + starfield toward the layer state (~400ms).
      const targets = { terminatorMix: 1, cityStrength: CITY_FULL, stars: 1 }
      const readTargets = () => {
        const { enabled } = useLayers.getState()
        targets.terminatorMix = enabled.terminator ? 1 : 0
        targets.cityStrength = enabled.cities ? CITY_FULL : 0
        targets.stars = enabled.starfield ? 1 : 0
        applyFlights()
        updateCamera()
      }
      readTargets()
      const unsub = useLayers.subscribe(readTargets)

      const starMat = stars.material as THREE.MeshBasicMaterial
      const tween = () => {
        const u = material.uniforms
        u.terminatorMix.value +=
          (targets.terminatorMix - u.terminatorMix.value) * 0.18
        u.cityStrength.value +=
          (targets.cityStrength - u.cityStrength.value) * 0.18
        starMat.opacity += (targets.stars - starMat.opacity) * 0.18
        raf = requestAnimationFrame(tween)
      }
      tween()

      // Pause rotation on interaction; resume after a stretch of stillness.
      const pause = () => {
        controls.autoRotate = false
        window.clearTimeout(resumeTimer)
      }
      const scheduleResume = () => {
        // Only the ambient (flights-off) state spins; don't resume otherwise.
        if (reduceMotion || useLayers.getState().enabled.flights) return
        window.clearTimeout(resumeTimer)
        resumeTimer = window.setTimeout(() => {
          controls.autoRotate = true
        }, globeConfig.idleResumeMs)
      }
      el.addEventListener('pointerdown', pause)
      el.addEventListener('pointerup', scheduleResume)

      const onResize = () => {
        globe.width(el.clientWidth).height(el.clientHeight)
        bloom.setSize(el.clientWidth, el.clientHeight)
      }
      window.addEventListener('resize', onResize)

      cleanups.push(() => {
        window.removeEventListener('resize', onResize)
        el.removeEventListener('pointerdown', pause)
        el.removeEventListener('pointerup', scheduleResume)
        unsub()
        unsubFlights()
        unsubRegion()
        controls.removeEventListener('change', onControlsChange)
        flightLayer.dispose()
        globe.scene().remove(stars)
        stars.geometry.dispose()
        starMat.dispose()
        globe._destructor?.()
        material.dispose()
        dayTex.dispose()
        nightTex.dispose()
        skyTex.dispose()
        el.replaceChildren()
      })
    })

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.clearInterval(sunTimer)
      window.clearTimeout(resumeTimer)
      cleanups.forEach((fn) => fn())
    }
  }, [])

  return <div ref={containerRef} className="absolute inset-0" />
}
