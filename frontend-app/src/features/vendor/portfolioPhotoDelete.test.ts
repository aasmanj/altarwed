import { describe, it, expect, vi } from 'vitest'
import { runPortfolioPhotoDelete, type PortfolioPhotoDeleteDeps } from './portfolioPhotoDelete'

function deps(overrides: Partial<PortfolioPhotoDeleteDeps> = {}): PortfolioPhotoDeleteDeps {
  return {
    confirm: async () => true,
    deletePhoto: async () => undefined,
    onError: () => undefined,
    clearError: () => undefined,
    ...overrides,
  }
}

describe('runPortfolioPhotoDelete', () => {
  it('deletes the photo only after the vendor confirms (#183)', async () => {
    const deletePhoto = vi.fn(async () => undefined)
    const result = await runPortfolioPhotoDelete(deps({ confirm: async () => true, deletePhoto }))
    expect(deletePhoto).toHaveBeenCalledTimes(1)
    expect(result).toBe('deleted')
  })

  it('leaves the photo untouched when the vendor cancels the dialog', async () => {
    // The core bug: the old code deleted on click with no confirmation. Cancelling
    // must never call the delete mutation, and must not touch the error state.
    const deletePhoto = vi.fn(async () => undefined)
    const onError = vi.fn()
    const clearError = vi.fn()
    const result = await runPortfolioPhotoDelete(
      deps({ confirm: async () => false, deletePhoto, onError, clearError }),
    )
    expect(deletePhoto).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    expect(clearError).not.toHaveBeenCalled()
    expect(result).toBe('cancelled')
  })

  it('clears any prior error before attempting a confirmed delete', async () => {
    const clearError = vi.fn()
    await runPortfolioPhotoDelete(deps({ confirm: async () => true, clearError }))
    expect(clearError).toHaveBeenCalledTimes(1)
  })

  it('surfaces a user-visible error when the delete fails instead of failing silently', async () => {
    // The mutation previously had no onError handler, so a failed delete vanished
    // and the vendor was left thinking the photo was gone when it was not.
    const deletePhoto = vi.fn(async () => { throw new Error('Network Error') })
    const onError = vi.fn()
    const result = await runPortfolioPhotoDelete(
      deps({ confirm: async () => true, deletePhoto, onError }),
    )
    expect(onError).toHaveBeenCalledWith('Could not delete the photo. Please try again.')
    expect(result).toBe('error')
  })

  it('never throws when the delete rejects', async () => {
    const deletePhoto = vi.fn(async () => { throw new Error('boom') })
    await expect(
      runPortfolioPhotoDelete(deps({ confirm: async () => true, deletePhoto })),
    ).resolves.toBe('error')
  })
})
