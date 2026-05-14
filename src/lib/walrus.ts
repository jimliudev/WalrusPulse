import { WALRUS_AGGREGATOR, WALRUS_EPOCHS, WALRUS_PUBLISHER } from '@/config'

// ─── Store blob ───────────────────────────────────────────────────────────────

/**
 * Upload arbitrary data to Walrus and return the blob ID.
 * Accepts an object (serialised to JSON), a plain string, or a raw Blob/File.
 */
export async function storeBlob(data: object | string | Blob | File): Promise<string> {
  let body: BodyInit

  if (data instanceof Blob || data instanceof File) {
    body = data
  } else if (typeof data === 'string') {
    body = new Blob([data], { type: 'text/plain' })
  } else {
    body = new Blob([JSON.stringify(data)], { type: 'application/json' })
  }

  const url = `${WALRUS_PUBLISHER}/v1/blobs?epochs=${WALRUS_EPOCHS}`
  const response = await fetch(url, {
    method: 'PUT',
    body,
    // Preserve the original MIME type for File/Blob so the aggregator
    // returns the correct Content-Type on download (e.g. video/mp4).
    headers: {
      'Content-Type':
        data instanceof File
          ? data.type || 'application/octet-stream'
          : data instanceof Blob
          ? data.type || 'application/octet-stream'
          : 'application/octet-stream',
    },
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => response.statusText)
    throw new Error(`Walrus store failed (${response.status}): ${errText}`)
  }

  const result = await response.json()

  if (result.newlyCreated?.blobObject?.blobId) {
    return result.newlyCreated.blobObject.blobId as string
  }
  if (result.alreadyCertified?.blobId) {
    return result.alreadyCertified.blobId as string
  }

  throw new Error('Unexpected Walrus response: ' + JSON.stringify(result))
}

// ─── Read blob ────────────────────────────────────────────────────────────────

/**
 * Download a blob from Walrus.
 * Returns parsed JSON if the content looks like JSON, otherwise the raw text.
 */
export async function readBlob<T = unknown>(blobId: string): Promise<T> {
  const url = `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Walrus read failed (${response.status}): ${response.statusText}`)
  }

  const contentType = response.headers.get('Content-Type') || ''
  if (contentType.startsWith('application/octet-stream') || contentType.includes('text')) {
    const text = await response.text()
    try {
      return JSON.parse(text) as T
    } catch {
      return text as unknown as T
    }
  }

  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

/**
 * Returns the public URL to access a blob via the Walrus aggregator.
 * Useful for embedding images / videos directly in <img> / <video>.
 */
export function getBlobUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`
}

/**
 * Fetch a blob and trigger a browser download with the correct file extension
 * derived from the Content-Type header.
 */
export async function downloadBlob(blobId: string, fallbackName = 'download'): Promise<void> {
  const url = getBlobUrl(blobId)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)

  const contentType = response.headers.get('Content-Type') || ''
  const ext = mimeToExt(contentType)
  const filename = ext ? `${fallbackName}.${ext}` : fallbackName

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }
  // Match e.g. "video/mp4; codecs=..." → "video/mp4"
  const base = mime.split(';')[0].trim()
  return map[base] ?? ''
}
