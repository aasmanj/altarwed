// The add-member submit flow is two sequential mutations: create the member,
// then (optionally) upload their photo. The failure modes differ, so the flow is
// extracted here as a pure, dependency-injected function (same pattern as
// runPortfolioPhotoDelete) so the branching is unit-testable without a DOM.
//
// The bug this fixes (issue #303): when the create succeeded but the upload
// failed, the form stayed open showing an upload error. The member was already
// in the cache (useAddMember's onSuccess appended it), so re-clicking Add
// created a duplicate on the couple's public wedding site. The correct outcome
// is to CLOSE the form (the member exists; there is nothing left to re-submit)
// and point the couple at the existing hover-the-avatar retry path for the photo.

export const PHOTO_UPLOAD_RETRY_MESSAGE =
  'Member added, but the photo failed to upload. Click their photo to retry.'

export type AddMemberSubmitResult = 'created' | 'created-photo-failed' | 'create-failed'

export interface AddMemberSubmitDeps {
  /** Runs the create mutation; resolves to the created member (needs its id for the upload). */
  createMember: () => Promise<{ id: string } | null | undefined>
  /** Runs the photo upload for the created member, or null when no photo was picked. */
  uploadPhoto: ((memberId: string) => Promise<unknown>) | null
  /** Closes the add-member form. */
  closeForm: () => void
  /** Surfaces the "member added, photo failed, retry via avatar" guidance. */
  onPhotoUploadFailed: () => void
}

export async function runAddMemberSubmit(deps: AddMemberSubmitDeps): Promise<AddMemberSubmitResult> {
  let created: { id: string } | null | undefined
  try {
    created = await deps.createMember()
  } catch {
    // Nothing was persisted, so keep the form open for a clean retry. The
    // useAddMember onError toast already told the couple why it failed.
    return 'create-failed'
  }

  if (deps.uploadPhoto && created?.id) {
    try {
      await deps.uploadPhoto(created.id)
    } catch {
      // The member exists and is already in the cache. Closing the form is what
      // removes the duplicate-create path; the photo is retryable in place.
      deps.onPhotoUploadFailed()
      deps.closeForm()
      return 'created-photo-failed'
    }
  }

  deps.closeForm()
  return 'created'
}
