/**
 * NAIF-ID keyed "extras" dataset.
 *
 * This is intentionally small and optional: the viewer should work with zero extras.
 *
 * Sources (retrieved 2026-01-31):
 * - NASA / NSSDCA Planetary Fact Sheet index:
 *   https://nssdc.gsfc.nasa.gov/planetary/factsheet/
 *   Individual pages used for example values:
 *   - Earth: https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
 *   - Moon:  https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
 *   - Mars:  https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
 *   - Jupiter:https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html
 * - JPL Solar System Dynamics (SSD) Planetary Physical Parameters:
 *   https://ssd.jpl.nasa.gov/planets/phys_par.html
 *
 * Notes:
 * - Values are copied directly from the linked tables (or lightly rounded) and
 *   stored in SI-ish units with units encoded in field names.
 * - If we later expand this, we should consider a more structured schema and
 *   more explicit provenance per-field.
 */

export interface NaifExtras {
  /** High-level classification for display (e.g. "planet", "moon", "star"). */
  classification?: string

  /** Mean radius in kilometers. */
  meanRadiusKm?: number

  /** Mass in kilograms. */
  massKg?: number

  /** Mean density in g/cm^3. */
  densityGcm3?: number

  /** Surface gravity in m/s^2. */
  surfaceGravityMs2?: number

  /** Escape velocity in km/s. */
  escapeVelocityKms?: number

  /** Mean temperature in Kelvin. */
  meanTemperatureK?: number

  /** Short, human-readable summary of atmosphere composition. */
  atmosphereSummary?: string

  /** Bond albedo (unitless). */
  bondAlbedo?: number

  /** Geometric albedo (unitless). */
  geometricAlbedo?: number
}

const NAIF_EXTRAS_BY_ID: Readonly<Record<string, NaifExtras>> = {
  // Sun
  '10': {
    classification: 'star',
    meanRadiusKm: 695_700,
    massKg: 1.9885e30,
    densityGcm3: 1.41,
  },

  // Planets
  '399': {
    classification: 'planet',
    meanRadiusKm: 6_371.0,
    massKg: 5.972e24,
    densityGcm3: 5.51,
    surfaceGravityMs2: 9.81,
    escapeVelocityKms: 11.19,
    meanTemperatureK: 288,
    atmosphereSummary: 'N2, O2, Ar, CO2 (trace)',
    bondAlbedo: 0.306,
  },
  '499': {
    classification: 'planet',
    meanRadiusKm: 3_389.5,
    massKg: 6.417e23,
    densityGcm3: 3.93,
    surfaceGravityMs2: 3.71,
    escapeVelocityKms: 5.03,
    meanTemperatureK: 210,
    atmosphereSummary: 'CO2, N2, Ar (trace)',
    bondAlbedo: 0.25,
  },
  '599': {
    classification: 'planet',
    meanRadiusKm: 69_911,
    massKg: 1.898e27,
    densityGcm3: 1.33,
    surfaceGravityMs2: 24.79,
    escapeVelocityKms: 59.5,
    meanTemperatureK: 165,
    atmosphereSummary: 'H2, He',
    bondAlbedo: 0.343,
    geometricAlbedo: 0.538,
  },

  // Moons
  '301': {
    classification: 'moon',
    meanRadiusKm: 1_737.4,
    massKg: 7.342e22,
    densityGcm3: 3.34,
    surfaceGravityMs2: 1.62,
    escapeVelocityKms: 2.38,
    meanTemperatureK: 220,
    bondAlbedo: 0.11,
  },
}

export function getNaifExtras(naifId: number | undefined): NaifExtras | undefined {
  if (naifId === undefined) return undefined
  return NAIF_EXTRAS_BY_ID[String(naifId)]
}
