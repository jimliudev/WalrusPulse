import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
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
  Coins,
  Gift,
  Send,
  AlertCircle,
  Filter,
  SlidersHorizontal,
  XCircle,
  Power,
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
import { MODULE_NAME, PACKAGE_ID } from '@/config'
import { Transaction } from '@mysten/sui/transactions'
import { formatDate, shortAddress } from '@/lib/utils'
import type { FormResponse, FormSchema, SuiFormObject, ToastType } from '@/types'

// ─── Toast helper type ────────────────────────────────────────────────────────

interface ToastFn {
  (opts: { type: ToastType; title: string; description?: string }): void
}

// ─── Filter types ─────────────────────────────────────────────────────────────

type TimeRange = 'all' | 'today' | 'week' | 'month'
type SortOrder = 'newest' | 'oldest'
type RewardFilter = 'all' | 'rewarded' | 'not-rewarded'

interface ResponseFiltersState {
  timeRange: TimeRange
  sortOrder: SortOrder
  rewardFilter: RewardFilter
  fieldFilters: Record<string, string> // fieldId → value
}

const DEFAULT_FILTERS: ResponseFiltersState = {
  timeRange: 'all',
  sortOrder: 'newest',
  rewardFilter: 'all',
  fieldFilters: {},
}

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

  const queryClient = useQueryClient()
  const selectedForm = forms.find((f) => f.objectId === selectedFormId) ?? null

  const refetchSelectedForm = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-forms', account?.address] })
  }

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
            <FormResponsesPanel form={selectedForm} toast={toast} refetchForm={refetchSelectedForm} />
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

function FormResponsesPanel({
  form,
  toast,
  refetchForm,
}: {
  form: SuiFormObject
  toast: ToastFn
  refetchForm: () => void
}) {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()
  const [copied, setCopied] = useState(false)
  const [closing, setClosing] = useState(false)
  const [filters, setFilters] = useState<ResponseFiltersState>(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
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

  // ── Apply filters ────────────────────────────────────────────────────────
  const filteredResponses = useMemo(() => {
    let result = [...responses]

    // Time range
    if (filters.timeRange !== 'all') {
      const now = Date.now()
      const ms = { today: 86400000, week: 604800000, month: 2592000000 }[filters.timeRange]
      result = result.filter((r) => now - new Date(r.submittedAt).getTime() <= ms)
    }

    // Reward status
    if (filters.rewardFilter === 'rewarded') {
      result = result.filter((r) => r.submitter && form.rewardedAddresses.includes(r.submitter))
    } else if (filters.rewardFilter === 'not-rewarded') {
      result = result.filter((r) => !r.submitter || !form.rewardedAddresses.includes(r.submitter))
    }

    // Field filters (rating = min value, dropdown/checkbox = exact match, text = contains)
    Object.entries(filters.fieldFilters).forEach(([fieldId, filterVal]) => {
      if (!filterVal) return
      const field = schema?.fields.find((f) => f.id === fieldId)
      if (!field) return
      if (field.type === 'rating') {
        const min = Number(filterVal)
        result = result.filter((r) => Number(r.answers[fieldId] ?? 0) >= min)
      } else if (field.type === 'dropdown') {
        result = result.filter((r) => r.answers[fieldId] === filterVal)
      } else if (field.type === 'checkbox') {
        result = result.filter((r) => {
          const arr = r.answers[fieldId]
          return Array.isArray(arr) && arr.includes(filterVal)
        })
      } else {
        // text / textarea / url: contains search
        result = result.filter((r) =>
          String(r.answers[fieldId] ?? '').toLowerCase().includes(filterVal.toLowerCase()),
        )
      }
    })

    // Sort
    result.sort((a, b) => {
      const diff = new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      return filters.sortOrder === 'newest' ? diff : -diff
    })

    return result
  }, [responses, filters, form.rewardedAddresses, schema])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.timeRange !== 'all') count++
    if (filters.rewardFilter !== 'all') count++
    count += Object.values(filters.fieldFilters).filter(Boolean).length
    return count
  }, [filters])

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(formLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportCSV = () => {
    if (!schema) return
    const csv = buildCSV(schema, filteredResponses)
    downloadCSV(csv, `${form.title.replace(/\s+/g, '_')}_responses.csv`)
    toast({ type: 'success', title: 'CSV downloaded' })
  }

  const handleCloseForm = async () => {
    if (!confirm('Close this form? Respondents will no longer be able to submit.')) return
    setClosing(true)
    try {
      const tx = new Transaction()
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::deactivate_form`,
        arguments: [tx.object(form.objectId)],
      })
      await signAndExecute({ transaction: tx as never })
      toast({ type: 'success', title: 'Form closed' })
      refetchForm()
    } catch (e) {
      toast({ type: 'error', title: 'Failed to close form', description: String(e) })
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Form header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>{form.title}</CardTitle>
                {form.isActive ? (
                  <Badge variant="success" className="text-xs">Active</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Closed</Badge>
                )}
              </div>
              {form.description && (
                <CardDescription className="mt-1">{form.description}</CardDescription>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
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
              <Button size="sm" onClick={handleExportCSV} disabled={!schema || filteredResponses.length === 0} className="gap-1.5">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              {form.isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCloseForm}
                  disabled={closing}
                  className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Power className="h-4 w-4" />
                  {closing ? 'Closing…' : 'Close Form'}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
            <span>
              <span className="font-medium">{filteredResponses.length}</span>
              {activeFilterCount > 0 && <span className="text-slate-400"> / {form.responseBlobIds.length}</span>} response
              {form.responseBlobIds.length !== 1 ? 's' : ''}
            </span>
            <span>Object: <span className="font-mono">{shortAddress(form.objectId, 8)}</span></span>
            <span>Schema blob: <span className="font-mono">{form.schemaBlobId.slice(0, 20)}…</span></span>
          </div>
        </CardHeader>
      </Card>

      {/* Reward Pool */}
      <RewardPoolPanel form={form} toast={toast} onSuccess={refetchForm} />

      {/* Filter bar */}
      {!loadingResponses && responses.length > 0 && schema && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className="gap-1.5"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-teal-600">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            {/* Sort */}
            <select
              value={filters.sortOrder}
              onChange={(e) => setFilters((f) => ({ ...f, sortOrder: e.target.value as SortOrder }))}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500"
              >
                <XCircle className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
          </div>

          {showFilters && (
            <Card className="border-slate-200">
              <CardContent className="pt-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Time range */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    <Filter className="inline h-3 w-3 mr-1" />Submitted
                  </label>
                  <select
                    value={filters.timeRange}
                    onChange={(e) => setFilters((f) => ({ ...f, timeRange: e.target.value as TimeRange }))}
                    className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="all">All time</option>
                    <option value="today">Today</option>
                    <option value="week">Last 7 days</option>
                    <option value="month">Last 30 days</option>
                  </select>
                </div>

                {/* Reward status */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    <Gift className="inline h-3 w-3 mr-1" />Reward status
                  </label>
                  <select
                    value={filters.rewardFilter}
                    onChange={(e) => setFilters((f) => ({ ...f, rewardFilter: e.target.value as RewardFilter }))}
                    className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="all">All</option>
                    <option value="rewarded">Rewarded</option>
                    <option value="not-rewarded">Not rewarded</option>
                  </select>
                </div>

                {/* Dynamic field filters */}
                {schema.fields.map((field) => {
                  if (field.type === 'image' || field.type === 'video') return null
                  return (
                    <div key={field.id}>
                      <label className="text-xs font-medium text-slate-600 mb-1 block truncate" title={field.label}>
                        {field.label}
                      </label>
                      {field.type === 'rating' ? (
                        <select
                          value={filters.fieldFilters[field.id] ?? ''}
                          onChange={(e) => setFilters((f) => ({
                            ...f,
                            fieldFilters: { ...f.fieldFilters, [field.id]: e.target.value },
                          }))}
                          className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="">Any rating</option>
                          <option value="1">★ 1+</option>
                          <option value="2">★★ 2+</option>
                          <option value="3">★★★ 3+</option>
                          <option value="4">★★★★ 4+</option>
                          <option value="5">★★★★★ 5 only</option>
                        </select>
                      ) : field.type === 'dropdown' || field.type === 'checkbox' ? (
                        <select
                          value={filters.fieldFilters[field.id] ?? ''}
                          onChange={(e) => setFilters((f) => ({
                            ...f,
                            fieldFilters: { ...f.fieldFilters, [field.id]: e.target.value },
                          }))}
                          className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="">Any</option>
                          {(field.options ?? []).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={filters.fieldFilters[field.id] ?? ''}
                          onChange={(e) => setFilters((f) => ({
                            ...f,
                            fieldFilters: { ...f.fieldFilters, [field.id]: e.target.value },
                          }))}
                          placeholder="Search…"
                          className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

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

      {/* No results after filtering */}
      {!loadingResponses && responses.length > 0 && filteredResponses.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <Filter className="h-8 w-8 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No responses match your filters.</p>
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="mt-2 text-xs text-teal-600 hover:underline"
            >
              Clear all filters
            </button>
          </CardContent>
        </Card>
      )}

      {/* Response cards */}
      {schema && filteredResponses.map((response, i) => (
        <ResponseCard
          key={response.submittedAt + i}
          index={responses.indexOf(response) + 1}
          blobId={form.responseBlobIds[responses.indexOf(response)]}
          response={response}
          schema={schema}
          form={form}
          toast={toast}
          onRewardSent={refetchForm}
        />
      ))}
    </div>
  )
}

// ─── Reward Pool Panel ────────────────────────────────────────────────────────

function RewardPoolPanel({
  form,
  toast,
  onSuccess,
}: {
  form: SuiFormObject
  toast: ToastFn
  onSuccess: () => void
}) {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()
  const [fundAmount, setFundAmount] = useState('')
  const [funding, setFunding] = useState(false)

  const balanceSui = (Number(form.rewardPoolBalance) / 1e9).toFixed(4)

  const handleFund = async () => {
    const parsed = parseFloat(fundAmount)
    if (isNaN(parsed) || parsed <= 0) {
      toast({ type: 'warning', title: 'Enter a valid amount greater than 0' })
      return
    }
    const amountMist = BigInt(Math.round(parsed * 1e9))
    setFunding(true)
    try {
      const tx = new Transaction()
      const [coin] = tx.splitCoins(tx.gas, [tx.pure('u64', amountMist)])
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::fund_reward_pool`,
        arguments: [tx.object(form.objectId), coin],
      })
      await signAndExecute({ transaction: tx as never })
      toast({ type: 'success', title: `Funded ${parsed} SUI to reward pool` })
      setFundAmount('')
      onSuccess()
    } catch (e) {
      toast({ type: 'error', title: 'Fund failed', description: String(e) })
    } finally {
      setFunding(false)
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-600" />
            <div>
              <CardTitle className="text-base text-amber-900">Reward Pool</CardTitle>
              <CardDescription className="text-amber-700">
                Balance:{' '}
                <span className="font-semibold font-mono">{balanceSui} SUI</span>
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.1"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              placeholder="Amount (SUI)"
              className="w-36 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <Button
              size="sm"
              onClick={handleFund}
              disabled={funding || !fundAmount}
              className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
            >
              <Coins className="h-4 w-4" />
              {funding ? 'Funding…' : 'Fund Pool'}
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

// ─── Single response card ─────────────────────────────────────────────────────

function ResponseCard({
  index,
  blobId,
  response,
  schema,
  form,
  toast,
  onRewardSent,
}: {
  index: number
  blobId: string
  response: FormResponse
  schema: FormSchema
  form: SuiFormObject
  toast: ToastFn
  onRewardSent: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isAlreadyRewarded =
    !!response.submitter && form.rewardedAddresses.includes(response.submitter)

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
              {isAlreadyRewarded && (
                <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                  <Gift className="h-3 w-3" /> Rewarded
                </Badge>
              )}
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

          {/* Send reward section */}
          {response.submitter && (
            <RewardButton
              formObjectId={form.objectId}
              recipient={response.submitter}
              isAlreadyRewarded={isAlreadyRewarded}
              poolBalance={form.rewardPoolBalance}
              toast={toast}
              onSuccess={onRewardSent}
            />
          )}

          <div className="text-xs text-slate-400 break-all">
            Blob ID: <span className="font-mono">{blobId}</span>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ─── Reward Button ────────────────────────────────────────────────────────────

function RewardButton({
  formObjectId,
  recipient,
  isAlreadyRewarded,
  poolBalance,
  toast,
  onSuccess,
}: {
  formObjectId: string
  recipient: string
  isAlreadyRewarded: boolean
  poolBalance: bigint
  toast: ToastFn
  onSuccess: () => void
}) {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()
  const [amount, setAmount] = useState('')
  const [sending, setSending] = useState(false)

  if (isAlreadyRewarded) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
        <Gift className="h-4 w-4" />
        This address has already received a reward.
      </div>
    )
  }

  const handleSend = async () => {
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      toast({ type: 'warning', title: 'Enter a valid amount greater than 0' })
      return
    }
    const amountMist = BigInt(Math.round(parsed * 1e9))
    if (amountMist > poolBalance) {
      toast({
        type: 'error',
        title: 'Insufficient pool balance',
        description: `Pool has ${(Number(poolBalance) / 1e9).toFixed(4)} SUI`,
      })
      return
    }
    setSending(true)
    try {
      const tx = new Transaction()
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::reward_respondent`,
        arguments: [
          tx.object(formObjectId),
          tx.pure('address', recipient),
          tx.pure('u64', amountMist),
        ],
      })
      await signAndExecute({ transaction: tx as never })
      toast({
        type: 'success',
        title: `Sent ${parsed} SUI to ${shortAddress(recipient)}`,
      })
      setAmount('')
      onSuccess()
    } catch (e) {
      toast({ type: 'error', title: 'Reward failed', description: String(e) })
    } finally {
      setSending(false)
    }
  }

  const poolBalanceSui = (Number(poolBalance) / 1e9).toFixed(4)

  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-teal-800">
        <Gift className="h-4 w-4" />
        Send SUI Reward
        <span className="text-xs text-teal-600 font-normal ml-auto">
          Pool: {poolBalanceSui} SUI
        </span>
      </div>
      {poolBalance === 0n ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <AlertCircle className="h-3.5 w-3.5" />
          Fund the reward pool first before sending rewards.
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 shrink-0">To: <span className="font-mono">{shortAddress(recipient)}</span></span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (SUI)"
            className="flex-1 rounded-md border border-teal-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || !amount}
            className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      )}
    </div>
  )
}
