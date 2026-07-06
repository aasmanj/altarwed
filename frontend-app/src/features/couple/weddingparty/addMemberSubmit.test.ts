import { describe, it, expect, vi } from 'vitest'
import { runAddMemberSubmit, type AddMemberSubmitDeps } from './addMemberSubmit'

// Issue #303: when the member create succeeded but the photo upload failed, the
// add form stayed open showing an upload error. The member was already in the
// cache (useAddMember's onSuccess appends it), so re-clicking Add duplicated the
// member on the couple's public wedding site. The flow must close the form after
// a successful create no matter what the upload does, so no re-submit (and no
// second create) is possible; the photo is retryable via the avatar hover path.

function deps(overrides: Partial<AddMemberSubmitDeps> = {}): AddMemberSubmitDeps {
  return {
    createMember: async () => ({ id: 'm1' }),
    uploadPhoto: null,
    closeForm: () => undefined,
    onPhotoUploadFailed: () => undefined,
    ...overrides,
  }
}

describe('runAddMemberSubmit (issue #303)', () => {
  it('partial failure: create succeeds, upload fails, form closes, create ran exactly once', async () => {
    const createMember = vi.fn(async () => ({ id: 'm1' }))
    const uploadPhoto = vi.fn(async () => { throw new Error('upload boom') })
    const closeForm = vi.fn()
    const onPhotoUploadFailed = vi.fn()

    const result = await runAddMemberSubmit(
      deps({ createMember, uploadPhoto, closeForm, onPhotoUploadFailed }),
    )

    expect(result).toBe('created-photo-failed')
    // The duplicate-member bug: exactly one create, and the form is closed so
    // there is no path to a second one.
    expect(createMember).toHaveBeenCalledTimes(1)
    expect(closeForm).toHaveBeenCalledTimes(1)
    // The retry guidance (toast) fires so the failure is not silent.
    expect(onPhotoUploadFailed).toHaveBeenCalledTimes(1)
    // Upload was attempted against the created member's id.
    expect(uploadPhoto).toHaveBeenCalledWith('m1')
  })

  it('create failure: keeps the form open (nothing persisted, retry is safe)', async () => {
    const closeForm = vi.fn()
    const onPhotoUploadFailed = vi.fn()
    const uploadPhoto = vi.fn(async () => undefined)

    const result = await runAddMemberSubmit(deps({
      createMember: async () => { throw new Error('create boom') },
      uploadPhoto,
      closeForm,
      onPhotoUploadFailed,
    }))

    expect(result).toBe('create-failed')
    expect(closeForm).not.toHaveBeenCalled()
    expect(uploadPhoto).not.toHaveBeenCalled()
    expect(onPhotoUploadFailed).not.toHaveBeenCalled()
  })

  it('never throws when the create rejects (no unhandled rejection from the form)', async () => {
    await expect(
      runAddMemberSubmit(deps({ createMember: async () => { throw new Error('boom') } })),
    ).resolves.toBe('create-failed')
  })

  it('happy path with a photo: uploads then closes the form', async () => {
    const uploadPhoto = vi.fn(async () => undefined)
    const closeForm = vi.fn()
    const onPhotoUploadFailed = vi.fn()

    const result = await runAddMemberSubmit(deps({ uploadPhoto, closeForm, onPhotoUploadFailed }))

    expect(result).toBe('created')
    expect(uploadPhoto).toHaveBeenCalledWith('m1')
    expect(closeForm).toHaveBeenCalledTimes(1)
    expect(onPhotoUploadFailed).not.toHaveBeenCalled()
  })

  it('happy path without a photo: just closes the form', async () => {
    const closeForm = vi.fn()
    const result = await runAddMemberSubmit(deps({ closeForm }))
    expect(result).toBe('created')
    expect(closeForm).toHaveBeenCalledTimes(1)
  })
})
