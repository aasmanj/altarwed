// Single source of truth for the client-side upload limit and upload-error copy.
//
// Why this exists: the size cap used to be hardcoded per file as a mix of
// "15 MB" / "20 MB" literals in both the checks and the labels, so a label
// could drift out of sync with the check right next to it (and both out of sync
// with the backend). The backend's unified cap is 20 MB (MediaUploadService
// MAX_BYTES, #130). Every client size check and every user-facing label now
// reads from the constants below, so the number can never drift again.
// See issues #93 and #136.

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

// Human-readable form of the cap for labels and messages. Kept next to the byte
// value so the two can never disagree.
export const MAX_UPLOAD_LABEL = '20 MB'

// Copy for a client-side "the file is bigger than the cap" rejection. Callers
// use this before uploading; the server-side equivalent (413) reuses the same
// wording via uploadErrorMessage below, so the couple sees one consistent
// message whether the file is caught client-side or server-side.
export const FILE_TOO_LARGE_MESSAGE =
  `Photo too large (max ${MAX_UPLOAD_LABEL}). Try compressing it or choosing a smaller file.`

// The short "your photo is over the cap" copy used by the client-side pre-check
// (before any upload fires). Matches the wording the wedding-party add form and
// the vendor logo uploader already show, so every photo picker in the app fails
// with the same specific message instead of a generic "Upload failed". Reads the
// shared label so it can never drift from the byte cap above.
export const PHOTO_TOO_LARGE_MESSAGE = `Photo must be under ${MAX_UPLOAD_LABEL}.`

// Shape of an Axios-style error we care about: a response with a status and,
// for a Spring ProblemDetail body, a `detail` string explaining the rejection.
interface UploadErrorLike {
  response?: {
    status?: number
    data?: unknown
  }
}

// Pull the ProblemDetail `detail` off a 400 body, if present and non-empty.
// Spring serializes service-level rejections (size over the cap, wrong type,
// image dimensions over the pixel limit) as `application/problem+json` with a
// human-readable `detail`; surfacing it tells the couple the real reason
// instead of a generic "upload failed".
function problemDetail(data: unknown): string | null {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.trim().length > 0) return detail
  }
  return null
}

// Turn an upload failure into a friendly, actionable message.
//
// Priority:
//  - 400: the backend's service-level rejection carries a ProblemDetail
//    `detail` (size, type mismatch, dimensions). Show it verbatim.
//  - 413: the request exceeded the servlet max upload size (GlobalException
//    handler, #122). Show the size-cap message.
//  - 415: unsupported media type. Ask for a supported format.
//  - 401/403: the session lapsed. Prompt a refresh.
//  - anything else (network blip, 5xx): the caller's fallback.
export function uploadErrorMessage(
  err: unknown,
  fallback = 'Upload failed. Check your connection and try again, or choose a different photo.',
): string {
  const response = (err as UploadErrorLike)?.response
  const status = response?.status
  if (status === 400) {
    const detail = problemDetail(response?.data)
    if (detail) return detail
  }
  if (status === 413) return FILE_TOO_LARGE_MESSAGE
  if (status === 415) return 'Format not supported. Please upload a JPEG, PNG, or WebP photo.'
  if (status === 401 || status === 403) return 'Session expired. Refresh the page and try again.'
  return fallback
}

// Dependencies for a single pick-to-upload run, injected so the orchestration
// below is pure and unit-testable with no DOM (mirrors the logo/photo-batch
// helpers).
export interface ImageUploadDeps {
  // Convert HEIC/HEIF to JPEG (returns the file unchanged otherwise).
  normalize: (file: File) => Promise<File>
  // Upload one already-validated file. May reject (network / server error).
  upload: (file: File) => Promise<unknown>
}

// Caller-supplied copy so each entry point keeps its own voice while sharing the
// exact same control flow.
export interface ImageUploadCopy {
  // Shown when the file is over MAX_UPLOAD_BYTES (client-side pre-check).
  tooLarge: string
  // Fallback when the failure carries no actionable server reason.
  uploadFailed: string
}

// Run the full pick-to-upload flow for one image. Returns null on success, or a
// user-facing error string to display. Never throws: a rejected normalize/upload
// is turned into an actionable message here. This is the single shared path so
// every uploader (logo, portfolio, wedding-party avatar) gets the same two
// guarantees the couple-side batch uploader already had:
//  1. Size-check the file AFTER normalization (HEIC balloons once it becomes
//     JPEG, so the post-transcode size is what we actually send), bailing before
//     any network call so an oversize file gets an instant, specific reason.
//  2. Surface the backend ProblemDetail / status via uploadErrorMessage so the
//     real reason (size, type, dimensions) reaches the user instead of a generic
//     "Upload failed".
export async function runImageUpload(
  picked: File,
  deps: ImageUploadDeps,
  copy: ImageUploadCopy,
): Promise<string | null> {
  try {
    const normalized = await deps.normalize(picked)
    if (normalized.size > MAX_UPLOAD_BYTES) {
      return copy.tooLarge
    }
    await deps.upload(normalized)
    return null
  } catch (err: unknown) {
    return uploadErrorMessage(err, copy.uploadFailed)
  }
}
