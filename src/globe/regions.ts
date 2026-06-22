/** Flight regions. Each carries an OpenSky bounding box (used to query just that
 *  area — cheaper on credits and fewer points) and a camera framing the globe
 *  eases to when the region is chosen. `world` has no box (whole-globe query). */

export interface BBox {
  lamin: number
  lomin: number
  lamax: number
  lomax: number
}

export interface Region {
  id: string
  label: string
  bbox: BBox | null
  view: { lat: number; lng: number; altitude: number }
}

export const REGIONS: Region[] = [
  { id: 'world', label: 'Whole world', bbox: null, view: { lat: 18, lng: 0, altitude: 2.5 } },
  {
    id: 'europe',
    label: 'Europe',
    bbox: { lamin: 34, lomin: -25, lamax: 72, lomax: 45 },
    view: { lat: 52, lng: 14, altitude: 1.05 },
  },
  {
    id: 'north-america',
    label: 'North America',
    bbox: { lamin: 12, lomin: -168, lamax: 72, lomax: -52 },
    view: { lat: 44, lng: -100, altitude: 1.5 },
  },
  {
    id: 'south-america',
    label: 'South America',
    bbox: { lamin: -56, lomin: -82, lamax: 14, lomax: -34 },
    view: { lat: -18, lng: -60, altitude: 1.4 },
  },
  {
    id: 'africa-mideast',
    label: 'Africa & Middle East',
    bbox: { lamin: -36, lomin: -20, lamax: 40, lomax: 62 },
    view: { lat: 6, lng: 24, altitude: 1.5 },
  },
  {
    id: 'asia',
    label: 'Asia',
    bbox: { lamin: 3, lomin: 58, lamax: 78, lomax: 150 },
    view: { lat: 38, lng: 96, altitude: 1.5 },
  },
  {
    id: 'oceania',
    label: 'Oceania',
    bbox: { lamin: -50, lomin: 110, lamax: 6, lomax: 180 },
    view: { lat: -24, lng: 146, altitude: 1.45 },
  },
]

export const WORLD_REGION = REGIONS[0]

export function regionQuery(bbox: BBox): string {
  return `?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`
}

const byId = (id: string): Region =>
  REGIONS.find((r) => r.id === id) ?? WORLD_REGION

/** IANA zones that sit in the Middle East — grouped with Africa here so the
 *  "Asia/" prefix doesn't pull them to the Far East. */
const MIDEAST = new Set([
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Bahrain', 'Asia/Kuwait',
  'Asia/Muscat', 'Asia/Jerusalem', 'Asia/Tel_Aviv', 'Asia/Gaza', 'Asia/Hebron',
  'Asia/Beirut', 'Asia/Amman', 'Asia/Damascus', 'Asia/Baghdad', 'Asia/Tehran',
  'Asia/Yerevan', 'Asia/Baku', 'Asia/Tbilisi', 'Asia/Aden', 'Asia/Nicosia',
])

/** South-American zones (the rest of "America/" defaults to North America). */
const S_AMERICA = new Set([
  'America/Sao_Paulo', 'America/Bahia', 'America/Fortaleza', 'America/Recife',
  'America/Manaus', 'America/Belem', 'America/Cuiaba', 'America/Campo_Grande',
  'America/Porto_Velho', 'America/Boa_Vista', 'America/Rio_Branco',
  'America/Santiago', 'America/Lima', 'America/Bogota', 'America/Caracas',
  'America/La_Paz', 'America/Asuncion', 'America/Montevideo',
  'America/Guayaquil', 'America/Cayenne', 'America/Paramaribo',
  'America/Punta_Arenas',
])

/** Best-guess flight region for an IANA timezone, so the app can open on the
 *  part of the world the viewer is in. Falls back to the whole world. */
export function regionForTimezone(tz?: string): Region {
  const zone =
    tz ??
    (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
      } catch {
        return ''
      }
    })()
  if (!zone) return WORLD_REGION

  if (MIDEAST.has(zone)) return byId('africa-mideast')
  if (S_AMERICA.has(zone) || zone.startsWith('America/Argentina'))
    return byId('south-america')

  if (zone.startsWith('Europe/')) return byId('europe')
  if (zone.startsWith('Africa/')) return byId('africa-mideast')
  if (zone.startsWith('America/')) return byId('north-america')
  if (zone.startsWith('Asia/')) return byId('asia')
  if (zone.startsWith('Australia/') || zone.startsWith('Pacific/'))
    return byId('oceania')
  return WORLD_REGION
}
