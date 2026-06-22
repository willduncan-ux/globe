/** Client-side flights: types mirroring the trimmed proxy payload, the poll
 *  cadence (one tunable constant), and the render cap. */

export interface Flight {
  icao24: string
  callsign: string | null
  originCountry: string
  lng: number
  lat: number
  altitude: number | null
  velocity: number | null
  heading: number | null
}

export interface FlightsPayload {
  time: number
  count: number
  states: Flight[]
}

/** Whole-globe queries are the priciest OpenSky tier — poll slowly and cache.
 *  This is the single knob to tune the refresh rate. */
export const POLL_MS = 30_000

/** Cap on planes drawn. Instanced rendering handles thousands cheaply, so this
 *  matches the server's payload cap; the live total is shown regardless. */
export const MAX_RENDER = 3000

export async function fetchFlights(
  query = '',
  signal?: AbortSignal,
): Promise<FlightsPayload> {
  const res = await fetch(`/api/flights${query}`, { signal })
  if (!res.ok) throw new Error(`flights ${res.status}`)
  return (await res.json()) as FlightsPayload
}

export interface Airport {
  iata: string
  icao: string
  name: string
  city: string
  country: string
}

export interface RouteResult {
  found: boolean
  airline?: string
  origin?: Airport
  destination?: Airport
}

/** Resolve a flight's origin/destination airports by callsign (via adsbdb). */
export async function fetchRoute(
  callsign: string,
  signal?: AbortSignal,
): Promise<RouteResult> {
  const res = await fetch(`/api/route?callsign=${encodeURIComponent(callsign)}`, {
    signal,
  })
  if (!res.ok) return { found: false }
  return (await res.json()) as RouteResult
}
