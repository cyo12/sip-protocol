/**
 * Payment types for SIP Protocol
 *
 * Defines types for private stablecoin transfers and P2P payments.
 */

import type { ChainId } from './stealth'
import type { HexString, Hash, Commitment, ViewingKey, ZKProof } from './crypto'
import type { Asset } from './asset'
import type { PrivacyLevel } from './privacy'

/**
 * Supported stablecoin symbols
 */
export type StablecoinSymbol = 'USDC' | 'USDT' | 'DAI' | 'BUSD' | 'FRAX' | 'LUSD' | 'PYUSD'

/**
 * Payment purpose for compliance categorization
 */
export type PaymentPurpose =
  | 'personal'      // P2P personal transfer
  | 'salary'        // Salary/payroll payment
  | 'invoice'       // B2B invoice payment
  | 'donation'      // Charitable donation
  | 'refund'        // Refund/return
  | 'other'         // Other purpose

/**
 * Payment status
 */
export const PaymentStatus = {
  /** Payment created but not submitted */
  DRAFT: 'draft',
  /** Payment submitted, awaiting confirmation */
  PENDING: 'pending',
  /** Payment confirmed on source chain */
  CONFIRMED: 'confirmed',
  /** Payment settled on destination chain */
  SETTLED: 'settled',
  /** Payment failed */
  FAILED: 'failed',
  /** Payment expired */
  EXPIRED: 'expired',
  /** Payment cancelled */
  CANCELLED: 'cancelled',
} as const

export type PaymentStatusType = typeof PaymentStatus[keyof typeof PaymentStatus]

/**
 * Shielded payment - a privacy-preserving stablecoin transfer
 *
 * Unlike ShieldedIntent which is for cross-chain swaps, ShieldedPayment
 * is specifically for same-token transfers (e.g., USDC to USDC).
 */
export interface ShieldedPayment {
  /** Unique payment identifier */
  paymentId: string
  /** SIP version */
  version: string
  /** Privacy level for this payment */
  privacyLevel: PrivacyLevel
  /** Creation timestamp (Unix seconds) */
  createdAt: number
  /** Expiration timestamp (Unix seconds) */
  expiry: number

  // ─── Token ─────────────────────────────────────────────────────────────────────

  /** The token being transferred */
  token: Asset
  /** Amount in smallest units (hidden via commitment in shielded mode) */
  amount: bigint

  // ─── Privacy Commitments ───────────────────────────────────────────────────────

  /** Pedersen commitment to amount (for shielded mode) */
  amountCommitment?: Commitment
  /** Pedersen commitment to sender (for shielded mode) */
  senderCommitment?: Commitment

  // ─── Recipient ─────────────────────────────────────────────────────────────────

  /** Recipient stealth address (for shielded mode) */
  recipientStealth?: {
    address: HexString
    ephemeralPublicKey: HexString
    viewTag: number
  }
  /** Direct recipient address (for transparent mode) */
  recipientAddress?: string

  // ─── Source ────────────────────────────────────────────────────────────────────

  /** Source chain */
  sourceChain: ChainId
  /** Destination chain (can be same as source for same-chain transfers) */
  destinationChain: ChainId

  // ─── Metadata ──────────────────────────────────────────────────────────────────

  /** Payment purpose (for compliance) */
  purpose?: PaymentPurpose
  /** Optional memo/reference (encrypted in shielded mode) */
  memo?: string
  /** Encrypted memo (for shielded mode with viewing key) */
  encryptedMemo?: HexString

  // ─── Proofs ────────────────────────────────────────────────────────────────────

  /** Funding proof (balance >= amount) */
  fundingProof?: ZKProof
  /** Authorization proof */
  authorizationProof?: ZKProof

  // ─── Compliance ────────────────────────────────────────────────────────────────

  /** Viewing key hash (for compliant mode) */
  viewingKeyHash?: Hash
}

/**
 * Parameters for creating a shielded payment
 */
export interface CreatePaymentParams {
  /** Token to transfer */
  token: Asset | StablecoinSymbol
  /** Amount in token's smallest units */
  amount: bigint
  /** Recipient's stealth meta-address (for privacy modes) */
  recipientMetaAddress?: string
  /** Direct recipient address (for transparent mode) */
  recipientAddress?: string
  /** Privacy level */
  privacy: PrivacyLevel
  /** Viewing key (required for compliant mode) */
  viewingKey?: HexString
  /** Source chain */
  sourceChain: ChainId
  /** Destination chain (defaults to sourceChain) */
  destinationChain?: ChainId
  /** Payment purpose */
  purpose?: PaymentPurpose
  /** Optional memo/reference */
  memo?: string
  /** Time to live in seconds (default: 3600 = 1 hour) */
  ttl?: number
}

/**
 * Payment receipt - returned after successful payment
 */
export interface PaymentReceipt {
  /** Payment ID */
  paymentId: string
  /** Transaction hash on source chain */
  sourceTxHash: string
  /** Transaction hash on destination chain (if cross-chain) */
  destinationTxHash?: string
  /** Block number on source chain */
  sourceBlock: number
  /** Block number on destination chain */
  destinationBlock?: number
  /** Actual amount transferred */
  amount: bigint
  /** Fees paid */
  fees: {
    /** Network/gas fees */
    network: bigint
    /** Protocol fees (if any) */
    protocol: bigint
  }
  /** Timestamp of confirmation */
  confirmedAt: number
  /** Recipient address (stealth or direct) */
  recipientAddress: string
}

/**
 * Payment tracking info
 */
export interface TrackedPayment extends ShieldedPayment {
  /** Current status */
  status: PaymentStatusType
  /** Source transaction hash (once submitted) */
  sourceTxHash?: string
  /** Destination transaction hash (once settled) */
  destinationTxHash?: string
  /** Error message (if failed) */
  error?: string
}
