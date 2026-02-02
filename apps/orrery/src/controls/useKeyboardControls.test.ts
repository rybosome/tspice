import { describe, expect, it } from 'vitest'

import { isEditableElement, isHelpToggleShortcut } from './useKeyboardControls.js'

describe('useKeyboardControls helpers', () => {
  describe('isHelpToggleShortcut', () => {
    it('matches ? key directly', () => {
      expect(isHelpToggleShortcut('?', true)).toBe(true)
      expect(isHelpToggleShortcut('?', false)).toBe(true)
    })

    it('matches shift + / fallback', () => {
      expect(isHelpToggleShortcut('/', true)).toBe(true)
      expect(isHelpToggleShortcut('/', false)).toBe(false)
    })
  })

  describe('isEditableElement', () => {
    it('detects common form fields', () => {
      expect(isEditableElement({ tagName: 'INPUT' })).toBe(true)
      expect(isEditableElement({ tagName: 'textarea' })).toBe(true)
      expect(isEditableElement({ tagName: 'select' })).toBe(true)
    })

    it('detects contenteditable', () => {
      expect(isEditableElement({ isContentEditable: true })).toBe(true)
    })

    it('returns false for non-editable targets', () => {
      expect(isEditableElement({ tagName: 'div' })).toBe(false)
      expect(isEditableElement(null)).toBe(false)
      expect(isEditableElement(undefined)).toBe(false)
    })
  })
})
