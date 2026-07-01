import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the analytics boundary so the test asserts the exact event name and
// payload we hand to PostHog, without needing a real (or configured) client.
const captureEvent = vi.fn()
vi.mock('@/core/analytics/analytics', () => ({
  captureEvent: (event: string, props?: Record<string, unknown>) => captureEvent(event, props),
}))

// Imported after the mock is registered so the helper binds to the mocked
// captureEvent.
import { trackShareClicked, type ShareChannel } from './shareAnalytics'

describe('trackShareClicked (issue #158)', () => {
  beforeEach(() => {
    captureEvent.mockClear()
  })

  it('fires a share_clicked event with the channel property', () => {
    trackShareClicked('facebook')
    expect(captureEvent).toHaveBeenCalledTimes(1)
    expect(captureEvent).toHaveBeenCalledWith('share_clicked', { channel: 'facebook' })
  })

  it('identifies every share channel the ShareModal exposes', () => {
    const channels: ShareChannel[] = ['copy_link', 'native', 'facebook', 'sms']
    for (const channel of channels) {
      captureEvent.mockClear()
      trackShareClicked(channel)
      expect(captureEvent).toHaveBeenCalledWith('share_clicked', { channel })
    }
  })
})
