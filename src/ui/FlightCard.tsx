import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, Plane, ArrowRight } from 'lucide-react'
import { layerAccent } from '@/design/tokens'
import { useFlights } from '@/state/flights'
import { fetchRoute, type Airport, type Flight, type RouteResult } from '@/globe/flights'

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

function compass(deg: number): string {
  return COMPASS[Math.round(deg / 45) % 8]
}

/** Metres → feet, rounded to the nearest 100 (how altitudes are read). */
function feet(m: number): string {
  return `${(Math.round((m * 3.28084) / 100) * 100).toLocaleString('en-US')} ft`
}

/** Metres/second → knots. */
function knots(ms: number): string {
  return `${Math.round(ms * 1.94384).toLocaleString('en-US')} kt`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-haze">
        {label}
      </div>
      <div className="tabular mt-0.5 text-[15px] text-frost">{value}</div>
    </div>
  )
}

function AirportCol({
  airport,
  align,
}: {
  airport: Airport
  align: 'left' | 'right'
}) {
  return (
    <div className={`min-w-0 flex-1 ${align === 'right' ? 'text-right' : ''}`}>
      <div className="font-display text-[15px] font-semibold leading-none text-frost">
        {airport.iata || airport.icao || '???'}
      </div>
      <div className="mt-1 truncate text-[11px] text-haze">
        {airport.city || airport.name || airport.country}
      </div>
    </div>
  )
}

function Route({ flight, accent }: { flight: Flight; accent: string }) {
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const cs = flight.callsign
    setRoute(null)
    if (!cs) return
    let cancelled = false
    setLoading(true)
    const ctrl = new AbortController()
    fetchRoute(cs, ctrl.signal)
      .then((r) => !cancelled && setRoute(r))
      .catch(() => !cancelled && setRoute({ found: false }))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [flight.callsign])

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3" aria-live="polite">
      {loading ? (
        <div className="text-[12px] text-haze">Looking up route…</div>
      ) : route?.found && route.origin && route.destination ? (
        <div className="flex items-center gap-2">
          <AirportCol airport={route.origin} align="left" />
          <ArrowRight size={15} strokeWidth={2} aria-label="to" style={{ color: accent }} className="shrink-0" />
          <AirportCol airport={route.destination} align="right" />
        </div>
      ) : (
        <div className="text-[12px] text-haze">Route unavailable</div>
      )}
    </div>
  )
}

function Card({ flight }: { flight: Flight }) {
  const select = useFlights((s) => s.select)
  const accent = layerAccent.flights

  return (
    <motion.div
      role="dialog"
      aria-label={`Flight ${flight.callsign ?? flight.icao24}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="pointer-events-auto w-[clamp(260px,84vw,320px)] rounded-2xl border border-white/10 bg-abyss/70 p-4 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${accent}1f`, color: accent }}
        >
          <Plane size={16} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-semibold leading-none text-frost">
            {flight.callsign ?? 'Unknown'}
          </div>
          <div className="mt-1 truncate text-[12px] text-haze">
            {flight.originCountry}
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => select(null)}
          className="-mr-1 -mt-1 rounded-md p-1 text-haze transition-colors hover:bg-white/5 hover:text-frost"
        >
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <Route flight={flight} accent={accent} />

      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3">
        <Stat
          label="Altitude"
          value={flight.altitude != null ? feet(flight.altitude) : '—'}
        />
        <Stat
          label="Speed"
          value={flight.velocity != null ? knots(flight.velocity) : '—'}
        />
        <Stat
          label="Heading"
          value={
            flight.heading != null
              ? `${Math.round(flight.heading)}° ${compass(flight.heading)}`
              : '—'
          }
        />
      </div>
    </motion.div>
  )
}

/**
 * Tap-to-inspect. One glass card for the selected aircraft — callsign, origin
 * country, altitude, speed, heading. Dismisses on the close button, a tap on
 * the backdrop, or Escape.
 */
export function FlightCard() {
  const reduce = useReducedMotion()
  const selected = useFlights((s) => s.selected)
  const select = useFlights((s) => s.select)

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected, select])

  return (
    <AnimatePresence>
      {selected && (
        <motion.div
          key="flight-overlay"
          initial={{ opacity: reduce ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 z-30"
        >
          {/* Tap-away backdrop (transparent — just a dismiss target). */}
          <button
            type="button"
            aria-label="Dismiss flight details"
            tabIndex={-1}
            onClick={() => select(null)}
            className="absolute inset-0 cursor-default"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] flex justify-center px-4 sm:bottom-6 sm:left-6 sm:right-auto sm:justify-start sm:px-0">
            <Card flight={selected} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
