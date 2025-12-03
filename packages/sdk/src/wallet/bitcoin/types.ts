/**
 * Bitcoin Wallet Types
 *
 * Type definitions for Bitcoin wallet adapters.
 * Supports Unisat, Xverse, Leather, and OKX wallets.
 */

import type { HexString } from '@sip-protocol/types'

/**
 * Bitcoin address types
 */
export type BitcoinAddressType = 'p2tr' | 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh'

/**
 * Bitcoin network types
 */
export type BitcoinNetwork = 'livenet' | 'testnet'

/**
 * Bitcoin address with metadata
 */
export interface BitcoinAddress {
  /** Address string (bc1p... for Taproot) */
  address: string
  /** Public key (33 bytes compressed or 32 bytes x-only for Taproot) */
  publicKey: string
  /** Address type */
  type: BitcoinAddressType
}

/**
 * Bitcoin balance information
 */
export interface BitcoinBalance {
  /** Confirmed balance in satoshis */
  confirmed: bigint
  /** Unconfirmed balance in satoshis */
  unconfirmed: bigint
  /** Total balance in satoshis */
  total: bigint
}

/**
 * Options for PSBT signing
 */
export interface SignPsbtOptions {
  /** Whether to automatically finalize after signing */
  autoFinalized?: boolean
  /** Specific inputs to sign */
  toSignInputs?: ToSignInput[]
}

/**
 * Input specification for PSBT signing
 */
export interface ToSignInput {
  /** Input index to sign */
  index: number
  /** Address associated with this input */
  address?: string
  /** Public key for this input */
  publicKey?: string
  /** Sighash types allowed (default: [0x01]) */
  sighashTypes?: number[]
}

/**
 * Supported Bitcoin wallet names
 */
export type BitcoinWalletName = 'unisat' | 'xverse' | 'leather' | 'okx'

/**
 * Configuration for Bitcoin wallet adapter
 */
export interface BitcoinAdapterConfig {
  /** Wallet to connect to */
  wallet?: BitcoinWalletName
  /** Bitcoin network */
  network?: BitcoinNetwork
  /** Injected provider (for testing) */
  provider?: UnisatAPI
}

/**
 * Unisat wallet API interface
 *
 * Official API: https://docs.unisat.io/dev/unisat-developer-service/unisat-wallet
 */
export interface UnisatAPI {
  /**
   * Request account access
   * @returns Array of addresses (Taproot addresses)
   */
  requestAccounts(): Promise<string[]>

  /**
   * Get current accounts (if already connected)
   * @returns Array of addresses
   */
  getAccounts(): Promise<string[]>

  /**
   * Get public key for current account
   * @returns 64-char hex string (32 bytes x-only for Taproot)
   */
  getPublicKey(): Promise<string>

  /**
   * Get balance for current account
   * @returns Balance information in satoshis
   */
  getBalance(): Promise<{
    confirmed: number
    unconfirmed: number
    total: number
  }>

  /**
   * Sign a PSBT (Partially Signed Bitcoin Transaction)
   * @param psbtHex - PSBT in hex format
   * @param options - Signing options
   * @returns Signed PSBT in hex format
   */
  signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string>

  /**
   * Sign a message
   * @param message - Message to sign
   * @param type - Signature type (default: 'ecdsa')
   * @returns Signature as base64 string
   */
  signMessage(message: string, type?: 'ecdsa' | 'bip322-simple'): Promise<string>

  /**
   * Push a signed transaction to the network
   * @param rawTx - Raw transaction hex
   * @returns Transaction ID
   */
  pushTx(rawTx: string): Promise<string>

  /**
   * Get current network
   * @returns Network identifier
   */
  getNetwork(): Promise<BitcoinNetwork>

  /**
   * Switch network
   * @param network - Network to switch to
   */
  switchNetwork(network: BitcoinNetwork): Promise<void>

  /**
   * Get chain info
   * @returns Chain identifier ('BITCOIN_MAINNET' or 'BITCOIN_TESTNET')
   */
  getChain(): Promise<{ enum: string; name: string }>

  /**
   * Get inscription info for an inscriptionId
   */
  getInscriptions?(offset?: number, limit?: number): Promise<{
    total: number
    list: Array<{
      inscriptionId: string
      inscriptionNumber: number
      address: string
      outputValue: number
      content: string
      contentType: string
    }>
  }>
}

/**
 * Global window interface for Unisat
 */
declare global {
  interface Window {
    unisat?: UnisatAPI
  }
}

/**
 * Get Bitcoin wallet provider from window
 */
export function getBitcoinProvider(wallet: BitcoinWalletName): UnisatAPI | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  switch (wallet) {
    case 'unisat':
      return window.unisat
    case 'okx':
      // OKX wallet has bitcoin namespace
      return (window as any).okxwallet?.bitcoin
    case 'xverse':
    case 'leather':
      // TODO: Add Xverse and Leather support
      return undefined
    default:
      return undefined
  }
}

/**
 * Detect available Bitcoin wallets
 */
export function detectBitcoinWallets(): BitcoinWalletName[] {
  const wallets: BitcoinWalletName[] = []

  if (typeof window === 'undefined') {
    return wallets
  }

  if (window.unisat) {
    wallets.push('unisat')
  }

  if ((window as any).okxwallet?.bitcoin) {
    wallets.push('okx')
  }

  // TODO: Add detection for Xverse and Leather
  // if ((window as any).XverseProviders?.BitcoinProvider) {
  //   wallets.push('xverse')
  // }
  //
  // if ((window as any).LeatherProvider) {
  //   wallets.push('leather')
  // }

  return wallets
}

/**
 * Convert Bitcoin address to hex format
 * For Taproot (P2TR), this extracts the 32-byte x-only pubkey from the address
 */
export function bitcoinAddressToHex(address: string): HexString {
  // For now, return the address as-is with 0x prefix
  // Full implementation would decode bech32m and extract the witness program
  return `0x${address}` as HexString
}

/**
 * Convert Bitcoin public key to SIP hex format
 * Handles both compressed (33 bytes) and x-only (32 bytes) public keys
 */
export function bitcoinPublicKeyToHex(pubkey: string): HexString {
  // Remove 0x prefix if present
  const cleanPubkey = pubkey.startsWith('0x') ? pubkey.slice(2) : pubkey

  // Validate length
  if (cleanPubkey.length !== 64 && cleanPubkey.length !== 66) {
    throw new Error(`Invalid Bitcoin public key length: ${cleanPubkey.length} (expected 64 or 66 hex chars)`)
  }

  return `0x${cleanPubkey}` as HexString
}

/**
 * Validate Taproot address format
 */
export function isValidTaprootAddress(address: string, network: BitcoinNetwork = 'livenet'): boolean {
  // Basic validation - full implementation would use bech32m decoder
  if (network === 'livenet') {
    return address.startsWith('bc1p') && address.length >= 62
  } else {
    return address.startsWith('tb1p') && address.length >= 62
  }
}
