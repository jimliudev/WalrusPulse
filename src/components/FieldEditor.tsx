import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Type,
  AlignLeft,
  List,
  CheckSquare,
  Star,
  Link2,
  Image,
  Video,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { cn, generateId } from '@/lib/utils'
import { LIMITS } from '@/lib/utils'
import type { FieldType, FormField } from '@/types'

// ─── Field type metadata ──────────────────────────────────────────────────────

export const FIELD_TYPES: { type: FieldType; label: string; icon: React.ReactNode }[] = [
  { type: 'text', label: 'Short Text', icon: <Type className="h-4 w-4" /> },
  { type: 'textarea', label: 'Long Text', icon: <AlignLeft className="h-4 w-4" /> },
  { type: 'dropdown', label: 'Dropdown', icon: <List className="h-4 w-4" /> },
  { type: 'checkbox', label: 'Checkboxes', icon: <CheckSquare className="h-4 w-4" /> },
  { type: 'rating', label: 'Star Rating', icon: <Star className="h-4 w-4" /> },
  { type: 'url', label: 'URL / Link', icon: <Link2 className="h-4 w-4" /> },
  { type: 'image', label: 'Image Upload', icon: <Image className="h-4 w-4" /> },
  { type: 'video', label: 'Video Upload', icon: <Video className="h-4 w-4" /> },
]

const typeLabels: Record<FieldType, string> = {
  text: 'Short Text',
  textarea: 'Long Text',
  dropdown: 'Dropdown',
  checkbox: 'Checkboxes',
  rating: 'Star Rating',
  url: 'URL',
  image: 'Image Upload',
  video: 'Video Upload',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FieldEditorProps {
  field: FormField
  onChange: (updated: FormField) => void
  onDelete: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FieldEditor({ field, onChange, onDelete }: FieldEditorProps) {
  const [expanded, setExpanded] = useState(true)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const update = (patch: Partial<FormField>) => onChange({ ...field, ...patch })

  const addOption = () => update({ options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] })

  const updateOption = (idx: number, val: string) => {
    const opts = [...(field.options ?? [])]
    opts[idx] = val
    update({ options: opts })
  }

  const removeOption = (idx: number) => {
    const opts = [...(field.options ?? [])]
    opts.splice(idx, 1)
    update({ options: opts })
  }

  const hasOptions = field.type === 'dropdown' || field.type === 'checkbox'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white border rounded-xl transition-shadow',
        isDragging ? 'shadow-lg border-teal-300' : 'border-slate-200 shadow-sm',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-slate-300 hover:text-slate-500 transition-colors touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {/* Field label (editable) */}
        <input
          value={field.label}
          onChange={(e) => update({ label: e.target.value.slice(0, LIMITS.fieldLabel) })}
          className="flex-1 text-sm font-medium text-slate-800 bg-transparent border-none outline-none focus:outline-none placeholder:text-slate-400"
          placeholder="Field label…"
          maxLength={LIMITS.fieldLabel}
        />

        {/* Type badge */}
        <Badge variant="secondary" className="hidden sm:flex shrink-0 gap-1">
          {FIELD_TYPES.find((t) => t.type === field.type)?.icon}
          {typeLabels[field.type]}
        </Badge>

        {/* Required toggle */}
        <button
          type="button"
          onClick={() => update({ required: !field.required })}
          className={cn(
            'text-xs px-2 py-1 rounded-md font-medium transition-colors',
            field.required
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-slate-50 text-slate-500 border border-slate-200',
          )}
        >
          {field.required ? 'Required' : 'Optional'}
        </button>

        {/* Expand / collapse */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          className="text-slate-300 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {/* Description */}
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">Helper text (optional)</Label>
            <Input
              placeholder="Describe what you're asking for…"
              value={field.description ?? ''}
              onChange={(e) => update({ description: e.target.value.slice(0, LIMITS.fieldHelperText) })}
              className="text-sm h-8"
              maxLength={LIMITS.fieldHelperText}
            />
          </div>

          {/* Placeholder (for text / textarea / url) */}
          {(field.type === 'text' || field.type === 'textarea' || field.type === 'url') && (
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Placeholder</Label>
              <Input
                placeholder="Placeholder text…"
                value={field.placeholder ?? ''}
                onChange={(e) => update({ placeholder: e.target.value.slice(0, LIMITS.fieldPlaceholder) })}
                className="text-sm h-8"
                maxLength={LIMITS.fieldPlaceholder}
              />
            </div>
          )}

          {/* Options (for dropdown / checkbox) */}
          {hasOptions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-500">Options</Label>
                <span className={`text-xs ${(field.options?.length ?? 0) >= LIMITS.maxOptions ? 'text-red-500' : 'text-slate-400'}`}>
                  {field.options?.length ?? 0}/{LIMITS.maxOptions}
                </span>
              </div>
              {(field.options ?? []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value.slice(0, LIMITS.optionText))}
                    className="text-sm h-8"
                    placeholder={`Option ${i + 1}`}
                    maxLength={LIMITS.optionText}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                disabled={(field.options?.length ?? 0) >= LIMITS.maxOptions}
                className="w-full border-dashed text-slate-500 disabled:opacity-40"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Option
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add field button strip ───────────────────────────────────────────────────

interface AddFieldStripProps {
  onAdd: (type: FieldType) => void
}

export function AddFieldStrip({ onAdd }: AddFieldStripProps) {
  return (
    <div className="border border-dashed border-slate-200 rounded-xl p-4 bg-slate-50">
      <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
        Add a field
      </p>
      <div className="flex flex-wrap gap-2">
        {FIELD_TYPES.map(({ type, label, icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => onAdd(type)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-700 bg-white border border-slate-200 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50 transition-colors shadow-sm"
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
