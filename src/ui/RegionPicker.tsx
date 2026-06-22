import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronDown, Check, Globe2 } from 'lucide-react'
import { layerAccent } from '@/design/tokens'
import { REGIONS } from '@/globe/regions'
import { useFlights } from '@/state/flights'

/**
 * Chooses which region's aircraft to load. Picking one reframes the globe and
 * queries just that bounding box — fewer points and cheaper OpenSky credits.
 * Styled to match the clock dropdown; only rendered while Flights is on.
 */
export function RegionPicker() {
  const reduce = useReducedMotion()
  const region = useFlights((s) => s.region)
  const setRegion = useFlights((s) => s.setRegion)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const accent = layerAccent.flights

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative mt-1 border-t border-white/[0.06] pt-2">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Flight region — ${region.label}. Change region.`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-white/5"
      >
        <Globe2 size={15} strokeWidth={1.75} aria-hidden style={{ color: accent }} />
        <span className="text-[11px] uppercase tracking-[0.1em] text-haze">
          Region
        </span>
        <span className="flex-1 text-right text-[13px] text-frost">
          {region.label}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={2}
          aria-hidden
          className={`text-haze transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Choose a region"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full left-0 z-30 mb-2 w-full overflow-hidden rounded-xl border border-white/10 bg-abyss/85 p-1 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:bottom-auto sm:top-full sm:mb-0 sm:mt-2"
          >
            {REGIONS.map((r) => {
              const selected = r.id === region.id
              return (
                <li key={r.id} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      if (r.id !== region.id) setRegion(r)
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5"
                  >
                    <span className="flex-1 text-[13px] text-frost">{r.label}</span>
                    {selected ? (
                      <Check size={13} strokeWidth={2.25} aria-hidden style={{ color: accent }} />
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
