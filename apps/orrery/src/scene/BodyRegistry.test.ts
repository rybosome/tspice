import { describe, expect, it } from 'vitest'

import { __testing, resolveBodyRegistryEntry } from './BodyRegistry.js'

describe('canonicalizeResolveKey', () => {
  it('trims whitespace', () => {
    expect(__testing.canonicalizeResolveKey('  EARTH  ')).toBe('EARTH')
  })

  it('normalizes -0 to 0 (safe integer)', () => {
    expect(__testing.canonicalizeResolveKey('-0')).toBe('0')
    expect(__testing.canonicalizeResolveKey('  -000  ')).toBe('0')
  })

  it('treats unsafe integers as opaque strings (and strips leading +)', () => {
    expect(__testing.canonicalizeResolveKey('+9007199254740992')).toBe('9007199254740992')
    expect(__testing.canonicalizeResolveKey('-9007199254740992')).toBe('-9007199254740992')
  })
})

describe('resolveBodyRegistryEntry', () => {
  it('resolves numeric ids with leading zeros and + sign', () => {
    const earthBy399 = resolveBodyRegistryEntry('399')
    expect(earthBy399?.id).toBe('EARTH')

    expect(resolveBodyRegistryEntry('00399')?.id).toBe('EARTH')
    expect(resolveBodyRegistryEntry('+00399')?.id).toBe('EARTH')
    expect(resolveBodyRegistryEntry('  +00399  ')?.id).toBe('EARTH')
  })

  it('rejects exponent-style strings (treated as non-numeric)', () => {
    expect(resolveBodyRegistryEntry('3e2')).toBeUndefined()
  })
})
