/**
 * NAIF-ID keyed "extras" dataset + viewer-specific bodies.
 *
 * This file intentionally stays small and optional: the viewer should work with
 * zero extras.
 *
 * It currently contains:
 * - `getNaifExtras`: small physical-parameter metadata for a few standard NAIF bodies
 * - `COMET_EXTRAS`: comet definitions used for generated comet ephemeris kernels
 *   (see `scripts/generate-comet-kernels.py`).
 *
 * Sources for `getNaifExtras` values (retrieved 2026-01-31):
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

export const COMET_EXTRAS = [
  { id: 'COMET_1P_HALLEY', label: '1P/Halley', horizonsDesignation: '1P', body: 90000030 },
  { id: 'COMET_2P_ENCKE', label: '2P/Encke', horizonsDesignation: '2P', body: 90000091 },
  { id: 'COMET_9P_TEMPEL_1', label: '9P/Tempel 1', horizonsDesignation: '9P', body: 90000192 },
  { id: 'COMET_10P_TEMPEL_2', label: '10P/Tempel 2', horizonsDesignation: '10P', body: 90000214 },
  { id: 'COMET_12P_PONS_BROOKS', label: '12P/Pons-Brooks', horizonsDesignation: '12P', body: 90000224 },
  { id: 'COMET_17P_HOLMES', label: '17P/Holmes', horizonsDesignation: '17P', body: 90000286 },
  { id: 'COMET_19P_BORRELLY', label: '19P/Borrelly', horizonsDesignation: '19P', body: 90000305 },
  { id: 'COMET_21P_GIACOBINI_ZINNER', label: '21P/Giacobini-Zinner', horizonsDesignation: '21P', body: 90000323 },
  {
    id: 'COMET_45P_HONDA_MRKOS_PAJDUSAKOVA',
    label: '45P/Honda–Mrkos–Pajdušáková',
    horizonsDesignation: '45P',
    body: 90000535,
  },
  { id: 'COMET_46P_WIRTANEN', label: '46P/Wirtanen', horizonsDesignation: '46P', body: 90000547 },
  { id: 'COMET_55P_TEMPEL_TUTTLE', label: '55P/Tempel-Tuttle', horizonsDesignation: '55P', body: 90000625 },
  {
    id: 'COMET_67P_CHURYUMOV_GERASIMENKO',
    label: '67P/Churyumov–Gerasimenko',
    horizonsDesignation: '67P',
    body: 90000702,
  },
  {
    id: 'COMET_73P_SCHWASSMANN_WACHMANN_3',
    label: '73P/Schwassmann–Wachmann 3',
    horizonsDesignation: '73P',
    body: 90000739,
  },
  { id: 'COMET_81P_WILD_2', label: '81P/Wild 2', horizonsDesignation: '81P', body: 90000861 },
  { id: 'COMET_96P_MACHHOLZ_1', label: '96P/Machholz 1', horizonsDesignation: '96P', body: 90000928 },
  { id: 'COMET_103P_HARTLEY_2', label: '103P/Hartley 2', horizonsDesignation: '103P', body: 90000956 },
  {
    id: 'COMET_C_1995_O1_HALE_BOPP',
    label: 'C/1995 O1 (Hale–Bopp)',
    horizonsDesignation: 'C/1995 O1',
    body: 90002244,
  },
  {
    id: 'COMET_C_1996_B2_HYAKUTAKE',
    label: 'C/1996 B2 (Hyakutake)',
    horizonsDesignation: 'C/1996 B2',
    body: 90002250,
  },
  {
    id: 'COMET_C_2006_P1_MCNAUGHT',
    label: 'C/2006 P1 (McNaught)',
    horizonsDesignation: 'C/2006 P1',
    body: 90003677,
  },
  {
    id: 'COMET_C_2020_F3_NEOWISE',
    label: 'C/2020 F3 (NEOWISE)',
    horizonsDesignation: 'C/2020 F3',
    body: 90004589,
  },
] as const

export type CometBodyId = (typeof COMET_EXTRAS)[number]['id']

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
