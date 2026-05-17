import { useRef, useState, useEffect } from 'react'
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import {
  Link2,
  Image as ImageIcon,
  Check,
  Loader2,
  ExternalLink,
  Video,
  Download,
  X,
} from 'lucide-react'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import StarRating from './StarRating'
import { storeBlob, getBlobUrl } from '@/lib/walrus'
import { cn } from '@/lib/utils'
import { LIMITS } from '@/lib/utils'
import type { AnswerValue, FormField } from '@/types'

interface FieldRendererProps {
  field: FormField
  value: AnswerValue
  onChange: (value: AnswerValue) => void
  readonly?: boolean
}

export default function FieldRenderer({ field, value, onChange, readonly }: FieldRendererProps) {
  const strVal = typeof value === 'string' ? value : ''
  const numVal = typeof value === 'number' ? value : 0
  const arrVal = Array.isArray(value) ? value : []

  const commonLabel = (
    <div className="mb-1.5">
      <Label className="text-slate-800 font-medium">
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {field.description && (
        <p className="text-xs text-slate-500 mt-0.5">{field.description}</p>
      )}
    </div>
  )

  switch (field.type) {
    // ── Short text ────────────────────────────────────────────────────────────
    case 'text':
      return (
        <div className="space-y-1">
          {commonLabel}
          <Input
            value={strVal}
            onChange={(e) => onChange(e.target.value.slice(0, LIMITS.answerText))}
            placeholder={field.placeholder ?? 'Your answer…'}
            disabled={readonly}
            maxLength={LIMITS.answerText}
          />
          {!readonly && (
            <p className={`text-right text-xs ${strVal.length >= LIMITS.answerText ? 'text-red-500' : 'text-slate-400'}`}>
              {strVal.length}/{LIMITS.answerText}
            </p>
          )}
        </div>
      )

    // ── Long text ─────────────────────────────────────────────────────────────
    case 'textarea':
      return (
        <div className="space-y-1">
          {commonLabel}
          <Textarea
            value={strVal}
            onChange={(e) => onChange(e.target.value.slice(0, LIMITS.answerTextarea))}
            placeholder={field.placeholder ?? 'Your answer…'}
            disabled={readonly}
            rows={4}
            maxLength={LIMITS.answerTextarea}
          />
          {!readonly && (
            <p className={`text-right text-xs ${strVal.length >= LIMITS.answerTextarea ? 'text-red-500' : 'text-slate-400'}`}>
              {strVal.length}/{LIMITS.answerTextarea}
            </p>
          )}
        </div>
      )

    // ── URL ───────────────────────────────────────────────────────────────────
    case 'url': {
      let urlError = ''
      let safeHref = ''
      if (strVal) {
        try {
          const parsed = new URL(strVal)
          if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            safeHref = strVal
          } else {
            urlError = 'URL must start with http:// or https://'
          }
        } catch {
          urlError = 'Please enter a valid URL'
        }
      }
      return (
        <div className="space-y-1">
          {commonLabel}
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="url"
              value={strVal}
              onChange={(e) => onChange(e.target.value.slice(0, LIMITS.answerUrl))}
              placeholder={field.placeholder ?? 'https://…'}
              disabled={readonly}
              className={cn('pl-9', urlError && strVal ? 'border-red-400 focus-visible:ring-red-400' : '')}
              maxLength={LIMITS.answerUrl}
            />
          </div>
          {urlError && strVal && !readonly && (
            <p className="text-xs text-red-500">{urlError}</p>
          )}
          {safeHref && readonly && (
            <a
              href={safeHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline mt-1"
            >
              <ExternalLink className="h-3 w-3" /> Open link
            </a>
          )}
        </div>
      )
    }

    // ── Dropdown ──────────────────────────────────────────────────────────────
    case 'dropdown':
      return (
        <div className="space-y-1">
          {commonLabel}
          <select
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            disabled={readonly}
            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
          >
            <option value="">Select an option…</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )

    // ── Checkboxes ────────────────────────────────────────────────────────────
    case 'checkbox':
      return (
        <div className="space-y-1">
          {commonLabel}
          <div className="space-y-2">
            {(field.options ?? []).map((opt) => {
              const checked = arrVal.includes(opt)
              return (
                <label
                  key={opt}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    checked
                      ? 'border-teal-400 bg-teal-50'
                      : 'border-slate-200 hover:border-slate-300',
                    readonly && 'cursor-default',
                  )}
                >
                  <div
                    className={cn(
                      'h-4 w-4 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                      checked ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white',
                    )}
                  >
                    {checked && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={readonly}
                    className="sr-only"
                    onChange={() => {
                      const next = checked ? arrVal.filter((v) => v !== opt) : [...arrVal, opt]
                      onChange(next)
                    }}
                  />
                  <span className="text-sm text-slate-700">{opt}</span>
                </label>
              )
            })}
          </div>
        </div>
      )

    // ── Star rating ───────────────────────────────────────────────────────────
    case 'rating':
      return (
        <div className="space-y-1">
          {commonLabel}
          <StarRating value={numVal} onChange={(v) => onChange(v)} readonly={readonly} size="lg" />
        </div>
      )

    // ── Image / Video upload ───────────────────────────────────────────────────────────────────────────
    case 'image':
    case 'video':
      return (
        <WalrusFileUpload
          field={field}
          value={strVal}
          onChange={onChange}
          readonly={readonly}
          accept={field.type === 'image' ? 'image/*' : 'video/*'}
          commonLabel={commonLabel}
        />
      )

    default:
      return null
  }
}

// ─── Walrus file uploader ─────────────────────────────────────────────────────

interface WalrusFileUploadProps {
  field: FormField
  value: string
  onChange: (v: AnswerValue) => void
  readonly?: boolean
  accept?: string
  commonLabel: React.ReactNode
}

function WalrusFileUpload({ field, value, onChange, readonly, accept, commonLabel }: WalrusFileUploadProps) {
  const account = useCurrentAccount()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const isImage = field.type === 'image'
  const isVideo = field.type === 'video'

  useEffect(() => {
    if (!lightboxOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxOpen])

  // value format: "blobId|originalFilename.ext"  (legacy: just "blobId")
  const { blobId, fileName } = parseBlobValue(value)
  const blobUrl = blobId ? getBlobUrl(blobId) : ''

  const handleFile = async (file: File) => {
    setUploadError(null)

    // Wallet must be connected (required for SDK mode; good guard regardless)
    if (!account) {
      setUploadError('Please connect your wallet before uploading.')
      return
    }

    // File size guard
    const limitMb = isVideo ? LIMITS.uploadVideoMb : LIMITS.uploadImageMb
    if (file.size > limitMb * 1024 * 1024) {
      setUploadError(`File exceeds the ${limitMb} MB limit.`)
      return
    }

    setUploading(true)
    try {
      const id = await storeBlob(file, {
        signAndExecuteTransaction: signAndExecute as (args: { transaction: unknown }) => Promise<{ digest: string }>,
        currentAddress: account.address,
      })
      // Store blobId + original filename so download has the right extension
      onChange(`${id}|${file.name}`)
    } catch (err) {
      console.error('Upload failed', err)
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async () => {
    if (!blobId) return
    setDownloading(true)
    try {
      const response = await fetch(getBlobUrl(blobId))
      if (!response.ok) throw new Error(`${response.status}`)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = fileName || (isVideo ? 'video.mp4' : 'image')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      console.error('Download failed', err)
    } finally {
      setDownloading(false)
    }
  }

  if (readonly && blobId) {
    return (
      <div className="space-y-2">
        {commonLabel}
        {isImage ? (
          <>
            <img
              src={blobUrl}
              alt="Uploaded"
              onClick={() => setLightboxOpen(true)}
              className="max-h-48 rounded-lg border border-slate-200 object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
            />
            {lightboxOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                onClick={() => setLightboxOpen(false)}
              >
                <img
                  src={blobUrl}
                  alt="Fullscreen"
                  onClick={(e) => e.stopPropagation()}
                  className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
                />
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 rounded-full p-1.5 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
          </>
        ) : isVideo ? (
          <div className="space-y-2">
            <video
              src={blobUrl}
              controls
              className="w-full max-h-64 rounded-lg border border-slate-200 bg-black"
            />
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 text-xs text-teal-600 hover:underline disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? 'Downloading…' : `Download ${fileName || 'video'}`}
            </button>
          </div>
        ) : null}
        <p className="text-xs text-slate-400 break-all">Blob ID: {blobId}</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {commonLabel}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
          uploading ? 'border-teal-300 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50',
          blobId && 'border-green-300 bg-green-50',
        )}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-teal-500 animate-spin" />
            <p className="text-sm text-teal-600">Uploading to Walrus…</p>
          </div>
        ) : blobId ? (
          <div className="flex flex-col items-center gap-2">
            {isImage ? (
              <img
                src={blobUrl}
                alt="Preview"
                className="max-h-32 rounded-lg object-contain mx-auto"
              />
            ) : (
              <Video className="h-8 w-8 text-green-500" />
            )}
            <p className="text-sm text-green-700 font-medium">{fileName || 'File uploaded'}</p>
            <p className="text-xs text-slate-400 break-all">Blob: {blobId}</p>
            <button
              type="button"
              className="text-xs text-teal-600 hover:underline"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
            >
              Change file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {isImage ? (
              <ImageIcon className="h-8 w-8 text-slate-400" />
            ) : (
              <Video className="h-8 w-8 text-slate-400" />
            )}
            <p className="text-sm text-slate-600">
              Click to upload {isImage ? 'image' : 'video'}
            </p>
            <p className="text-xs text-slate-400">Stored permanently on Walrus</p>
          </div>
        )}
      </div>
      {uploadError && (
        <p className="text-xs text-red-500 mt-1">{uploadError}</p>
      )}
    </div>
  )
}

// ─── Parse stored blob value ──────────────────────────────────────────────────

// Value format: "blobId|originalFilename.ext"
// Legacy format (no filename stored): just "blobId"
function parseBlobValue(value: string): { blobId: string; fileName: string } {
  const idx = value.indexOf('|')
  if (idx === -1) return { blobId: value, fileName: '' }
  return { blobId: value.slice(0, idx), fileName: value.slice(idx + 1) }
}
