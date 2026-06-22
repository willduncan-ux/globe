import { motion, useReducedMotion } from 'framer-motion'
import { Globe } from '@/globe/Globe'
import { LiveClock } from '@/ui/LiveClock'
import { ControlPanel } from '@/ui/ControlPanel'
import { FlightCard } from '@/ui/FlightCard'
import { CaptureButton } from '@/ui/CaptureButton'
import { useFlightsPolling } from '@/globe/useFlightsPolling'

function App() {
  const reduce = useReducedMotion()
  useFlightsPolling()

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-void">
      {/* The planet eases in from black on load (skipped under reduced motion). */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: reduce ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 1.2, ease: 'easeOut' }}
      >
        <Globe />
      </motion.div>

      {/* text-shadow keeps the chrome legible over bright parts of the globe
          (ice, daylit cloud) without needing a heavy scrim. */}
      <header className="pointer-events-none absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] z-20 select-none [text-shadow:0_1px_12px_rgba(7,10,18,0.7)]">
        <LiveClock />
        <h1 className="mt-1 font-display text-base font-semibold tracking-tight text-frost">
          Right Now on Earth
        </h1>
      </header>

      {/* Capture / share — top-right on mobile, bottom-right on desktop, clear
          of the panel and credits. */}
      <div className="pointer-events-none absolute right-4 top-[max(1.25rem,env(safe-area-inset-top))] z-20 sm:bottom-6 sm:right-6 sm:top-auto">
        <CaptureButton />
      </div>

      {/* Tap-to-inspect card (slides up over the globe). */}
      <FlightCard />

      {/* Docks bottom-centre on mobile, top-right on desktop. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-4 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5 sm:justify-end sm:px-0">
        <ControlPanel />
      </div>

      {/* Attribution — required by the data sources and imagery licence. */}
      <footer className="pointer-events-none absolute bottom-[max(0.6rem,env(safe-area-inset-bottom))] right-4 z-10 max-w-[60vw] select-none text-right text-[10px] leading-relaxed tracking-wide text-haze/70 [text-shadow:0_1px_10px_rgba(7,10,18,0.7)] sm:left-5 sm:right-auto sm:max-w-none sm:text-left">
        Imagery{' '}
        <a
          href="https://www.solarsystemscope.com/textures/"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto underline-offset-2 hover:text-haze hover:underline"
        >
          Solar System Scope
        </a>{' '}
        · Flights{' '}
        <a
          href="https://opensky-network.org"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto underline-offset-2 hover:text-haze hover:underline"
        >
          OpenSky
        </a>{' '}
        ·{' '}
        <a
          href="https://www.adsbdb.com"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto underline-offset-2 hover:text-haze hover:underline"
        >
          adsbdb
        </a>
      </footer>
    </main>
  )
}

export default App
