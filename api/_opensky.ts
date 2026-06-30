/**
 * OpenSky proxy core — shared by the Vercel function (api/flights.ts) and the
 * Vite dev middleware, so live flights work the same in dev and production.
 *
 * Holds the OAuth client-credentials secret server-side, caches the bearer
 * token in memory (refreshed ~30s before expiry), and trims the heavy
 * /states/all payload down to what the globe needs. On a 429 it serves the
 * last good response rather than erroring, so the map never goes blank.
 *
 * OpenSky is free for personal/non-profit use; attribution is required and
 * shown in the UI. Credits scale with the bounding box, so we query the whole
 * globe on a slow interval (see POLL_MS on the client) and cache.
 */

const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
const STATES_URL = 'https://opensky-network.org/api/states/all'

/** Cap on the number of trimmed aircraft returned. The live total (which may be
 *  ~15,000) is still reported as `count`; we just don't ship them all. */
const MAX_STATES = 3000

export interface FlightState {
  icao24: string
  callsign: string | null
  originCountry: string
  lng: number
  lat: number
  /** Metres — geometric altitude, falling back to barometric. */
  altitude: number | null
  /** Metres/second over ground. */
  velocity: number | null
  /** Degrees clockwise from north. */
  heading: number | null
}

export interface FlightsPayload {
  /** Unix seconds of the OpenSky snapshot. */
  time: number
  /** Total aircraft in the air (before the render cap). */
  count: number
  states: FlightState[]
}

export interface CoreResult {
  status: number
  body: FlightsPayload | { error: string }
  retryAfter?: number
}

export interface BBox {
  lamin: number
  lomin: number
  lamax: number
  lomax: number
}

let token: { value: string; expiresAt: number } | null = null
/** Last good payload per region key, so a 429 on one region doesn't blank it. */
const lastGood = new Map<string, FlightsPayload>()

async function getToken(): Promise<string> {
  const now = Date.now()
  if (token && token.expiresAt - 30_000 > now) return token.value

  const clientId = process.env.OPENSKY_CLIENT_ID
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('missing OpenSky credentials')
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) throw new Error(`token request failed (${res.status})`)

  const json = (await res.json()) as { access_token: string; expires_in: number }
  token = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  return token.value
}

function trim(raw: unknown[][]): FlightState[] {
  const states: FlightState[] = []
  for (const s of raw) {
    const onGround = s[8] as boolean
    const lng = s[5] as number | null
    const lat = s[6] as number | null
    if (onGround || lng == null || lat == null) continue
    states.push({
      icao24: s[0] as string,
      callsign: ((s[1] as string | null) ?? '').trim() || null,
      originCountry: s[2] as string,
      lng,
      lat,
      altitude: (s[13] as number | null) ?? (s[7] as number | null),
      velocity: s[9] as number | null,
      heading: s[10] as number | null,
    })
  }
  return states
}

export async function getFlights(bbox?: BBox): Promise<CoreResult> {
  let accessToken: string
  try {
    accessToken = await getToken()
  } catch (err) {
    const cause = (err as { cause?: unknown }).cause
    const detail = cause instanceof Error ? cause.message : cause ? String(cause) : undefined
    const message = (err as Error).message + (detail ? `: ${detail}` : '')
    return { status: 500, body: { error: message } }
  }

  // A bounding box restricts the query to a region — fewer aircraft and a
  // cheaper credit tier than the whole globe.
  const key = bbox
    ? `${bbox.lamin},${bbox.lomin},${bbox.lamax},${bbox.lomax}`
    : 'world'
  const url = bbox
    ? `${STATES_URL}?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`
    : STATES_URL

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const cached = lastGood.get(key)
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After')) || 30
    if (cached) return { status: 200, body: cached, retryAfter }
    return { status: 429, body: { error: 'rate limited' }, retryAfter }
  }
  if (!res.ok) {
    if (cached) return { status: 200, body: cached }
    return { status: res.status, body: { error: `upstream ${res.status}` } }
  }

  const json = (await res.json()) as { time: number; states: unknown[][] | null }
  const all = trim(json.states ?? [])
  const payload: FlightsPayload = {
    time: json.time,
    count: all.length,
    states: all.slice(0, MAX_STATES),
  }
  lastGood.set(key, payload)
  return { status: 200, body: payload }
}

/** Parse a request URL's query string into a bounding box, if present. */
export function bboxFromQuery(url: string): BBox | undefined {
  const q = url.includes('?') ? url.slice(url.indexOf('?')) : ''
  const p = new URLSearchParams(q)
  const nums = ['lamin', 'lomin', 'lamax', 'lomax'].map((k) => p.get(k))
  if (nums.some((n) => n === null)) return undefined
  const [lamin, lomin, lamax, lomax] = nums.map(Number)
  if (nums.some((n) => Number.isNaN(Number(n)))) return undefined
  return { lamin, lomin, lamax, lomax }
}
