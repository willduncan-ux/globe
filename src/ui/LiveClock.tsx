import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'

interface Place {
  label: string
  tz: string
}

/** A small, curated set of clocks — enough to cover the globe without becoming
 *  a directory. "Your location" is detected from the browser. */
const PLACES: Place[] = [
  { label: 'UTC', tz: 'UTC' },
  { label: 'United Kingdom', tz: 'Europe/London' },
  { label: 'New York', tz: 'America/New_York' },
  { label: 'Los Angeles', tz: 'America/Los_Angeles' },
  { label: 'São Paulo', tz: 'America/Sao_Paulo' },
  { label: 'France', tz: 'Europe/Paris' },
  { label: 'South Africa', tz: 'Africa/Johannesburg' },
  { label: 'Dubai', tz: 'Asia/Dubai' },
  { label: 'India', tz: 'Asia/Kolkata' },
  { label: 'Singapore', tz: 'Asia/Singapore' },
  { label: 'Japan', tz: 'Asia/Tokyo' },
  { label: 'Sydney', tz: 'Australia/Sydney' },
]

function detectLocal(): Place | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!tz || tz === 'UTC') return null
    return { label: 'Your location', tz }
  } catch {
    return null
  }
}

function formatTime(now: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
}

/** Short zone label, e.g. "BST", "EDT", "GMT+9". */
function zoneAbbr(now: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    timeZoneName: 'short',
  }).formatToParts(now)
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz
}

/**
 * The "right now" cue: a pulsing live dot beside a running clock. The clock is
 * a button — open it to switch which place's time you're watching, from UTC to
 * your own location or any of a dozen anchors around the globe.
 */
export function LiveClock() {
  const reduce = useReducedMotion()
  const [now, setNow] = useState(() => new Date())
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState<Place>(PLACES[0])
  const rootRef = useRef<HTMLDivElement>(null)

  const places = useMemo(() => {
    const local = detectLocal()
    return local ? [PLACES[0], local, ...PLACES.slice(1)] : PLACES
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="pointer-events-auto relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Clock — ${place.label}. Change location.`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md py-0.5 pr-1 transition-colors hover:bg-white/5"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-terminator opacity-70 motion-reduce:hidden" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-terminator" />
        </span>
        <span className="tabular text-[11px] tracking-[0.12em]">
          <span className="text-frost">{formatTime(now, place.tz)}</span>
          <span className="ml-1 text-haze">{zoneAbbr(now, place.tz)}</span>
        </span>
        <ChevronDown
          size={12}
          strokeWidth={2}
          aria-hidden
          className={`text-haze transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Choose a location"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 top-full z-30 mt-2 max-h-[60vh] w-56 overflow-auto rounded-xl border border-white/10 bg-abyss/80 p-1 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl"
          >
            {places.map((p) => {
              const selected = p.tz === place.tz && p.label === place.label
              return (
                <li key={`${p.label}-${p.tz}`} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setPlace(p)
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5"
                  >
                    <span className="flex-1 text-[13px] text-frost">
                      {p.label}
                    </span>
                    <span className="tabular text-[11px] text-haze">
                      {formatTime(now, p.tz)}
                    </span>
                    {selected ? (
                      <Check size={13} strokeWidth={2.25} className="text-terminator" aria-hidden />
                    ) : (
                      <span className="w-[13px]" aria-hidden />
                    )}
                  </button>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
