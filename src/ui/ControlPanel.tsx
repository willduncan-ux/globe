import { motion, useReducedMotion } from 'framer-motion'
import { Sun, Building2, Plane, Sparkles, type LucideIcon } from 'lucide-react'
import { layerAccent, type LayerId } from '@/design/tokens'
import { useLayers } from '@/state/layers'
import { useFlights } from '@/state/flights'
import { LayerToggle } from '@/ui/LayerToggle'
import { RegionPicker } from '@/ui/RegionPicker'

interface LayerRow {
  id: LayerId
  label: string
  icon: LucideIcon
}

const ROWS: LayerRow[] = [
  { id: 'terminator', label: 'Terminator', icon: Sun },
  { id: 'cities', label: 'City lights', icon: Building2 },
  { id: 'flights', label: 'Flights', icon: Plane },
  { id: 'starfield', label: 'Starfield', icon: Sparkles },
]

const intl = new Intl.NumberFormat('en-US')

/** The live stat shown beside each layer — terse, and in mono so it reads as
 *  data. Flights show their live count once the feed is wired (Phase 3). */
function useStat(id: LayerId): string {
  const enabled = useLayers((s) => s.enabled[id])
  const available = useLayers((s) => s.available[id])
  const total = useFlights((s) => s.total)
  const status = useFlights((s) => s.status)

  if (id === 'flights') {
    if (!available) return 'soon'
    if (!enabled) return 'off'
    if (status === 'error' && total === 0) return 'unavailable'
    if (total === 0) return '…'
    return `${intl.format(total)} in air`
  }
  if (id === 'terminator') return enabled ? 'live' : 'off'
  return enabled ? 'on' : 'off'
}

function Row({ row }: { row: LayerRow }) {
  const enabled = useLayers((s) => s.enabled[row.id])
  const available = useLayers((s) => s.available[row.id])
  const toggle = useLayers((s) => s.toggle)
  const stat = useStat(row.id)
  const accent = layerAccent[row.id]
  const Icon = row.icon

  const lit = enabled && available

  return (
    <div className="flex items-center gap-3 py-2">
      <Icon
        size={16}
        strokeWidth={1.75}
        aria-hidden
        style={{ color: lit ? accent : undefined }}
        className={lit ? '' : 'text-haze'}
      />
      <span className="flex-1 text-[13px] text-frost">{row.label}</span>
      <span
        className="tabular text-[11px] tracking-wide"
        style={{ color: lit ? accent : undefined }}
      >
        <span className={lit ? '' : 'text-haze'}>{stat}</span>
      </span>
      <LayerToggle
        layer={row.id}
        checked={enabled}
        disabled={!available}
        label={`${row.label} layer`}
        onChange={() => toggle(row.id)}
      />
    </div>
  )
}

/**
 * The hero component. A floating frosted-glass panel that lists every layer
 * with its live stat and a colour-matched toggle — so it doubles as the
 * legend. Docks bottom-centre on mobile, top-right on desktop.
 */
export function ControlPanel() {
  const reduce = useReducedMotion()
  const flightsOn = useLayers((s) => s.enabled.flights)
  return (
    <motion.section
      aria-label="Layers"
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.2 }}
      className="pointer-events-auto w-[clamp(260px,84vw,320px)] rounded-2xl border border-white/10 bg-abyss/60 p-2 px-3.5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl"
    >
      <div className="divide-y divide-white/[0.06]">
        {ROWS.map((row) => (
          <Row key={row.id} row={row} />
        ))}
      </div>
      {flightsOn && <RegionPicker />}
    </motion.section>
  )
}
