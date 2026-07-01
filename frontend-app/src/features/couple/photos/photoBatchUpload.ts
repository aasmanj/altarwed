// Pure batch-upload orchestration for the album uploader, kept out of the React
// component so it can be unit-tested with no DOM. The single rule it enforces:
// one bad file (over the size cap, unconvertible HEIC, network blip) must never
// brick the batch. Every file is isolated in its own try/catch, failures are
// collected by name, and onProgress always fires so the caller can reset the
// spinner in a finally. See issue #92.

import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from '@/lib/upload'

// Re-exported under the album-specific name the callers/tests already use, but
// sourced from the single shared cap so it can never drift from the other
// uploaders or the backend. See issues #93 and #136.
export const MAX_PHOTO_BYTES = MAX_UPLOAD_BYTES

export interface PhotoBatchDeps {
  // Convert HEIC/HEIF to JPEG (never throws); returns the file unchanged otherwise.
  normalize: (file: File) => Promise<File>
  // Post-normalization whitelist gate (jpeg/png/webp).
  isAllowedType: (file: File) => boolean
  // Actually upload one already-validated file. May reject (network/server error).
  upload: (file: File) => Promise<unknown>
  // Fired after every file (success or failure) with how many are done so far.
  onProgress?: (done: number, total: number) => void
}

export interface PhotoBatchResult {
  uploaded: number
  failed: string[]
}

export async function runPhotoBatch(files: File[], deps: PhotoBatchDeps): Promise<PhotoBatchResult> {
  const failed: string[] = []
  let uploaded = 0

  for (let i = 0; i < files.length; i++) {
    const original = files[i]
    try {
      const normalized = await deps.normalize(original)
      if (!deps.isAllowedType(normalized) || normalized.size > MAX_PHOTO_BYTES) {
        failed.push(original.name)
        continue
      }
      await deps.upload(normalized)
      uploaded++
    } catch {
      failed.push(original.name)
    } finally {
      deps.onProgress?.(i + 1, files.length)
    }
  }

  return { uploaded, failed }
}

// Human-readable summary for the toast. Kept pure so the exact copy is testable.
export function summarizePhotoBatch(result: PhotoBatchResult, total: number): { kind: 'success' | 'error'; message: string } {
  const { uploaded, failed } = result
  if (failed.length === 0) {
    return { kind: 'success', message: uploaded === 1 ? 'Photo uploaded.' : `${uploaded} photos uploaded.` }
  }
  if (uploaded === 0) {
    return {
      kind: 'error',
      message: `Upload failed for: ${failed.join(', ')}. Check each is a JPEG, PNG, WebP, or HEIC under ${MAX_UPLOAD_LABEL}.`,
    }
  }
  return { kind: 'error', message: `${uploaded} of ${total} uploaded, ${failed.length} failed: ${failed.join(', ')}` }
}
