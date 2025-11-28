/**
 * Stablecoin Registry for SIP Protocol
 *
 * Provides a comprehensive registry of supported stablecoins across chains.
 * All addresses are verified contract addresses from official sources.
 */

import type { Asset, ChainId, StablecoinSymbol } from '@sip-protocol/types'

/**
 * Stablecoin metadata
 */
export interface StablecoinInfo {
  /** Token symbol */
  symbol: StablecoinSymbol
  /** Full name */
  name: string
  /** Issuer/protocol */
  issuer: string
  /** Whether it's fiat-backed, crypto-backed, or algorithmic */
  type: 'fiat-backed' | 'crypto-backed' | 'algorithmic'
  /** Description */
  description: string
}

/**
 * Stablecoin metadata registry
 */
export const STABLECOIN_INFO: Record<StablecoinSymbol, StablecoinInfo> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    issuer: 'Circle',
    type: 'fiat-backed',
    description: 'Fully-reserved US dollar stablecoin by Circle',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    issuer: 'Tether',
    type: 'fiat-backed',
    description: 'Largest stablecoin by market cap',
  },
  DAI: {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    issuer: 'MakerDAO',
    type: 'crypto-backed',
    description: 'Decentralized crypto-collateralized stablecoin',
  },
  BUSD: {
    symbol: 'BUSD',
    name: 'Binance USD',
    issuer: 'Paxos/Binance',
    type: 'fiat-backed',
    description: 'Regulated stablecoin by Paxos',
  },
  FRAX: {
    symbol: 'FRAX',
    name: 'Frax',
    issuer: 'Frax Finance',
    type: 'algorithmic',
    description: 'Fractional-algorithmic stablecoin',
  },
  LUSD: {
    symbol: 'LUSD',
    name: 'Liquity USD',
    issuer: 'Liquity',
    type: 'crypto-backed',
    description: 'ETH-backed stablecoin with 0% interest loans',
  },
  PYUSD: {
    symbol: 'PYUSD',
    name: 'PayPal USD',
    issuer: 'PayPal/Paxos',
    type: 'fiat-backed',
    description: 'PayPal\'s regulated stablecoin',
  },
}

/**
 * Contract addresses by chain
 * Note: null means native or not available on that chain
 *
 * Addresses verified from:
 * - USDC: https://www.circle.com/en/usdc
 * - USDT: https://tether.to/en/transparency
 * - DAI: https://docs.makerdao.com/
 * - Others: Official protocol documentation
 */
export const STABLECOIN_ADDRESSES: Record<StablecoinSymbol, Partial<Record<ChainId, string>>> = {
  USDC: {
    ethereum: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    polygon: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // Native USDC
    arbitrum: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // Native USDC
    optimism: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // Native USDC
    base: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Native USDC
    solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // SPL token
    near: 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near', // Bridged
  },
  USDT: {
    ethereum: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    polygon: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', // PoS USDT
    arbitrum: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
    optimism: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
    base: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2',
    solana: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // SPL token
    near: 'dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near', // Bridged
  },
  DAI: {
    ethereum: '0x6b175474e89094c44da98b954eedeac495271d0f',
    polygon: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', // PoS DAI
    arbitrum: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    optimism: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1',
    base: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
  },
  BUSD: {
    ethereum: '0x4fabb145d64652a948d72533023f6e7a623c7c53',
    // Note: BUSD is being phased out, limited chain support
  },
  FRAX: {
    ethereum: '0x853d955acef822db058eb8505911ed77f175b99e',
    polygon: '0x45c32fa6df82ead1e2ef74d17b76547eddfaff89',
    arbitrum: '0x17fc002b466eec40dae837fc4be5c67993ddbd6f',
    optimism: '0x2e3d870790dc77a83dd1d18184acc7439a53f475',
  },
  LUSD: {
    ethereum: '0x5f98805a4e8be255a32880fdec7f6728c6568ba0',
    arbitrum: '0x93b346b6bc2548da6a1e7d98e9a421b42541425b',
    optimism: '0xc40f949f8a4e094d1b49a23ea9241d289b7b2819',
  },
  PYUSD: {
    ethereum: '0x6c3ea9036406852006290770bedfcaba0e23a0e8',
    // PYUSD is relatively new, limited chain support
  },
}

/**
 * Decimals for each stablecoin
 * Most use 6 decimals (USDC, USDT), but some use 18 (DAI)
 */
export const STABLECOIN_DECIMALS: Record<StablecoinSymbol, number> = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
  BUSD: 18,
  FRAX: 18,
  LUSD: 18,
  PYUSD: 6,
}

/**
 * Get stablecoin asset for a specific chain
 *
 * @param symbol - Stablecoin symbol (e.g., 'USDC')
 * @param chain - Target chain
 * @returns Asset object or null if not available on chain
 *
 * @example
 * ```typescript
 * const usdc = getStablecoin('USDC', 'ethereum')
 * // { chain: 'ethereum', symbol: 'USDC', address: '0xa0b8...', decimals: 6 }
 *
 * const usdcSol = getStablecoin('USDC', 'solana')
 * // { chain: 'solana', symbol: 'USDC', address: 'EPjF...', decimals: 6 }
 * ```
 */
export function getStablecoin(symbol: StablecoinSymbol, chain: ChainId): Asset | null {
  const address = STABLECOIN_ADDRESSES[symbol]?.[chain]
  if (!address) {
    return null
  }

  return {
    chain,
    symbol,
    address: address as `0x${string}`,
    decimals: STABLECOIN_DECIMALS[symbol],
  }
}

/**
 * Get all supported stablecoins for a chain
 *
 * @param chain - Target chain
 * @returns Array of available stablecoin assets
 *
 * @example
 * ```typescript
 * const ethStables = getStablecoinsForChain('ethereum')
 * // [USDC, USDT, DAI, BUSD, FRAX, LUSD, PYUSD]
 * ```
 */
export function getStablecoinsForChain(chain: ChainId): Asset[] {
  const stables: Asset[] = []

  for (const symbol of Object.keys(STABLECOIN_ADDRESSES) as StablecoinSymbol[]) {
    const asset = getStablecoin(symbol, chain)
    if (asset) {
      stables.push(asset)
    }
  }

  return stables
}

/**
 * Check if a token symbol is a supported stablecoin
 */
export function isStablecoin(symbol: string): symbol is StablecoinSymbol {
  return symbol in STABLECOIN_ADDRESSES
}

/**
 * Get stablecoin info (metadata)
 */
export function getStablecoinInfo(symbol: StablecoinSymbol): StablecoinInfo {
  return STABLECOIN_INFO[symbol]
}

/**
 * Get all supported stablecoin symbols
 */
export function getSupportedStablecoins(): StablecoinSymbol[] {
  return Object.keys(STABLECOIN_ADDRESSES) as StablecoinSymbol[]
}

/**
 * Check if a stablecoin is available on a specific chain
 */
export function isStablecoinOnChain(symbol: StablecoinSymbol, chain: ChainId): boolean {
  return !!STABLECOIN_ADDRESSES[symbol]?.[chain]
}

/**
 * Get all chains where a stablecoin is available
 */
export function getChainsForStablecoin(symbol: StablecoinSymbol): ChainId[] {
  const addresses = STABLECOIN_ADDRESSES[symbol]
  if (!addresses) return []
  return Object.keys(addresses) as ChainId[]
}

/**
 * Convert human-readable amount to smallest units
 *
 * @param amount - Human-readable amount (e.g., 100.50)
 * @param symbol - Stablecoin symbol
 * @returns Amount in smallest units (e.g., 100500000 for USDC)
 *
 * @example
 * ```typescript
 * toStablecoinUnits(100.50, 'USDC') // 100500000n (6 decimals)
 * toStablecoinUnits(100.50, 'DAI')  // 100500000000000000000n (18 decimals)
 * ```
 */
export function toStablecoinUnits(amount: number, symbol: StablecoinSymbol): bigint {
  const decimals = STABLECOIN_DECIMALS[symbol]
  const factor = 10 ** decimals
  return BigInt(Math.floor(amount * factor))
}

/**
 * Convert smallest units to human-readable amount
 *
 * @param units - Amount in smallest units
 * @param symbol - Stablecoin symbol
 * @returns Human-readable amount
 *
 * @example
 * ```typescript
 * fromStablecoinUnits(100500000n, 'USDC') // 100.5
 * fromStablecoinUnits(100500000000000000000n, 'DAI') // 100.5
 * ```
 */
export function fromStablecoinUnits(units: bigint, symbol: StablecoinSymbol): number {
  const decimals = STABLECOIN_DECIMALS[symbol]
  const factor = 10 ** decimals
  return Number(units) / factor
}

/**
 * Format stablecoin amount for display
 *
 * @param units - Amount in smallest units
 * @param symbol - Stablecoin symbol
 * @param options - Formatting options
 * @returns Formatted string (e.g., "100.50 USDC")
 */
export function formatStablecoinAmount(
  units: bigint,
  symbol: StablecoinSymbol,
  options?: {
    includeSymbol?: boolean
    minimumFractionDigits?: number
    maximumFractionDigits?: number
  }
): string {
  const amount = fromStablecoinUnits(units, symbol)
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  })

  return options?.includeSymbol !== false ? `${formatted} ${symbol}` : formatted
}
