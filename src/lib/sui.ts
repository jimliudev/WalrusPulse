import { Transaction } from '@mysten/sui/transactions'
import { MODULE_NAME, PACKAGE_ID } from '@/config'
import type { SuiClient } from '@mysten/sui/client'
import type { SuiFormObject } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encodeStr(s: string): number[] {
  return Array.from(new TextEncoder().encode(s))
}

// ─── Build transactions ───────────────────────────────────────────────────────

/**
 * Build a Transaction that calls walrus_pulse::create_form on-chain.
 */
export function buildCreateFormTx(
  title: string,
  description: string,
  schemaBlobId: string,
): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::create_form`,
    arguments: [
      tx.pure('vector<u8>', encodeStr(title)),
      tx.pure('vector<u8>', encodeStr(description)),
      tx.pure('vector<u8>', encodeStr(schemaBlobId)),
    ],
  })
  return tx
}

/**
 * Build a Transaction that calls walrus_pulse::submit_response on-chain.
 */
export function buildSubmitResponseTx(
  formObjectId: string,
  responseBlobId: string,
): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::submit_response`,
    arguments: [
      tx.object(formObjectId),
      tx.pure('vector<u8>', encodeStr(responseBlobId)),
    ],
  })
  return tx
}

// ─── Read on-chain data ───────────────────────────────────────────────────────

/**
 * Fetch a single Form object from Sui and normalise it.
 */
export async function fetchFormObject(
  client: SuiClient,
  objectId: string,
): Promise<SuiFormObject> {
  const result = await client.getObject({
    id: objectId,
    options: { showContent: true },
  })

  if (!result.data?.content || result.data.content.dataType !== 'moveObject') {
    throw new Error(`Form object not found or invalid: ${objectId}`)
  }

  const fields = result.data.content.fields as {
    id: { id: string }
    title: string
    description: string
    schema_blob_id: string
    owner: string
    response_blob_ids: string[]
    is_active: boolean
  }

  return {
    objectId,
    title: fields.title,
    description: fields.description,
    schemaBlobId: fields.schema_blob_id,
    owner: fields.owner,
    responseBlobIds: fields.response_blob_ids || [],
    isActive: fields.is_active,
  }
}

// ─── Query forms created by a specific address ───────────────────────────────

export interface FormCreatedEvent {
  form_id: string
  title: string
  schema_blob_id: string
  owner: string
}

/**
 * Query the FormCreated events emitted by this package and return those
 * belonging to the given owner address.
 */
export async function fetchFormsCreatedBy(
  client: SuiClient,
  ownerAddress: string,
): Promise<SuiFormObject[]> {
  if (!PACKAGE_ID) return []

  const events = await client.queryEvents({
    query: {
      MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::FormCreated`,
    },
    limit: 200,
  })

  const myEvents = events.data.filter((e) => {
    const parsed = e.parsedJson as FormCreatedEvent | undefined
    return parsed?.owner?.toLowerCase() === ownerAddress.toLowerCase()
  })

  const forms = await Promise.all(
    myEvents.map(async (e) => {
      const parsed = e.parsedJson as FormCreatedEvent
      try {
        return await fetchFormObject(client, parsed.form_id)
      } catch {
        return null
      }
    }),
  )

  return forms.filter((f): f is SuiFormObject => f !== null)
}
