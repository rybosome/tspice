import type { BodyRef } from '../../spice/SpiceClient.js'

const DAY_SEC = 86_400

/**
* Approximate **sidereal** orbital periods.
*
* MVP notes:
* - Planets are keyed by their NAIF barycenter IDs (1..8) used by this viewer.
* - Earth/Moon are keyed by their SPICE name strings.
*/
const SIDEREAL_PERIOD_DAYS_BY_BODY_KEY: Readonly<Record<string, number>> = {
  // de432s provides planet barycenters for most planets.
  '1': 87.969, // Mercury
  '2': 224.701, // Venus
  EARTH: 365.256, // Earth
  '4': 686.980, // Mars
  '5': 4332.589, // Jupiter
  '6': 10_759.22, // Saturn
  '7': 30_685.4, // Uranus
  '8': 60_189.0, // Neptune
  MOON: 27.321_661, // Moon
}

export function getApproxOrbitalPeriodSec(body: BodyRef): number | undefined {
  const days = SIDEREAL_PERIOD_DAYS_BY_BODY_KEY[String(body)]
  if (!days) return undefined
  return days * DAY_SEC
}

export function getOrbitAnchorQuantumSec(body: BodyRef): number {
  // Orbit paths are time-anchored, but recomputing every tick is too expensive.
  // MVP heuristic: planets update ~daily; moon updates ~hourly.
  if (String(body) === 'MOON') return 3_600
  return DAY_SEC
}
