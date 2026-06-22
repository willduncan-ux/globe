import { useEffect } from 'react'
import { fetchFlights, POLL_MS } from '@/globe/flights'
import { regionQuery } from '@/globe/regions'
import { useFlights } from '@/state/flights'
import { useLayers } from '@/state/layers'

/**
 * Drives the flight feed. Polls /api/flights every POLL_MS, but only while the
 * layer is switched on — so OpenSky isn't queried until the user opts in. Re-polls
 * immediately when the region changes; on error the last good data stays put.
 */
export function useFlightsPolling() {
  const enabled = useLayers((s) => s.enabled.flights)
  const regionId = useFlights((s) => s.region.id)
  const setData = useFlights((s) => s.setData)
  const setStatus = useFlights((s) => s.setStatus)
  const setFlightCount = useLayers((s) => s.setFlightCount)

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      return
    }

    let cancelled = false
    let controller: AbortController | null = null

    const tick = async () => {
      controller?.abort()
      controller = new AbortController()
      const { region } = useFlights.getState()
      const query = region.bbox ? regionQuery(region.bbox) : ''
      if (useFlights.getState().status !== 'ok') setStatus('loading')
      try {
        const payload = await fetchFlights(query, controller.signal)
        if (cancelled) return
        setData(payload)
        setFlightCount(payload.count)
      } catch (err) {
        if (cancelled || (err as Error).name === 'AbortError') return
        setStatus('error')
      }
    }

    tick()
    const id = window.setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      controller?.abort()
      window.clearInterval(id)
    }
  }, [enabled, regionId, setData, setStatus, setFlightCount])
}
