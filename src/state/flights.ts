import { create } from 'zustand'
import { MAX_RENDER, type Flight, type FlightsPayload } from '@/globe/flights'
import { regionForTimezone, type Region } from '@/globe/regions'

export type FlightsStatus = 'idle' | 'loading' | 'ok' | 'error'

interface FlightsState {
  /** Capped list actually drawn on the globe. */
  flights: Flight[]
  /** Live total in the air (before the render cap) — shown in the panel. */
  total: number
  time: number | null
  status: FlightsStatus
  /** The region currently queried/framed. */
  region: Region
  /** The aircraft being inspected, or null. */
  selected: Flight | null
  setData: (payload: FlightsPayload) => void
  setStatus: (status: FlightsStatus) => void
  setRegion: (region: Region) => void
  select: (flight: Flight | null) => void
}

export const useFlights = create<FlightsState>((set) => ({
  flights: [],
  total: 0,
  time: null,
  status: 'idle',
  // Open on the viewer's own part of the world (a region query is also cheaper
  // on OpenSky credits than the whole globe).
  region: regionForTimezone(),
  selected: null,
  setData: (payload) =>
    set({
      flights: payload.states.slice(0, MAX_RENDER),
      total: payload.count,
      time: payload.time,
      status: 'ok',
    }),
  setStatus: (status) => set({ status }),
  // Switching region clears the old area's planes so they don't linger.
  setRegion: (region) =>
    set({ region, flights: [], total: 0, status: 'loading', selected: null }),
  select: (flight) => set({ selected: flight }),
}))
