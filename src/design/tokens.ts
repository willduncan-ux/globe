/**
 * Right Now on Earth — design tokens (signed-off "Umbral" system).
 *
 * The colour system encodes meaning: one accent per data layer, derived from
 * the phenomenon itself. The control-panel toggles are tinted to these, so the
 * panel doubles as the legend. Keep this the single source of truth — Tailwind
 * theme vars in index.css mirror these exact values.
 */

export const palette = {
  // Base — a *chosen* indigo-black, not a default near-black.
  void: '#070A12', // deep-space background
  abyss: '#0E1424', // frosted panel surface
  frost: '#E9EEF8', // primary text (star white)
  haze: '#8794AC', // muted / secondary labels
  hairline: 'rgba(233,238,248,0.10)', // borders, dividers
} as const

/** One accent per data layer, derived from the phenomenon. */
export const layerAccent = {
  terminator: '#FF9E5A', // dawn — golden-hour-from-orbit
  cities: '#FFE08A', // sodium — pale sodium-vapour gold
  flights: '#5FE3FF', // ion — cool aviation/contrail cyan
  starfield: '#C9D6FF', // stellar — faint blue-white
} as const

export type LayerId = keyof typeof layerAccent

export const type = {
  display: "'Space Grotesk', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const

/** Globe + light tuning, kept in one place so the look stays coherent. */
export const globeConfig = {
  bloom: { strength: 0.5, radius: 0.5, threshold: 0.82 },
  atmosphereColor: '#5b7fb0',
  atmosphereAltitude: 0.18,
  autoRotateSpeed: 0.18, // slow, majestic
  idleResumeMs: 3500, // resume auto-rotation after stillness
} as const
