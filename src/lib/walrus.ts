import { Transaction } from '@mysten/sui/transactions'
import { WALRUS_AGGREGATOR, WALRUS_EPOCHS, WALRUS_PUBLISHER, STORAGE_MODE, SUI_NETWORK } from '@/config'
import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Options used by the SDK-based storage provider.
 * Publisher mode ignores these; SDK mode requires them.
 */
export interface StoreBlobOptions {
  /** dapp-kit signAndExecuteTransaction mutateAsync – required in SDK mode */
  signAndExecuteTransaction?: (args: { transaction: unknown }) => Promise<{ digest: string; objectChanges?: unknown[] }>
  /** The connected wallet address – required in SDK mode */
  currentAddress?: string
  /**
   * SDK mode only: called with the raw register Transaction and the blobId
   * (known after encode). Inject additional moveCall commands here to merge
   * your Sui contract tx into the same PTB as the Walrus register, saving
   * one wallet signature.
   */
  augmentRegisterTx?: (tx: Transaction, blobId: string) => void
  /**
   * SDK mode only: called with the register tx execution result so callers
   * can read objectChanges from the merged PTB (e.g. the created Form ID).
   */
  onRegisterResult?: (result: { digest: string; objectChanges?: unknown[] }) => void
}

export interface StorageProvider {
  storeBlob(data: object | string | Blob | File, options?: StoreBlobOptions): Promise<string>
}

// ─── Publisher provider (HTTP PUT — publisher pays WAL) ───────────────────────

export class PublisherProvider implements StorageProvider {
  async storeBlob(data: object | string | Blob | File): Promise<string> {
    let body: BodyInit
    let contentType: string

    if (data instanceof Blob || data instanceof File) {
      body = data
      contentType = data.type || 'application/octet-stream'
    } else if (typeof data === 'string') {
      body = new Blob([data], { type: 'text/plain' })
      contentType = 'text/plain'
    } else {
      body = new Blob([JSON.stringify(data)], { type: 'application/json' })
      contentType = 'application/json'
    }

    const url = `${WALRUS_PUBLISHER}/v1/blobs?epochs=${WALRUS_EPOCHS}`
    const response = await fetch(url, {
      method: 'PUT',
      body,
      headers: { 'Content-Type': contentType },
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText)
      throw new Error(`Walrus store failed (${response.status}): ${errText}`)
    }

    const result = await response.json()

    if (result.newlyCreated?.blobObject?.blobId) {
      return result.newlyCreated.blobObject.blobId as string
    }
    if (result.alreadyCertified?.blobId) {
      return result.alreadyCertified.blobId as string
    }

    throw new Error('Unexpected Walrus response: ' + JSON.stringify(result))
  }
}

// ─── Walrus SDK provider (user pays WAL via their wallet) ─────────────────────
//
// Uses the @mysten/walrus writeBlobFlow API which returns plain Transaction
// objects for the register and certify steps so they can be signed externally
// by the connected browser wallet (no private-key access required).
//
// Flow:
//   1. encode()            – WASM erasure-coding (CPU only, no signing)
//   2. register(options)   → Transaction   → signAndExecuteTransaction #1
//   3. upload({ digest })  – push slivers to storage nodes
//   4. certify()           → Transaction   → signAndExecuteTransaction #2
//   5. getBlob()           – returns final blobId
//
// ⚠️  Requires @mysten/sui@^2.x peer dep to be satisfied for full runtime
//     compatibility. Currently running on 1.x; upgrade when ready.

export class WalrusSDKProvider implements StorageProvider {
  async storeBlob(
    data: object | string | Blob | File,
    options?: StoreBlobOptions,
  ): Promise<string> {
    if (!options?.signAndExecuteTransaction || !options?.currentAddress) {
      throw new Error(
        'WalrusSDKProvider requires signAndExecuteTransaction and currentAddress. ' +
          'Ensure STORAGE_MODE=sdk and the wallet is connected.',
      )
    }

    // Dynamic imports keep walrus SDK + WASM out of the initial bundle.
    // NOTE: If the app is hosted on Walrus itself, these chunks are also
    // served from Walrus. A 503 from a storage node will prevent the SDK
    // from loading entirely. Use STORAGE_MODE=publisher for production
    // deployments on Walrus to avoid this circular dependency.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let WalrusClient: any, SuiJsonRpcClient: any
    try {
      ;({ WalrusClient } = await import('@mysten/walrus'))
      ;({ SuiJsonRpcClient } = await import('@mysten/sui/jsonRpc'))
    } catch (importErr) {
      throw new Error(
        'Failed to load Walrus SDK. ' +
        (importErr instanceof TypeError && importErr.message.includes('Failed to fetch')
          ? 'The Walrus network may be temporarily unavailable (503). Try switching STORAGE_MODE to "publisher" for more resilience.'
          : String(importErr)),
      )
    }

    const rpcUrl =
      SUI_NETWORK === 'mainnet'
        ? 'https://fullnode.mainnet.sui.io:443'
        : 'https://fullnode.testnet.sui.io:443'

    const suiClient = new SuiJsonRpcClient({ url: rpcUrl, network: SUI_NETWORK as 'mainnet' | 'testnet' })
    const client = new WalrusClient({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      network: SUI_NETWORK as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      suiClient: suiClient as any,
      wasmUrl: walrusWasmUrl,
    })

    // Normalise input to Uint8Array
    let bytes: Uint8Array
    if (data instanceof File || data instanceof Blob) {
      bytes = new Uint8Array(await data.arrayBuffer())
    } else if (typeof data === 'string') {
      bytes = new TextEncoder().encode(data)
    } else {
      bytes = new TextEncoder().encode(JSON.stringify(data))
    }

    // Create a stateful upload flow
    const flow = client.writeBlobFlow({ blob: bytes })

    // Step 1: Encode with WASM – blobId is determined here, before any signing
    const encodeResult = await flow.encode()

    // Step 2: Build register transaction and execute via wallet.
    // IMPORTANT: flow.register() returns a @mysten/sui@2.x Transaction that
    // contains coinWithBalance (WAL payment). dapp-kit uses its own @mysten/sui@1.x
    // client internally, which has no `.core` property → calling toJSON() on
    // the raw Transaction crashes with "Cannot read properties of undefined
    // (reading 'getBalance')".
    //
    // Fix: pre-build with our own 2.x suiClient so coinWithBalance is resolved
    // into a concrete coin object. Transaction.from(bytes) reconstructs a fully
    // resolved Transaction with no pending dynamic inputs → dapp-kit's toJSON()
    // can serialise it without touching the client at all.
    const registerTxRaw = flow.register({
      deletable: false,
      epochs: WALRUS_EPOCHS,
      owner: options.currentAddress,
    })

    // Merge caller's Sui contract commands into the same PTB (SDK mode PTB merge)
    options.augmentRegisterTx?.(registerTxRaw, encodeResult.blobId)

    registerTxRaw.setSender(options.currentAddress)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registerBytes = await registerTxRaw.build({ client: suiClient as any })
    const registerTx = Transaction.from(registerBytes)

    const registerResult = await options.signAndExecuteTransaction({
      transaction: registerTx,
    })

    // Return register result so caller can read objectChanges from merged PTB
    options.onRegisterResult?.(registerResult)

    // Step 3: Upload slivers to storage nodes
    // Pass the tx digest so nodes can verify on-chain registration
    await flow.upload({ digest: registerResult.digest })

    // Step 4: Build certify transaction and execute via wallet.
    // Same pre-build pattern as register (certify also uses suiClient for gas).
    const certifyTxRaw = flow.certify()
    certifyTxRaw.setSender(options.currentAddress)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const certifyBytes = await certifyTxRaw.build({ client: suiClient as any })
    const certifyTx = Transaction.from(certifyBytes)

    await options.signAndExecuteTransaction({ transaction: certifyTx })

    // Step 5: Retrieve final certified blob
    const certified = await flow.getBlob()
    return certified.blobId
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

function createStorageProvider(): StorageProvider {
  if (STORAGE_MODE === 'sdk') {
    return new WalrusSDKProvider()
  }
  return new PublisherProvider()
}

const provider = createStorageProvider()

// ─── SDK chunk preloader ──────────────────────────────────────────────────────
//
// When STORAGE_MODE=sdk the app's JS chunks (including @mysten/walrus) are
// themselves served from Walrus. If we wait until the first user upload to
// trigger the dynamic import, a momentary 503 at that instant will cause the
// upload to fail with "Failed to fetch dynamically imported module".
//
// Fix: fire-and-forget the dynamic imports at module-load time so that the
// chunks are in the browser's module registry long before any user action.
// Errors are intentionally swallowed here – storeBlob will surface a clear
// error message if the chunks are still missing when actually needed.
if (STORAGE_MODE === 'sdk') {
  import('@mysten/walrus').catch(() => {})
  import('@mysten/sui/jsonRpc').catch(() => {})
}

// ─── Store blob (public, backwards-compatible) ────────────────────────────────

/**
 * Upload arbitrary data to Walrus and return the blob ID.
 * In publisher mode, options are ignored.
 * In SDK mode, signAndExecuteTransaction + currentAddress are required.
 */
export async function storeBlob(
  data: object | string | Blob | File,
  options?: StoreBlobOptions,
): Promise<string> {
  return provider.storeBlob(data, options)
}

// ─── Read blob ────────────────────────────────────────────────────────────────

/**
 * Download a blob from Walrus.
 * Returns parsed JSON if the content looks like JSON, otherwise the raw text.
 */
export async function readBlob<T = unknown>(blobId: string): Promise<T> {
  const url = `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Walrus read failed (${response.status}): ${response.statusText}`)
  }

  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

/**
 * Returns the public URL to access a blob via the Walrus aggregator.
 * Useful for embedding images / videos directly in <img> / <video>.
 */
export function getBlobUrl(blobId: string): string {
  return `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`
}

/**
 * Fetch a blob and trigger a browser download with the correct file extension
 * derived from the Content-Type header.
 */
export async function downloadBlob(blobId: string, fallbackName = 'download'): Promise<void> {
  const url = getBlobUrl(blobId)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed: ${response.status}`)

  const contentType = response.headers.get('Content-Type') || ''
  const ext = mimeToExt(contentType)
  const filename = ext ? `${fallbackName}.${ext}` : fallbackName

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }
  // Match e.g. "video/mp4; codecs=..." → "video/mp4"
  const base = mime.split(';')[0].trim()
  return map[base] ?? ''
}
