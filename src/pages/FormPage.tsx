import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { CheckCircle2, Waves, ChevronLeft, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import FieldRenderer from '@/components/FieldRenderer'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ui/toast'

import { readBlob, storeBlob } from '@/lib/walrus'
import { fetchFormObject, buildSubmitResponseTx } from '@/lib/sui'
import { PACKAGE_ID } from '@/config'
import type { AnswerValue, FormResponse, FormSchema, SuiFormObject } from '@/types'

// ─── Form Page ────────────────────────────────────────────────────────────────

export default function FormPage() {
  const { formObjectId } = useParams<{ formObjectId: string }>()
  const account = useCurrentAccount()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()
  const suiClient = useSuiClient()
  const { toast } = useToast()

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [responseBlobId, setResponseBlobId] = useState('')

  // ── Fetch form object from Sui ─────────────────────────────────────────────

  const {
    data: formObj,
    isLoading: loadingForm,
    error: formError,
  } = useQuery<SuiFormObject>({
    queryKey: ['sui-form', formObjectId],
    queryFn: () => fetchFormObject(suiClient, formObjectId!),
    enabled: !!formObjectId,
  })

  // ── Fetch schema from Walrus ───────────────────────────────────────────────

  const {
    data: schema,
    isLoading: loadingSchema,
    error: schemaError,
  } = useQuery<FormSchema>({
    queryKey: ['walrus-schema', formObj?.schemaBlobId],
    queryFn: () => readBlob<FormSchema>(formObj!.schemaBlobId),
    enabled: !!formObj?.schemaBlobId,
  })

  // ── Validation ─────────────────────────────────────────────────────────────

  const validateAnswers = (): string | null => {
    if (!schema) return null
    for (const field of schema.fields) {
      if (!field.required) continue
      const val = answers[field.id]
      if (val === null || val === undefined || val === '') return `"${field.label}" is required.`
      if (Array.isArray(val) && val.length === 0) return `"${field.label}" is required.`
      if (typeof val === 'number' && val === 0) return `"${field.label}" requires a rating.`
    }
    return null
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!account) {
      toast({ type: 'warning', title: 'Please connect your wallet to submit.' })
      return
    }
    const validationError = validateAnswers()
    if (validationError) {
      toast({ type: 'warning', title: validationError })
      return
    }
    if (!PACKAGE_ID || !formObjectId || !formObj) {
      toast({ type: 'error', title: 'Form not available' })
      return
    }

    setSubmitting(true)
    try {
      // 1. Upload answers to Walrus
      const response: FormResponse = {
        formObjectId: formObjectId!,
        schemaBlobId: formObj.schemaBlobId,
        answers,
        submittedAt: new Date().toISOString(),
        submitter: account.address,
      }
      toast({ type: 'info', title: 'Uploading response to Walrus…' })
      const blobId = await storeBlob(response)
      setResponseBlobId(blobId)

      // 2. Record on Sui
      toast({ type: 'info', title: 'Recording on-chain…' })
      const tx = buildSubmitResponseTx(formObjectId!, blobId)
      await signAndExecute({ transaction: tx })

      setSubmitted(true)
      toast({ type: 'success', title: 'Response submitted!' })
    } catch (err) {
      console.error(err)
      toast({
        type: 'error',
        title: 'Submission failed',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadingForm || loadingSchema) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" label="Loading form…" />
      </div>
    )
  }

  if (formError || schemaError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-red-600 font-medium">Failed to load form.</p>
        <p className="text-sm text-slate-500">
          {String(formError || schemaError)}
        </p>
        <Link to="/">
          <Button variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" /> Go home
          </Button>
        </Link>
      </div>
    )
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6 animate-fade-in">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-teal-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-teal-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Response submitted!</h1>
          <p className="text-slate-500">
            Your response has been stored on Walrus and recorded on the Sui blockchain.
          </p>
          {responseBlobId && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left">
              <p className="text-xs text-slate-500 font-medium mb-1">Walrus Blob ID</p>
              <p className="text-xs font-mono text-slate-700 break-all">{responseBlobId}</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSubmitted(false)
                setAnswers({})
                setResponseBlobId('')
              }}
            >
              Submit another response
            </Button>
            <Link to="/">
              <Button variant="ghost" className="w-full">
                <Waves className="h-4 w-4 mr-2" />
                Back to WalrusPulse
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!schema || !formObj) return null

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header card */}
        <Card className="border-t-4 border-t-teal-500 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2 text-xs text-teal-600 font-medium mb-1">
              <Waves className="h-3.5 w-3.5" />
              WalrusPulse
            </div>
            <CardTitle className="text-2xl">{schema.title}</CardTitle>
            {schema.description && (
              <p className="text-sm text-slate-500 mt-1">{schema.description}</p>
            )}
          </CardHeader>
        </Card>

        {/* Fields */}
        {schema.fields.map((field) => (
          <Card key={field.id} className="shadow-sm">
            <CardContent className="pt-6">
              <FieldRenderer
                field={field}
                value={answers[field.id] ?? null}
                onChange={(val) => setAnswers((prev) => ({ ...prev, [field.id]: val }))}
              />
            </CardContent>
          </Card>
        ))}

        {/* Wallet warning */}
        {!account && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
            ⚠️ Connect your Sui wallet to submit this form.
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            Responses stored on{' '}
            <span className="font-semibold text-teal-600">Walrus</span> &amp; Sui
          </p>
          <Button onClick={handleSubmit} disabled={submitting || !account} className="gap-2">
            {submitting ? (
              <>
                <LoadingSpinner size="sm" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit
              </>
            )}
          </Button>
        </div>

        {/* Info footer */}
        <Separator />
        <div className="text-center text-xs text-slate-400 pb-4">
          <p>
            Form ID: <span className="font-mono">{formObjectId}</span>
          </p>
          <p className="mt-0.5">
            Schema Blob: <span className="font-mono">{formObj.schemaBlobId}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
