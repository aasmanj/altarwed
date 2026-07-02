// Pure logo-upload orchestration for the vendor listing page, kept out of the
// React component so it can be unit-tested with no DOM (mirrors photoBatchUpload
// on the couple side). This is the only revenue-side upload path, and before
// issue #145 it did neither of the two things every other uploader does: it had
// no client-side size pre-check and it swallowed the backend's real reason into
// a fixed "Logo upload failed" string, so a vendor whose HEIC logo transcodes
// past the cap re-picked the same file and failed forever with no explanation.
//
// The rules this enforces, matching the couple-side uploaders:
//  1. Size-check the file AFTER normalization (HEIC balloons once it becomes
//     JPEG, so the post-transcode size is what we actually send).
//  2. Surface the backend ProblemDetail on failure via uploadErrorMessage so the
//     real reason (size, type, dimensions) reaches the vendor.

import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, uploadErrorMessage } from '@/lib/upload'

export interface LogoUploadDeps {
  // Convert HEIC/HEIF to JPEG (returns the file unchanged otherwise).
  normalize: (file: File) => Promise<File>
  // Actually upload one already-validated file. May reject (network/server error).
  upload: (file: File) => Promise<unknown>
}

// Run the full pick-to-upload flow for a single logo file. Returns null on
// success, or a user-facing error message to display. Never throws: a rejected
// normalize/upload is turned into an actionable message here.
export async function runLogoUpload(picked: File, deps: LogoUploadDeps): Promise<string | null> {
  try {
    const normalized = await deps.normalize(picked)
    // Client-side pre-check: bail before any network call so an oversize file
    // gets an instant, specific reason instead of a doomed round trip.
    if (normalized.size > MAX_UPLOAD_BYTES) {
      return `Logo must be under ${MAX_UPLOAD_LABEL}.`
    }
    await deps.upload(normalized)
    return null
  } catch (err: unknown) {
    return uploadErrorMessage(err, 'Logo upload failed. Please try again.')
  }
}
