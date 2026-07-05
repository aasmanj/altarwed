// Pure save-then-close orchestration for the photo caption modal, kept out of
// the React component so it can be unit-tested with no DOM (mirrors
// portfolioPhotoDelete on the vendor side). Before issue #302 the Save button
// fired updateCaption.mutate and closed the modal immediately, so a rejected
// PATCH silently discarded the caption the couple had just typed. This enforces
// the two guarantees:
//   1. The modal closes only after the server accepted the caption.
//   2. A failed save keeps the modal (and the typed text) open and shows the
//      backend reason inside the modal instead of failing quietly.

import { errorDetail } from '@/lib/apiError'

export interface CaptionSaveDeps {
  // Perform the caption PATCH. Rejects on a network/server failure.
  save: () => Promise<unknown>
  // Close the modal (clears the editing state). Called only on success.
  close: () => void
  // Show a user-visible error message inside the modal.
  showError: (message: string) => void
  // Clear any prior in-modal error before a new attempt.
  clearError: () => void
}

export type CaptionSaveResult = 'saved' | 'error'

// Run the full save-then-close flow. Never throws: a rejected save is turned
// into an in-modal error message here, so callers can fire-and-forget.
export async function runCaptionSave(deps: CaptionSaveDeps): Promise<CaptionSaveResult> {
  deps.clearError()
  try {
    await deps.save()
    deps.close()
    return 'saved'
  } catch (err) {
    deps.showError(errorDetail(err, 'Could not save the caption. Please try again.'))
    return 'error'
  }
}
