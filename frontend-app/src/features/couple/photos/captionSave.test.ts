import { describe, it, expect, vi } from 'vitest'
import { runCaptionSave, type CaptionSaveDeps } from './captionSave'

// Issue #302 (item 3): the caption modal used to fire updateCaption.mutate and
// close immediately, so a rejected PATCH silently discarded the caption the
// couple had just typed. These tests pin the contract of runCaptionSave, the
// pure orchestration the Save button now goes through: close ONLY on success,
// show the failure reason in the modal, and never leak a rejection.

function deps(overrides: Partial<CaptionSaveDeps> = {}): CaptionSaveDeps {
  return {
    save: async () => undefined,
    close: () => undefined,
    showError: () => undefined,
    clearError: () => undefined,
    ...overrides,
  }
}

describe('runCaptionSave (issue #302)', () => {
  it('closes the modal only after the save resolves', async () => {
    const order: string[] = []
    const result = await runCaptionSave(deps({
      save: async () => { order.push('save') },
      close: () => { order.push('close') },
    }))
    expect(result).toBe('saved')
    expect(order).toEqual(['save', 'close'])
  })

  it('keeps the modal open when the save rejects', async () => {
    // The core bug: the old code closed unconditionally, so the typed caption
    // vanished. A failure must never call close.
    const close = vi.fn()
    const result = await runCaptionSave(deps({
      save: async () => { throw new Error('boom') },
      close,
    }))
    expect(result).toBe('error')
    expect(close).not.toHaveBeenCalled()
  })

  it('shows the backend ProblemDetail reason in the modal on failure', async () => {
    const showError = vi.fn()
    await runCaptionSave(deps({
      save: async () => {
        throw { response: { data: { detail: 'Caption must be at most 500 characters' } } }
      },
      showError,
    }))
    expect(showError).toHaveBeenCalledWith('Caption must be at most 500 characters')
  })

  it('falls back to a friendly message when the failure has no ProblemDetail', async () => {
    const showError = vi.fn()
    await runCaptionSave(deps({
      save: async () => { throw new Error('Network Error') },
      showError,
    }))
    expect(showError).toHaveBeenCalledWith('Could not save the caption. Please try again.')
  })

  it('clears any prior in-modal error before a retry attempt', async () => {
    const order: string[] = []
    await runCaptionSave(deps({
      clearError: () => { order.push('clear') },
      save: async () => { order.push('save') },
    }))
    expect(order).toEqual(['clear', 'save'])
  })

  it('never throws when the save rejects', async () => {
    await expect(
      runCaptionSave(deps({ save: async () => { throw new Error('boom') } })),
    ).resolves.toBe('error')
  })
})
