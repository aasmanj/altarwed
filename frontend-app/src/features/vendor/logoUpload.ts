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

import { MAX_UPLOAD_LABEL, runImageUpload, type ImageUploadDeps } from '@/lib/upload'

// The logo uploader's dependencies are just the shared image-upload deps; keep
// the alias so existing call sites and tests import it from here.
export type LogoUploadDeps = ImageUploadDeps

// Run the full pick-to-upload flow for a single logo file. Returns null on
// success, or a user-facing error message to display. Never throws. This now
// delegates to the shared runImageUpload orchestrator (single source of truth
// for the pre-check + error-surfacing flow) and only supplies logo-specific copy.
export async function runLogoUpload(picked: File, deps: LogoUploadDeps): Promise<string | null> {
  return runImageUpload(picked, deps, {
    tooLarge: `Logo must be under ${MAX_UPLOAD_LABEL}.`,
    uploadFailed: 'Logo upload failed. Please try again.',
  })
}
