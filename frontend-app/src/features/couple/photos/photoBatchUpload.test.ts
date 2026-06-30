import { describe, it, expect, vi } from 'vitest'
import { runPhotoBatch, summarizePhotoBatch, MAX_PHOTO_BYTES, type PhotoBatchDeps } from './photoBatchUpload'

function fakeFile(name: string, size: number, type = 'image/jpeg'): File {
  // Avoid allocating real bytes for the over-limit case; override size instead.
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

function deps(overrides: Partial<PhotoBatchDeps> = {}): PhotoBatchDeps {
  return {
    normalize: async (f) => f,
    isAllowedType: () => true,
    upload: async () => undefined,
    ...overrides,
  }
}

describe('runPhotoBatch', () => {
  it('uploads every valid file in the batch', async () => {
    const upload = vi.fn(async () => undefined)
    const files = [fakeFile('a.jpg', 100), fakeFile('b.jpg', 100), fakeFile('c.jpg', 100)]
    const result = await runPhotoBatch(files, deps({ upload }))
    expect(upload).toHaveBeenCalledTimes(3)
    expect(result).toEqual({ uploaded: 3, failed: [] })
  })

  it('continues the batch when one upload rejects (the #92 regression)', async () => {
    // Middle file throws (network blip / server reject). Before the fix this
    // bricked the loop and dropped the rest of the batch; now it is isolated.
    const upload = vi.fn(async (f: File) => {
      if (f.name === 'bad.jpg') throw new Error('boom')
    })
    const files = [fakeFile('a.jpg', 100), fakeFile('bad.jpg', 100), fakeFile('c.jpg', 100)]
    const result = await runPhotoBatch(files, deps({ upload }))
    expect(upload).toHaveBeenCalledTimes(3)
    expect(result).toEqual({ uploaded: 2, failed: ['bad.jpg'] })
  })

  it('rejects files over the size cap without calling upload', async () => {
    const upload = vi.fn(async () => undefined)
    const files = [fakeFile('huge.jpg', MAX_PHOTO_BYTES + 1), fakeFile('ok.jpg', 100)]
    const result = await runPhotoBatch(files, deps({ upload }))
    expect(upload).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ uploaded: 1, failed: ['huge.jpg'] })
  })

  it('rejects disallowed types without calling upload', async () => {
    const upload = vi.fn(async () => undefined)
    const files = [fakeFile('doc.gif', 100, 'image/gif'), fakeFile('ok.jpg', 100)]
    const result = await runPhotoBatch(files, deps({
      upload,
      isAllowedType: (f) => f.type !== 'image/gif',
    }))
    expect(upload).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ uploaded: 1, failed: ['doc.gif'] })
  })

  it('always reports progress for every file, success or failure', async () => {
    const onProgress = vi.fn()
    const files = [fakeFile('a.jpg', 100), fakeFile('b.jpg', 100)]
    await runPhotoBatch(files, deps({
      onProgress,
      upload: async (f) => { if (f.name === 'a.jpg') throw new Error('boom') },
    }))
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2)
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2)
  })
})

describe('summarizePhotoBatch', () => {
  it('singular success copy for one photo', () => {
    expect(summarizePhotoBatch({ uploaded: 1, failed: [] }, 1))
      .toEqual({ kind: 'success', message: 'Photo uploaded.' })
  })

  it('plural success copy for many photos', () => {
    expect(summarizePhotoBatch({ uploaded: 3, failed: [] }, 3))
      .toEqual({ kind: 'success', message: '3 photos uploaded.' })
  })

  it('partial-failure summary lists the failed filenames', () => {
    const s = summarizePhotoBatch({ uploaded: 6, failed: ['x.jpg', 'y.jpg'] }, 8)
    expect(s.kind).toBe('error')
    expect(s.message).toBe('6 of 8 uploaded, 2 failed: x.jpg, y.jpg')
  })

  it('total-failure summary explains the constraints', () => {
    const s = summarizePhotoBatch({ uploaded: 0, failed: ['x.jpg'] }, 1)
    expect(s.kind).toBe('error')
    expect(s.message).toContain('Upload failed for: x.jpg')
    expect(s.message).toContain('under 15 MB')
  })
})
