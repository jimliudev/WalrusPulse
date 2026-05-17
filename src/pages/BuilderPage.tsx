import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { Eye, EyeOff, Send, Plus, Waves, X, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import FieldEditor, { AddFieldStrip } from '@/components/FieldEditor'
import FieldRenderer from '@/components/FieldRenderer'
import LoadingSpinner from '@/components/LoadingSpinner'
import { useToast } from '@/components/ui/toast'

import { storeBlob } from '@/lib/walrus'
import { buildCreateFormTx, addCreateFormCommands } from '@/lib/sui'
import { generateId } from '@/lib/utils'
import { LIMITS } from '@/lib/utils'
import { PACKAGE_ID, STORAGE_MODE } from '@/config'
import type { FieldType, FormField, FormSchema } from '@/types'

// ─── Builder Page ─────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const account = useCurrentAccount()
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [title, setTitle] = useState('Untitled Form')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<FormField[]>([])
  const [preview, setPreview] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({})
  const [adminAddresses, setAdminAddresses] = useState<string[]>([])
  const [newAdminInput, setNewAdminInput] = useState('')

  // ── DnD ────────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setFields((prev) => {
      const from = prev.findIndex((f) => f.id === active.id)
      const to = prev.findIndex((f) => f.id === over.id)
      return arrayMove(prev, from, to)
    })
  }

  // ── Field mutations ─────────────────────────────────────────────────────────

  const addField = (type: FieldType) => {
    const defaults: Partial<FormField> = {}
    if (type === 'dropdown' || type === 'checkbox') {
      defaults.options = ['Option 1', 'Option 2']
    }
    setFields((prev) => [
      ...prev,
      {
        id: generateId(),
        type,
        label: '',
        required: false,
        ...defaults,
      },
    ])
  }

  const updateField = (id: string, updated: FormField) =>
    setFields((prev) => prev.map((f) => (f.id === id ? updated : f)))

  const deleteField = (id: string) => setFields((prev) => prev.filter((f) => f.id !== id))

  // ── Publish ─────────────────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (!account) {
      toast({ type: 'warning', title: 'Connect your wallet first' })
      return
    }
    if (!title.trim()) {
      toast({ type: 'warning', title: 'Please add a form title' })
      return
    }
    if (fields.length === 0) {
      toast({ type: 'warning', title: 'Add at least one field' })
      return
    }
    if (!PACKAGE_ID) {
      toast({
        type: 'error',
        title: 'Contract not configured',
        description: 'Set VITE_PACKAGE_ID in your .env file after deploying the contract.',
      })
      return
    }

    setPublishing(true)
    try {
      // 1. Upload schema to Walrus
      const schema: FormSchema = {
        id: generateId(),
        title: title.trim(),
        description: description.trim(),
        fields,
        createdAt: new Date().toISOString(),
        ownerAddress: account.address,
      }
      toast({ type: 'info', title: 'Uploading schema to Walrus…' })
      let formObjectId: string | undefined

      const schemaBlobId = await storeBlob(schema, {
        signAndExecuteTransaction: signAndExecute as (args: { transaction: unknown }) => Promise<{ digest: string; objectChanges?: unknown[] }>,
        currentAddress: account.address,
        // SDK mode: inject create_form into the Walrus register PTB (saves 1 signature)
        augmentRegisterTx: (tx, blobId) => {
          addCreateFormCommands(tx, schema.title, schema.description, blobId, adminAddresses)
        },
        onRegisterResult: (result) => {
          const changes = (result as { objectChanges?: { type: string; objectId: string; objectType: string }[] }).objectChanges
          formObjectId = changes?.find(c => c.type === 'created' && c.objectType?.includes('::walrus_pulse::Form'))?.objectId
        },
      })

      // Publisher mode: augmentRegisterTx was ignored above — run create_form separately
      if (STORAGE_MODE !== 'sdk') {
        toast({ type: 'info', title: 'Creating form on Sui…' })
        const tx = buildCreateFormTx(schema.title, schema.description, schemaBlobId, adminAddresses)
        const result = await signAndExecute({ transaction: tx as never })
        const changes = (result as { objectChanges?: { type: string; objectId: string; objectType: string }[] }).objectChanges
        formObjectId = changes?.find(c => c.type === 'created' && c.objectType?.includes('::walrus_pulse::Form'))?.objectId
      }

      toast({
        type: 'success',
        title: 'Form published!',
        description: `Schema blob: ${schemaBlobId.slice(0, 20)}…`,
      })

      if (formObjectId) {
        navigate(`/form/${formObjectId}`)
      } else {
        toast({
          type: 'info',
          title: 'Form created',
          description: 'Check your admin dashboard for the form link.',
        })
        navigate('/admin')
      }
    } catch (err) {
      console.error(err)
      toast({
        type: 'error',
        title: 'Publish failed',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setPublishing(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Waves className="h-4 w-4 text-teal-600" />
            Form Builder
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreview((v) => !v)}
              className="gap-1.5"
            >
              {preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {preview ? 'Edit' : 'Preview'}
            </Button>
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing || !account}
              className="gap-1.5"
            >
              {publishing ? (
                <>
                  <LoadingSpinner size="sm" />
                  Publishing…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Publish
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {!account && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 flex items-center gap-2">
            ⚠️ Connect your Sui wallet to publish forms.
          </div>
        )}

        {/* Form header card */}
        <Card className="border-t-4 border-t-teal-500">
          <CardContent className="pt-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Form Title *</Label>
                <span className={`text-xs ${title.length >= LIMITS.formTitle ? 'text-red-500' : 'text-slate-400'}`}>
                  {title.length}/{LIMITS.formTitle}
                </span>
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, LIMITS.formTitle))}
                placeholder="e.g. Bug Report, Feature Request…"
                className="text-lg font-medium"
                disabled={preview}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Description</Label>
                <span className={`text-xs ${description.length >= LIMITS.formDescription ? 'text-red-500' : 'text-slate-400'}`}>
                  {description.length}/{LIMITS.formDescription}
                </span>
              </div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, LIMITS.formDescription))}
                placeholder="Explain what this form is for…"
                className="mt-0"
                rows={2}
                disabled={preview}
              />
            </div>

            {/* Co-admins */}
            {!preview && (
              <div>
                <Label className="flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  Co-admins
                  <span className="text-slate-400 font-normal text-xs">(optional)</span>
                </Label>
                <p className="text-xs text-slate-500 mt-0.5 mb-2">
                  These addresses can manage this form — fund the pool, send rewards, and close it.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newAdminInput}
                    onChange={(e) => setNewAdminInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const addr = newAdminInput.trim()
                        if (addr && !adminAddresses.includes(addr)) {
                          setAdminAddresses((prev) => [...prev, addr])
                          setNewAdminInput('')
                        }
                      }
                    }}
                    placeholder="0x… Sui address"
                    className="font-mono text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const addr = newAdminInput.trim()
                      if (addr && !adminAddresses.includes(addr)) {
                        setAdminAddresses((prev) => [...prev, addr])
                        setNewAdminInput('')
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {adminAddresses.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {adminAddresses.map((addr) => (
                      <div
                        key={addr}
                        className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5"
                      >
                        <span className="text-xs font-mono text-slate-700 truncate">{addr}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAdminAddresses((prev) => prev.filter((a) => a !== addr))
                          }
                          className="text-slate-400 hover:text-red-500 ml-2 shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fields */}
        {preview ? (
          /* ── Preview mode ── */
          <div className="space-y-4">
            {fields.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <p>No fields yet. Switch back to Edit to add some.</p>
              </div>
            ) : (
              fields.map((field) => (
                <Card key={field.id}>
                  <CardContent className="pt-6">
                    <FieldRenderer
                      field={field}
                      value={(previewAnswers[field.id] as never) ?? null}
                      onChange={(val) =>
                        setPreviewAnswers((prev) => ({ ...prev, [field.id]: val }))
                      }
                    />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : (
          /* ── Edit mode ── */
          <div className="space-y-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {fields.map((field) => (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    onChange={(updated) => updateField(field.id, updated)}
                    onDelete={() => deleteField(field.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {fields.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                Add your first field below ↓
              </div>
            )}

            <AddFieldStrip onAdd={addField} />
          </div>
        )}
      </div>
    </div>
  )
}
