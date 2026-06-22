/**
 * Day/night terminator — pure astronomy, no API.
 *
 * Computes the subsolar point (the lat/lng where the Sun is directly overhead)
 * for a given instant. The globe shader turns this single point into the whole
 * day/night curve: any surface point is in daylight when its angular distance
 * from the subsolar point is less than 90°.
 *
 * Uses the USNO low-precision solar coordinates — accurate to ~0.01° for two
 * centuries around J2000, far beyond what the eye can read on a globe.
 */

const DEG = Math.PI / 180

export interface SubsolarPoint {
  /** Latitude in degrees (the Sun's declination). */
  lat: number
  /** Longitude in degrees, east-positive, normalised to [-180, 180]. */
  lng: number
}

function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360
}

export function subsolarPoint(date: Date = new Date()): SubsolarPoint {
  // Julian days since the J2000.0 epoch.
  const jd = date.getTime() / 86_400_000 + 2_440_587.5
  const n = jd - 2_451_545.0

  // Mean longitude and mean anomaly of the Sun (degrees).
  const L = norm360(280.46 + 0.9856474 * n)
  const g = norm360(357.528 + 0.9856003 * n)

  // Ecliptic longitude, with the two largest periodic corrections.
  const lambda =
    L + 1.915 * Math.sin(g * DEG) + 0.02 * Math.sin(2 * g * DEG)

  // Obliquity of the ecliptic.
  const epsilon = 23.439 - 0.0000004 * n

  // Declination and right ascension of the Sun (degrees).
  const dec =
    Math.asin(Math.sin(epsilon * DEG) * Math.sin(lambda * DEG)) / DEG
  const ra =
    Math.atan2(
      Math.cos(epsilon * DEG) * Math.sin(lambda * DEG),
      Math.cos(lambda * DEG),
    ) / DEG

  // Greenwich Mean Sidereal Time (degrees). The subsolar meridian is where
  // the Sun's hour angle is zero, i.e. longitude = right ascension − GMST.
  const gmst = norm360(280.46061837 + 360.98564736629 * n)
  let lng = ra - gmst
  lng = norm360(lng + 180) - 180

  return { lat: dec, lng }
}
