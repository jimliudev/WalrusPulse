// Walrus network configuration — override via .env
export const WALRUS_PUBLISHER =
  import.meta.env.VITE_WALRUS_PUBLISHER_URL ||
  'https://publisher.walrus-testnet.walrus.space'

export const WALRUS_AGGREGATOR =
  import.meta.env.VITE_WALRUS_AGGREGATOR_URL ||
  'https://aggregator.walrus-testnet.walrus.space'

export const WALRUS_EPOCHS = Number(import.meta.env.VITE_WALRUS_EPOCHS || 5)

// Sui configuration
export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || ''

export const SUI_NETWORK = (
  import.meta.env.VITE_SUI_NETWORK || 'testnet'
) as 'testnet' | 'mainnet' | 'devnet'

export const MODULE_NAME = 'walrus_pulse'

export const STORAGE_MODE = (
  import.meta.env.VITE_STORAGE_MODE || 'publisher'
) as 'publisher' | 'sdk'
