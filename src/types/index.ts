// ─── Field Types ──────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'dropdown'
  | 'checkbox'
  | 'rating'
  | 'url'
  | 'image'
  | 'video'

export interface FormField {
  id: string
  type: FieldType
  label: string
  required: boolean
  options?: string[]        // for dropdown / checkbox
  placeholder?: string
  description?: string
  maxFiles?: number         // for file/image
}

// ─── Schema (stored on Walrus) ────────────────────────────────────────────────

export interface FormSchema {
  id: string                // random uuid
  title: string
  description: string
  fields: FormField[]
  createdAt: string         // ISO date string
  ownerAddress?: string
}

// ─── Response (stored on Walrus) ─────────────────────────────────────────────

export type AnswerValue = string | string[] | number | null

export interface FormResponse {
  formObjectId: string      // Sui Form object ID
  schemaBlobId: string      // Walrus blob ID of the schema
  answers: Record<string, AnswerValue>   // fieldId → answer
  submittedAt: string       // ISO date string
  submitter?: string        // wallet address if connected
}

// ─── On-chain Form object ─────────────────────────────────────────────────────

export interface SuiFormFields {
  id: { id: string }
  title: string
  description: string
  schema_blob_id: string
  owner: string
  admins: { fields: { contents: string[] } } | { contents: string[] }
  response_blob_ids: string[]
  is_active: boolean
  reward_pool: { value: string }
  rewarded: { contents: string[] }
}

export interface SuiFormObject {
  objectId: string
  title: string
  description: string
  schemaBlobId: string
  owner: string
  admins: string[]
  responseBlobIds: string[]
  isActive: boolean
  rewardPoolBalance: bigint
  rewardedAddresses: string[]
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  description?: string
}
