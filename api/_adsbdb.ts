/**
 * Route lookup by callsign, via adsbdb (a free ADS-B route database). OpenSky's
 * live feed has no origin/destination, so we resolve it here. Not every
 * callsign is in the database — callers handle `found: false` gracefully.
 */

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

interface AdsbAirport {
  iata_code?: string
  icao_code?: string
  name?: string
  municipality?: string
  country_name?: string
}

function mapAirport(a: AdsbAirport): Airport {
  return {
    iata: a.iata_code ?? '',
    icao: a.icao_code ?? '',
    name: a.name ?? '',
    city: a.municipality ?? '',
    country: a.country_name ?? '',
  }
}

export async function getRoute(callsign: string): Promise<RouteResult> {
  const cs = callsign.trim().toUpperCase()
  if (!cs) return { found: false }
  try {
    const res = await fetch(
      `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`,
      { headers: { Accept: 'application/json' } },
    )
    if (!res.ok) return { found: false }
    const json = (await res.json()) as {
      response?: {
        flightroute?: {
          airline?: { name?: string }
          origin?: AdsbAirport
          destination?: AdsbAirport
        }
      }
    }
    const fr = json?.response?.flightroute
    if (!fr?.origin || !fr?.destination) return { found: false }
    return {
      found: true,
      airline: fr.airline?.name,
      origin: mapAirport(fr.origin),
      destination: mapAirport(fr.destination),
    }
  } catch {
    return { found: false }
  }
}
