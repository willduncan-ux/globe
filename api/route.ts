import { getRoute } from './_adsbdb.js'

/**
 * Vercel serverless endpoint: GET /api/route?callsign=XXX.
 * Resolves a flight's origin/destination airports via adsbdb.
 */
export default async function handler(
  req: { url?: string },
  res: {
    status: (code: number) => typeof res
    setHeader: (k: string, v: string) => void
    json: (body: unknown) => void
  },
) {
  const params = new URLSearchParams((req.url ?? '').split('?')[1] ?? '')
  const result = await getRoute(params.get('callsign') ?? '')
  // Routes are static for a callsign — cache hard.
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=86400')
  res.status(200).json(result)
}
