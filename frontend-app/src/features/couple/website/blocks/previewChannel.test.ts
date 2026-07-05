import { describe, it, expect } from 'vitest'
import {
  TAB_SWITCH_ACK_TIMEOUT_MS,
  originOf,
  makeTabSwitchMessage,
  makeBlocksUpdateMessage,
  isTabSwitchAck,
  isPreviewTabReady,
} from './previewChannel'

// Message-contract unit tests for issue #310 (editor side). The preview side
// of this contract has its own mirror tests in
// frontend-public/src/app/preview/[slug]/[tab]/previewMessages.test.ts.

describe('previewChannel message contract (issue #310)', () => {
  it('exposes a positive ack timeout so the reload fallback always eventually fires', () => {
    expect(TAB_SWITCH_ACK_TIMEOUT_MS).toBeGreaterThan(0)
  })

  describe('originOf', () => {
    it('reduces a base URL with a path/trailing slash to a bare origin', () => {
      expect(originOf('https://www.altarwed.com/')).toBe('https://www.altarwed.com')
      expect(originOf('https://www.altarwed.com')).toBe('https://www.altarwed.com')
    })

    it('preserves a non-default port', () => {
      expect(originOf('http://localhost:3000')).toBe('http://localhost:3000')
    })

    it('falls back to the raw input if it cannot be parsed as a URL', () => {
      expect(originOf('not-a-url')).toBe('not-a-url')
    })
  })

  describe('makeTabSwitchMessage / makeBlocksUpdateMessage', () => {
    it('builds a tab-switch message carrying the requested tab', () => {
      expect(makeTabSwitchMessage('REGISTRY')).toEqual({ type: 'tab-switch', tab: 'REGISTRY' })
    })

    it('builds a blocks-update message tagged with the tab it applies to', () => {
      const blocks = [{ id: '1', weddingWebsiteId: 'w1', tab: 'HOME' as const, type: 'TEXT' as const, sortOrder: 0, contentJson: '{}', createdAt: '', updatedAt: '' }]
      expect(makeBlocksUpdateMessage('HOME', blocks)).toEqual({ type: 'blocks-update', tab: 'HOME', blocks })
    })
  })

  describe('isTabSwitchAck', () => {
    it('matches an ack for the exact pending tab', () => {
      expect(isTabSwitchAck({ type: 'tab-switch-ack', tab: 'PHOTOS' }, 'PHOTOS')).toBe(true)
    })

    it('rejects an ack for a different tab (stale reply after a rapid re-click)', () => {
      expect(isTabSwitchAck({ type: 'tab-switch-ack', tab: 'PHOTOS' }, 'RSVP')).toBe(false)
    })

    it('rejects the wrong message type', () => {
      expect(isTabSwitchAck({ type: 'preview-tab-ready', tab: 'PHOTOS' }, 'PHOTOS')).toBe(false)
    })

    it('rejects malformed/absent data without throwing', () => {
      expect(isTabSwitchAck(null, 'PHOTOS')).toBe(false)
      expect(isTabSwitchAck(undefined, 'PHOTOS')).toBe(false)
      expect(isTabSwitchAck('tab-switch-ack', 'PHOTOS')).toBe(false)
      expect(isTabSwitchAck({}, 'PHOTOS')).toBe(false)
    })
  })

  describe('isPreviewTabReady', () => {
    it('matches a ready announcement for the active tab', () => {
      expect(isPreviewTabReady({ type: 'preview-tab-ready', tab: 'TRAVEL' }, 'TRAVEL')).toBe(true)
    })

    it('rejects a ready announcement for a tab the editor is no longer on', () => {
      // Guards a rapid double-switch: the editor moved on to a third tab before
      // the second tab's ready message arrived, so it must not be treated as
      // ready for whatever is currently active.
      expect(isPreviewTabReady({ type: 'preview-tab-ready', tab: 'TRAVEL' }, 'RSVP')).toBe(false)
    })

    it('rejects the wrong message type', () => {
      expect(isPreviewTabReady({ type: 'tab-switch-ack', tab: 'TRAVEL' }, 'TRAVEL')).toBe(false)
    })
  })
})
