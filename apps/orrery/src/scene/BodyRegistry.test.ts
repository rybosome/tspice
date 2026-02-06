import { describe, expect, it } from 'vitest'

import { resolveBodyRegistryEntry } from './BodyRegistry.js'

describe('resolveBodyRegistryEntry', () => {
  it('resolves numeric ids with leading zeros and + sign', () => {
    const earthBy399 = resolveBodyRegistryEntry('399')
    expect(earthBy399?.id).toBe('EARTH')

    expect(resolveBodyRegistryEntry('00399')?.id).toBe('EARTH')
    expect(resolveBodyRegistryEntry('+00399')?.id).toBe('EARTH')
  })

  it('rejects exponent-style strings (treated as non-numeric)', () => {
    expect(resolveBodyRegistryEntry('3e2')).toBeUndefined()
  })
})
