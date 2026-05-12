import type { FormResponse, FormSchema } from '@/types'
import { formatDate } from './utils'

/**
 * Convert an array of responses to a CSV string.
 */
export function buildCSV(schema: FormSchema, responses: FormResponse[]): string {
  const baseHeaders = ['Response Blob ID', 'Submitted At', 'Submitter']
  const fieldHeaders = schema.fields.map((f) => f.label)
  const headers = [...baseHeaders, ...fieldHeaders]

  const rows = responses.map((r) => {
    const base = [
      r.schemaBlobId,
      formatDate(r.submittedAt),
      r.submitter || 'Anonymous',
    ]
    const answers = schema.fields.map((f) => {
      const val = r.answers[f.id]
      if (val == null) return ''
      if (Array.isArray(val)) return val.join('; ')
      return String(val)
    })
    return [...base, ...answers]
  })

  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`

  return [headers, ...rows]
    .map((row) => row.map(escape).join(','))
    .join('\n')
}

/**
 * Trigger a browser download of a CSV string.
 */
export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
