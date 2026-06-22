import { getFlights, bboxFromQuery } from './_opensky'

/**
 * Vercel serverless endpoint: GET /api/flights[?lamin&lomin&lamax&lomax].
 * Holds the OpenSky secret and proxies a trimmed /states/all to the client.
 */
export default async function handler(
  req: { url?: string },
  res: {
    status: (code: number) => typeof res
    setHeader: (k: string, v: string) => void
    json: (body: unknown) => void
  },
) {
  const result = await getFlights(bboxFromQuery(req.url ?? ''))
  if (result.retryAfter) {
    res.setHeader('Retry-After', String(result.retryAfter))
  }
  // Let the CDN serve a cached copy for the poll interval, easing OpenSky credits.
  res.setHeader('Cache-Control', 's-maxage=25, stale-while-revalidate=30')
  res.status(result.status).json(result.body)
}
