import { describe, it, expect } from 'vitest'
import {
  EDITOR_ORIGINS,
  parseTabSwitch,
  makeTabSwitchAckMessage,
  makePreviewTabReadyMessage,
  parseBlocksUpdate,
} from './previewMessages'

// Message-contract unit tests for issue #310 (preview side). The editor side
// of this contract has its own mirror tests in
// frontend-app/src/features/couple/website/blocks/previewChannel.test.ts.

describe('previewMessages message contract (issue #310)', () => {
  it('whitelists only the dashboard app origins', () => {
    expect(EDITOR_ORIGINS).toContain('https://app.altarwed.com')
    expect(EDITOR_ORIGINS).not.toContain('*')
  })

  describe('parseTabSwitch', () => {
    it('returns the requested tab and switchId for a well-formed tab-switch message', () => {
      expect(parseTabSwitch({ type: 'tab-switch', tab: 'REGISTRY', switchId: 3 })).toEqual({ tab: 'REGISTRY', switchId: 3 })
    })

    it('rejects the wrong message type', () => {
      expect(parseTabSwitch({ type: 'blocks-update', tab: 'REGISTRY', switchId: 1 })).toBeNull()
    })

    it('rejects a tab outside the known whitelist (never drives router.push blindly)', () => {
      expect(parseTabSwitch({ type: 'tab-switch', tab: 'NOT_A_REAL_TAB', switchId: 1 })).toBeNull()
      expect(parseTabSwitch({ type: 'tab-switch', tab: '../../etc/passwd', switchId: 1 })).toBeNull()
    })

    it('rejects a missing or non-numeric switchId', () => {
      expect(parseTabSwitch({ type: 'tab-switch', tab: 'REGISTRY' })).toBeNull()
      expect(parseTabSwitch({ type: 'tab-switch', tab: 'REGISTRY', switchId: '3' })).toBeNull()
    })

    it('rejects malformed/absent data without throwing', () => {
      expect(parseTabSwitch(null)).toBeNull()
      expect(parseTabSwitch(undefined)).toBeNull()
      expect(parseTabSwitch('tab-switch')).toBeNull()
      expect(parseTabSwitch({})).toBeNull()
      expect(parseTabSwitch({ type: 'tab-switch' })).toBeNull()
    })
  })

  describe('makeTabSwitchAckMessage / makePreviewTabReadyMessage', () => {
    it('builds the ack message for the tab and switchId that was switched to, echoing the id back', () => {
      expect(makeTabSwitchAckMessage('PHOTOS', 5)).toEqual({ type: 'tab-switch-ack', tab: 'PHOTOS', switchId: 5 })
    })

    it('builds the ready message for the tab that finished mounting', () => {
      expect(makePreviewTabReadyMessage('TRAVEL')).toEqual({ type: 'preview-tab-ready', tab: 'TRAVEL' })
    })
  })

  describe('parseBlocksUpdate', () => {
    const blocks = [{ id: '1', weddingWebsiteId: 'w1', tab: 'HOME' as const, type: 'TEXT' as const, sortOrder: 0, contentJson: '{}' }]

    it('returns the blocks when the message is tagged for the current tab', () => {
      expect(parseBlocksUpdate({ type: 'blocks-update', tab: 'HOME', blocks }, 'HOME')).toEqual(blocks)
    })

    it('drops an update meant for a different tab (mid client-side navigation)', () => {
      // Guards the exact race the tagging exists for: a preview about to swap
      // from HOME to RSVP must not apply a late HOME update after RSVP's data
      // has already loaded and rendered.
      expect(parseBlocksUpdate({ type: 'blocks-update', tab: 'HOME', blocks }, 'RSVP')).toBeNull()
    })

    it('rejects malformed data without throwing', () => {
      expect(parseBlocksUpdate(null, 'HOME')).toBeNull()
      expect(parseBlocksUpdate({ type: 'blocks-update', tab: 'HOME' }, 'HOME')).toBeNull()
      expect(parseBlocksUpdate({ type: 'blocks-update', tab: 'HOME', blocks: 'nope' }, 'HOME')).toBeNull()
    })
  })
})
