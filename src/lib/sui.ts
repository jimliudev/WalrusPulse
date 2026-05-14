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
  initialAdmins: string[] = [],
): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::create_form`,
    arguments: [
      tx.pure('vector<u8>', encodeStr(title)),
      tx.pure('vector<u8>', encodeStr(description)),
      tx.pure('vector<u8>', encodeStr(schemaBlobId)),
      tx.pure('vector<address>', initialAdmins),
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
/**
 * Build a Transaction that deactivates (closes) a form.
 * Only the form owner or a co-admin can call this.
 */
export function buildDeactivateFormTx(formObjectId: string): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::deactivate_form`,
    arguments: [tx.object(formObjectId)],
  })
  return tx
}

/**
 * Build a Transaction that adds a co-admin to a form.
 * Only the owner can call this.
 */
export function buildAddAdminTx(formObjectId: string, adminAddress: string): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::add_admin`,
    arguments: [tx.object(formObjectId), tx.pure('address', adminAddress)],
  })
  return tx
}

/**
 * Build a Transaction that removes a co-admin from a form.
 * Only the owner can call this.
 */
export function buildRemoveAdminTx(formObjectId: string, adminAddress: string): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::remove_admin`,
    arguments: [tx.object(formObjectId), tx.pure('address', adminAddress)],
  })
  return tx
}
// ─── Reward pool transactions ────────────────────────────────────────────────

/**
 * Build a Transaction that funds the form's reward pool with SUI.
 * amountMist is in MIST (1 SUI = 1_000_000_000 MIST).
 */
export function buildFundRewardPoolTx(
  formObjectId: string,
  amountMist: bigint,
): Transaction {
  const tx = new Transaction()
  const [coin] = tx.splitCoins(tx.gas, [tx.pure('u64', amountMist)])
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::fund_reward_pool`,
    arguments: [tx.object(formObjectId), coin],
  })
  return tx
}

/**
 * Build a Transaction that sends a SUI reward to a recipient.
 * amountMist is in MIST (1 SUI = 1_000_000_000 MIST).
 */
export function buildRewardRespondentTx(
  formObjectId: string,
  recipient: string,
  amountMist: bigint,
): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::reward_respondent`,
    arguments: [
      tx.object(formObjectId),
      tx.pure('address', recipient),
      tx.pure('u64', amountMist),
    ],
  })
  return tx
}

// ─── Read on-chain data ───────────────────────────────────────────────────────

/**
 * Fetch a single Form object from Sui and normalise it.
 */
export async function fetchFormObject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
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
    admins: { fields: { contents: string[] } } | { contents: string[] }
    response_blob_ids: string[]
    is_active: boolean
    // Balance<SUI> is serialised as a plain string by the Sui RPC
    reward_pool: string | { value: string }
    // VecSet is serialised as { fields: { contents: address[] } }
    rewarded: { fields: { contents: string[] } } | { contents: string[] }
  }

  // Balance<SUI>: handle both plain-string and nested-object forms
  const rawPool = fields.reward_pool
  const rewardPoolBalance = BigInt(
    typeof rawPool === 'string' ? rawPool : (rawPool?.value ?? '0'),
  )

  // VecSet<address>: handle both { fields: { contents } } and { contents }
  const rawRewarded = fields.rewarded
  const rewardedAddresses: string[] =
    (rawRewarded as { fields?: { contents?: string[] } })?.fields?.contents ??
    (rawRewarded as { contents?: string[] })?.contents ??
    []

  // VecSet<address> for admins — same serialization pattern
  const rawAdmins = fields.admins
  const admins: string[] =
    (rawAdmins as { fields?: { contents?: string[] } })?.fields?.contents ??
    (rawAdmins as { contents?: string[] })?.contents ??
    []

  return {
    objectId,
    title: fields.title,
    description: fields.description,
    schemaBlobId: fields.schema_blob_id,
    owner: fields.owner,
    admins,
    responseBlobIds: fields.response_blob_ids || [],
    isActive: fields.is_active,
    rewardPoolBalance,
    rewardedAddresses,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  ownerAddress: string,
): Promise<SuiFormObject[]> {
  if (!PACKAGE_ID) return []

  const events = await client.queryEvents({
    query: {
      MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::FormCreated`,
    },
    limit: 200,
  })

  const myEvents = events.data.filter((e: { parsedJson: unknown }) => {
    const parsed = e.parsedJson as FormCreatedEvent | undefined
    return parsed?.owner?.toLowerCase() === ownerAddress.toLowerCase()
  })

  const forms = await Promise.all(
    myEvents.map(async (e: { parsedJson: unknown }) => {
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
