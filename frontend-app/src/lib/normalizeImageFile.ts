// Convert HEIC/HEIF images (the default iPhone format, and what Google Photos
// hands back) to JPEG in the browser. Browsers can't decode HEIC for <img> and
// our backend only stores jpeg/png/webp, so an unconverted .heic silently fails
// to upload, which is exactly what a real couple hit. The libheif WASM is heavy
// (~1.4 MB), so heic-to is dynamically imported only when a HEIC file is actually
// picked, keeping it out of the main bundle.

const HEIC_EXT = /\.(heic|heif)$/i

function looksLikeHeic(file: File): boolean {
  if (file.type === 'image/heic' || file.type === 'image/heif') return true
  // iOS and Google Photos exports sometimes report an empty or generic MIME
  // type, so fall back to the file extension.
  return (file.type === '' || file.type === 'application/octet-stream') && HEIC_EXT.test(file.name)
}

// Returns a JPEG File when the input is HEIC/HEIF; otherwise returns the file
// unchanged. Never throws: on conversion failure it returns the original so the
// uploader's own validation surfaces a clear error instead of a crash.
export async function normalizeImageFile(file: File): Promise<File> {
  if (!looksLikeHeic(file)) return file
  try {
    const { heicTo } = await import('heic-to')
    const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 })
    const base = file.name.replace(HEIC_EXT, '')
    return new File([jpeg], `${base}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
