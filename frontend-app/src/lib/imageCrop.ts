// Center-crop an image File to a square JPEG, downscaled to `maxSize` on each
// side. Returns a new File the caller can hand straight to a FormData upload.
// We bake this client-side so the backend storage stays cheap and member
// avatars are visually consistent on the public site.
//
// Why centered (vs interactive crop UI): for square portrait shots, which is
// what couples submit ~95% of the time, a center crop is the same answer the
// user would pick manually. Skipping the UI keeps the add-member form one tap
// shorter and avoids pulling in react-image-crop.

export async function cropToSquare(file: File, maxSize = 400): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  const dataUrl = await readFileAsDataUrl(file)
  const img = await loadImage(dataUrl)

  // Centered square crop on the source.
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  const sx = (img.naturalWidth - side) / 2
  const sy = (img.naturalHeight - side) / 2

  const out = Math.min(side, maxSize)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) return file

  // High-quality downscale.
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out)

  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9)
  return new File([blob], renameToJpeg(file.name), { type: 'image/jpeg' })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), type, quality)
  })
}

function renameToJpeg(originalName: string): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName
  return `${base}.jpg`
}
