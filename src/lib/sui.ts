import { Transaction } from '@mysten/sui/transactions'
import { MODULE_NAME, PACKAGE_ID } from '@/config'
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
  addCreateFormCommands(tx, title, description, schemaBlobId, initialAdmins)
  return tx
}

/**
 * Inject create_form commands into an existing Transaction.
 * Used for PTB merging: add these to the Walrus register tx so both operations
 * share a single wallet signature.
 */
export function addCreateFormCommands(
  tx: Transaction,
  title: string,
  description: string,
  schemaBlobId: string,
  initialAdmins: string[] = [],
): void {
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::create_form`,
    arguments: [
      tx.pure('vector<u8>', encodeStr(title)),
      tx.pure('vector<u8>', encodeStr(description)),
      tx.pure('vector<u8>', encodeStr(schemaBlobId)),
      tx.pure('vector<address>', initialAdmins),
    ],
  })
}

/**
 * Build a Transaction that calls walrus_pulse::submit_response on-chain.
 */
export function buildSubmitResponseTx(
  formObjectId: string,
  responseBlobId: string,
): Transaction {
  const tx = new Transaction()
  addSubmitResponseCommands(tx, formObjectId, responseBlobId)
  return tx
}

/**
 * Inject submit_response commands into an existing Transaction.
 * Used for PTB merging: add these to the Walrus register tx so both operations
 * share a single wallet signature.
 */
export function addSubmitResponseCommands(
  tx: Transaction,
  formObjectId: string,
  blobId: string,
): void {
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::submit_response`,
    arguments: [
      tx.object(formObjectId),
      tx.pure('vector<u8>', encodeStr(blobId)),
    ],
  })
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

/**
 * Build a Transaction that transfers form ownership to a new address.
 * Only the current owner can call this.
 */
export function buildTransferOwnershipTx(formObjectId: string, newOwner: string): Transaction {
  const tx = new Transaction()
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::transfer_ownership`,
    arguments: [tx.object(formObjectId), tx.pure('address', newOwner)],
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

interface OwnershipTransferredEvent {
  form_id: string
  old_owner: string
  new_owner: string
}

/**
 * Query forms currently owned by `ownerAddress`.
 * Accounts for ownership transfers:
 *  - Originally created by this address (FormCreated events)
 *  - Received via transfer (OwnershipTransferred.new_owner == address)
 *  - Minus those transferred away (OwnershipTransferred.old_owner == address)
 * Final check uses the on-chain Form.owner field to confirm.
 */
export async function fetchFormsCreatedBy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  ownerAddress: string,
): Promise<SuiFormObject[]> {
  if (!PACKAGE_ID) return []

  const lower = ownerAddress.toLowerCase()

  const [createdEvents, transferEvents] = await Promise.all([
    client.queryEvents({
      query: { MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::FormCreated` },
      limit: 500,
    }),
    client.queryEvents({
      query: { MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::OwnershipTransferred` },
      limit: 500,
    }),
  ])

  // Form IDs originally created by this address
  const createdFormIds = new Set<string>(
    (createdEvents.data as { parsedJson: unknown }[])
      .map((e) => e.parsedJson as FormCreatedEvent)
      .filter((p) => p?.owner?.toLowerCase() === lower)
      .map((p) => p.form_id),
  )

  // Form IDs transferred TO this address
  const receivedFormIds = new Set<string>(
    (transferEvents.data as { parsedJson: unknown }[])
      .map((e) => e.parsedJson as OwnershipTransferredEvent)
      .filter((p) => p?.new_owner?.toLowerCase() === lower)
      .map((p) => p.form_id),
  )

  // Form IDs transferred AWAY from this address
  const transferredAwayFormIds = new Set<string>(
    (transferEvents.data as { parsedJson: unknown }[])
      .map((e) => e.parsedJson as OwnershipTransferredEvent)
      .filter((p) => p?.old_owner?.toLowerCase() === lower)
      .map((p) => p.form_id),
  )

  // Candidate form IDs: (created + received) minus transferred away
  const candidateIds = new Set([...createdFormIds, ...receivedFormIds])
  transferredAwayFormIds.forEach((id) => candidateIds.delete(id))

  const forms = await Promise.all(
    [...candidateIds].map(async (formId) => {
      try {
        const form = await fetchFormObject(client, formId)
        // Final on-chain confirmation: must still be the current owner
        if (form.owner.toLowerCase() === lower) return form
        return null
      } catch {
        return null
      }
    }),
  )

  return forms.filter((f): f is SuiFormObject => f !== null)
}

// ─── Query forms where address is a co-admin ─────────────────────────────────

interface AdminAddedEvent {
  form_id: string
  admin: string
  added_by: string
}

interface AdminRemovedEvent {
  form_id: string
  admin: string
  removed_by: string
}

/**
 * Find all forms where `adminAddress` was added as a co-admin.
 * Subtracts forms where they were subsequently removed.
 * Returns fetched SuiFormObjects (only those where they are still listed as admin).
 */
export async function fetchFormsWhereAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  adminAddress: string,
): Promise<SuiFormObject[]> {
  if (!PACKAGE_ID) return []

  const lower = adminAddress.toLowerCase()

  const [addedEvents, removedEvents] = await Promise.all([
    client.queryEvents({
      query: { MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::AdminAdded` },
      limit: 500,
    }),
    client.queryEvents({
      query: { MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::AdminRemoved` },
      limit: 500,
    }),
  ])

  // form IDs where this address was added
  const addedFormIds = new Set<string>(
    (addedEvents.data as { parsedJson: unknown }[])
      .map((e) => e.parsedJson as AdminAddedEvent)
      .filter((p) => p?.admin?.toLowerCase() === lower)
      .map((p) => p.form_id),
  )

  // form IDs where this address was later removed
  const removedFormIds = new Set<string>(
    (removedEvents.data as { parsedJson: unknown }[])
      .map((e) => e.parsedJson as AdminRemovedEvent)
      .filter((p) => p?.admin?.toLowerCase() === lower)
      .map((p) => p.form_id),
  )

  // still-active admin assignments
  const activeFormIds = [...addedFormIds].filter((id) => !removedFormIds.has(id))

  const forms = await Promise.all(
    activeFormIds.map(async (formId) => {
      try {
        const form = await fetchFormObject(client, formId)
        // Double-check on-chain admins list (handles edge cases)
        if (form.admins.some((a) => a.toLowerCase() === lower)) return form
        return null
      } catch {
        return null
      }
    }),
  )

  return forms.filter((f): f is SuiFormObject => f !== null)
}
