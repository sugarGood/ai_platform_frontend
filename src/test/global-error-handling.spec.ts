import { describe, expect, it } from 'vitest'

import { formatUnknownError } from '../lib/global-error-handling'

describe('global-error-handling', () => {
  it('formats Error instances', () => {
    expect(formatUnknownError(new Error('boom'))).toBe('boom')
  })

  it('formats strings', () => {
    expect(formatUnknownError('plain')).toBe('plain')
  })

  it('falls back for unknown shapes', () => {
    expect(formatUnknownError(null)).toBe('null')
    expect(formatUnknownError(undefined)).toBe('undefined')
  })
})
