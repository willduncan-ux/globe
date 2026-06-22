import { create } from 'zustand'

export type LayerId = 'terminator' | 'cities' | 'flights' | 'starfield'

interface LayersState {
  /** Whether each layer is switched on. */
  enabled: Record<LayerId, boolean>
  /** Whether a layer's data is wired up yet (flights arrive in Phase 3). */
  available: Record<LayerId, boolean>
  /** Live count of aircraft in the air, or null before the first fetch. */
  flightCount: number | null
  toggle: (id: LayerId) => void
  setFlightCount: (n: number | null) => void
}

export const useLayers = create<LayersState>((set) => ({
  enabled: {
    terminator: true,
    cities: true,
    flights: true,
    starfield: true,
  },
  available: {
    terminator: true,
    cities: true,
    flights: true,
    starfield: true,
  },
  flightCount: null,
  toggle: (id) =>
    set((s) =>
      s.available[id]
        ? { enabled: { ...s.enabled, [id]: !s.enabled[id] } }
        : s,
    ),
  setFlightCount: (n) => set({ flightCount: n }),
}))
