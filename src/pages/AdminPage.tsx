import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  ExternalLink,
  Download,
  ChevronRight,
  Inbox,
  Wallet,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import LoadingSpinner from '@/components/LoadingSpinner'
import FieldRenderer from '@/components/FieldRenderer'
import { useToast } from '@/components/ui/toast'

import { readBlob } from '@/lib/walrus'
import { fetchFormsCreatedBy } from '@/lib/sui'
import { buildCSV, downloadCSV } from '@/lib/csv'
import { formatDate, shortAddress } from '@/lib/utils'
import { PACKAGE_ID } from '@/config'
import type { FormResponse, FormSchema, SuiFormObject } from '@/types'

// ─── Admin Page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const account = useCurrentAccount()
  const suiClient = useSuiClient()
  const { toast } = useToast()
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null)

  // ── Fetch all forms owned by current wallet ────────────────────────────────

  const {
    data: forms = [],
    isLoading: loadingForms,
    error: formsError,
    refetch: refetchForms,
  } = useQuery<SuiFormObject[]>({
    queryKey: ['admin-forms', account?.address],
    queryFn: () => fetchFormsCreatedBy(suiClient, account!.address),
    enabled: !!account && !!PACKAGE_ID,
  })

  const selectedForm = forms.find((f) => f.objectId === selectedFormId) ?? null

  // ── Not connected ──────────────────────────────────────────────────────────

  if (!account) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
          <Wallet className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Connect your wallet</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          Connect your Sui wallet to view and manage all forms you've created.
        </p>
      </div>
    )
  }

  if (!PACKAGE_ID) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-amber-600 font-medium">Contract not configured</p>
        <p className="text-sm text-slate-500 max-w-md">
          Deploy the Sui Move contract and set <code>VITE_PACKAGE_ID</code> in your{' '}
          <code>.env</code> file.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
              <p className="text-xs text-slate-500">
                Wallet: <span className="font-mono">{shortAddress(account.address)}</span>
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchForms()} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-6">
        {/* ── Left: form list ────────────────────────────────────────────────── */}
        <aside className="w-full lg:w-72 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Your Forms</h2>
            <Badge variant="secondary">{forms.length}</Badge>
          </div>

          {loadingForms ? (
            <LoadingSpinner label="Loading forms…" />
          ) : formsError ? (
            <p className="text-sm text-red-500">{String(formsError)}</p>
          ) : forms.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Inbox className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No forms found.</p>
                <Link to="/builder" className="mt-3 block">
                  <Button size="sm" variant="outline">
                    Create first form
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            forms.map((form) => (
              <button
                key={form.objectId}
                type="button"
                onClick={() => setSelectedFormId(form.objectId)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selectedFormId === form.objectId
                    ? 'bg-teal-50 border-teal-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 truncate">{form.title}</p>
                  <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {form.responseBlobIds.length} response{form.responseBlobIds.length !== 1 ? 's' : ''}
                  </Badge>
                  {form.isActive ? (
                    <Badge variant="success" className="text-xs">Active</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Closed</Badge>
                  )}
                </div>
              </button>
            ))
          )}

          {!loadingForms && (
            <Link to="/builder">
              <Button variant="outline" className="w-full border-dashed text-slate-500">
                + New Form
              </Button>
            </Link>
          )}
        </aside>

        {/* ── Right: responses ───────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">
          {selectedForm ? (
            <FormResponsesPanel form={selectedForm} toast={toast} />
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-sm gap-2 bg-white rounded-xl border border-slate-200">
              <Inbox className="h-10 w-10 text-slate-200" />
              <p>Select a form to view responses</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ─── Responses panel ──────────────────────────────────────────────────────────

interface ToastFn {
  (opts: { type: string; title: string; description?: string }): void
}

function FormResponsesPanel({ form, toast }: { form: SuiFormObject; toast: ToastFn }) {
  const [copied, setCopied] = useState(false)
  const formLink = `${window.location.origin}/form/${form.objectId}`

  // Fetch the schema
  const { data: schema, isLoading: loadingSchema } = useQuery<FormSchema>({
    queryKey: ['schema', form.schemaBlobId],
    queryFn: () => readBlob<FormSchema>(form.schemaBlobId),
  })

  // Fetch all responses
  const { data: responses = [], isLoading: loadingResponses } = useQuery<FormResponse[]>({
    queryKey: ['responses', form.objectId, form.responseBlobIds],
    queryFn: async () => {
      const results = await Promise.allSettled(
        form.responseBlobIds.map((id) => readBlob<FormResponse>(id)),
      )
      return results
        .filter((r): r is PromiseFulfilledResult<FormResponse> => r.status === 'fulfilled')
        .map((r) => r.value)
    },
    enabled: form.responseBlobIds.length > 0,
  })

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(formLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportCSV = () => {
    if (!schema) return
    const csv = buildCSV(schema, responses)
    downloadCSV(csv, `${form.title.replace(/\s+/g, '_')}_responses.csv`)
    toast({ type: 'success', title: 'CSV downloaded' })
  }

  return (
    <div className="space-y-4">
      {/* Form header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle>{form.title}</CardTitle>
              {form.description && (
                <CardDescription className="mt-1">{form.description}</CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy link'}
              </Button>
              <a href={formLink} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Button>
              </a>
              <Button size="sm" onClick={handleExportCSV} disabled={!schema || responses.length === 0} className="gap-1.5">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
            <span>
              <span className="font-medium">{form.responseBlobIds.length}</span> response
              {form.responseBlobIds.length !== 1 ? 's' : ''}
            </span>
            <span>
              Object:{' '}
              <span className="font-mono">{shortAddress(form.objectId, 8)}</span>
            </span>
            <span>
              Schema blob:{' '}
              <span className="font-mono">{form.schemaBlobId.slice(0, 20)}…</span>
            </span>
          </div>
        </CardHeader>
      </Card>

      {/* Loading */}
      {(loadingSchema || loadingResponses) && (
        <LoadingSpinner label="Loading responses…" />
      )}

      {/* Empty state */}
      {!loadingResponses && form.responseBlobIds.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Inbox className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No responses yet.</p>
            <p className="text-xs text-slate-400 mt-1">Share the form link to collect responses.</p>
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5">
                <Copy className="h-4 w-4" /> Copy shareable link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Response cards */}
      {schema && responses.map((response, i) => (
        <ResponseCard
          key={i}
          index={i + 1}
          blobId={form.responseBlobIds[i]}
          response={response}
          schema={schema}
        />
      ))}
    </div>
  )
}

// ─── Single response card ─────────────────────────────────────────────────────

function ResponseCard({
  index,
  blobId,
  response,
  schema,
}: {
  index: number
  blobId: string
  response: FormResponse
  schema: FormSchema
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left"
      >
        <CardHeader className="py-4 hover:bg-slate-50 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">#{index}</Badge>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {response.submitter ? shortAddress(response.submitter) : 'Anonymous'}
                </p>
                <p className="text-xs text-slate-400">{formatDate(response.submittedAt)}</p>
              </div>
            </div>
            <ChevronRight
              className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </div>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="border-t border-slate-100 pt-4 pb-6 space-y-5">
          {schema.fields.map((field) => (
            <div key={field.id}>
              <FieldRenderer
                field={field}
                value={response.answers[field.id] ?? null}
                onChange={() => {}}
                readonly
              />
              <Separator className="mt-4" />
            </div>
          ))}
          <div className="text-xs text-slate-400 break-all">
            Blob ID: <span className="font-mono">{blobId}</span>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
