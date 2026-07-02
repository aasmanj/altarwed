// Pure confirm-then-delete orchestration for a vendor portfolio photo, kept out
// of the React component so it can be unit-tested with no DOM (mirrors
// logoUpload on this same page). Before issue #183 the delete "x" called
// deletePortfolioPhoto.mutate(id) directly on click: no confirmation, no undo,
// and the mutation had no onError so a failed delete vanished silently. The
// backend hard-deletes the row and the blob, so an accidental click was
// unrecoverable. This enforces the two guarantees every other destructive
// action in the app already has:
//   1. Nothing happens until the vendor explicitly confirms.
//   2. A failed delete surfaces a user-visible reason instead of failing quietly.

export interface PortfolioPhotoDeleteDeps {
  // Show the shared danger-tone confirmation dialog. Resolves true if the vendor
  // confirms, false if they cancel (Escape, backdrop, or Cancel).
  confirm: () => Promise<boolean>
  // Perform the delete. Rejects on a network/server failure.
  deletePhoto: () => Promise<unknown>
  // Surface a user-visible error message (reuses the page's portfolio error).
  onError: (message: string) => void
  // Clear any prior error before attempting the delete.
  clearError: () => void
}

export type PortfolioPhotoDeleteResult = 'deleted' | 'cancelled' | 'error'

// Run the full confirm-then-delete flow for one portfolio photo. Never throws:
// a rejected delete is turned into an onError message here.
export async function runPortfolioPhotoDelete(
  deps: PortfolioPhotoDeleteDeps,
): Promise<PortfolioPhotoDeleteResult> {
  if (!(await deps.confirm())) return 'cancelled'
  deps.clearError()
  try {
    await deps.deletePhoto()
    return 'deleted'
  } catch {
    deps.onError('Could not delete the photo. Please try again.')
    return 'error'
  }
}
