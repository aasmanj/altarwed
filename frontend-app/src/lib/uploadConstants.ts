// Single source of truth for the client-side image upload size limit.
//
// The SERVER is the authoritative enforcement (MediaUploadService.MAX_BYTES and
// spring.servlet.multipart.max-file-size, both 20 MB). These constants exist only for
// early UX rejection and label copy so the user is not made to upload a 25 MB file just to
// be told no. Keep this value in lockstep with the backend; they are deliberately the same
// number documented in two places (one per runtime) rather than fetched, to avoid a round
// trip on every file pick.
export const MAX_UPLOAD_MB = 20
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
