/**
 * Body radius scaling utilities for True and Enhanced scale modes.
 *
 * Enhanced mode uses a power-law compression to make small bodies visible
 * alongside larger ones at solar system scale, plus a minimum size clamp.
 */

export type ScaleMode = 'true' | 'enhanced'

/**
 * Configuration for enhanced scaling.
 *
 * The power-law formula is: r_enhanced = ref * (r / ref)^p
 * where ref is a reference radius (e.g. Earth's radius) and p < 1 compresses the range.
 */
export interface EnhancedScaleConfig {
  /** Reference radius in km (used to normalize the power-law). */
  referenceRadiusKm: number
  /** Power exponent (< 1 compresses, 1 = no change). */
  power: number
  /** Minimum world-unit radius to ensure tiny bodies remain visible. */
  minWorldRadius: number
}

/** Default enhanced scale configuration tuned for solar system visualization. */
export const DEFAULT_ENHANCED_CONFIG: EnhancedScaleConfig = {
  // Earth radius as reference point
  referenceRadiusKm: 6_371,
  // p = 0.35 provides good compression: Sun shrinks a bit, small planets grow
  power: 0.35,
  // Minimum world radius to keep tiny bodies visible
  // At kmToWorld = 1e-6, this is ~500 km equivalent
  minWorldRadius: 0.0005,
}

/** Options for {@link computeBodyRadiusWorld}. */
export interface ComputeBodyRadiusWorldOptions {
  /** Physical radius in km. */
  radiusKm: number
  /** Conversion factor from km to world units. */
  kmToWorld: number
  /** Scale mode: 'true' for physically accurate, 'enhanced' for visual compression. */
  mode: ScaleMode
  /** Enhanced scale configuration (uses defaults if not provided). */
  enhancedConfig?: EnhancedScaleConfig
}

/**
 * Compute the world-unit radius for a body based on the scale mode.
 *
 * - True mode: radiusWorld = radiusKm * kmToWorld (physically accurate)
 * - Enhanced mode: power-law compression + min clamp for visibility
 */
export function computeBodyRadiusWorld(options: ComputeBodyRadiusWorldOptions): number {
  const { radiusKm, kmToWorld, mode, enhancedConfig = DEFAULT_ENHANCED_CONFIG } = options

  if (mode === 'true') {
    return radiusKm * kmToWorld
  }

  // Enhanced mode: power-law compression
  const { referenceRadiusKm, power, minWorldRadius } = enhancedConfig

  // r_enhanced = ref * (r / ref)^p
  // This preserves units and keeps ref-sized objects at their original scale
  const ratio = radiusKm / referenceRadiusKm
  const enhancedRadiusKm = referenceRadiusKm * Math.pow(ratio, power)
  const enhancedWorldRadius = enhancedRadiusKm * kmToWorld

  // Apply minimum clamp
  return Math.max(enhancedWorldRadius, minWorldRadius)
}
