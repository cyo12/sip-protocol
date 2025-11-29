/**
 * DAO Treasury types for SIP Protocol
 *
 * Defines types for private treasury management, multi-sig operations,
 * and batch payments for DAOs.
 */

import type { ChainId } from './stealth'
import type { HexString, Hash, ViewingKey } from './crypto'
import type { Asset } from './asset'
import type { PrivacyLevel } from './privacy'
import type { ShieldedPayment, PaymentPurpose } from './payment'

/**
 * Treasury member role
 */
export type TreasuryRole = 'owner' | 'admin' | 'signer' | 'viewer'

/**
 * Proposal status
 */
export const ProposalStatus = {
  /** Proposal created, awaiting signatures */
  PENDING: 'pending',
  /** Has enough signatures, ready to execute */
  APPROVED: 'approved',
  /** Successfully executed */
  EXECUTED: 'executed',
  /** Rejected by signers */
  REJECTED: 'rejected',
  /** Expired before execution */
  EXPIRED: 'expired',
  /** Cancelled by proposer */
  CANCELLED: 'cancelled',
} as const

export type ProposalStatusType = typeof ProposalStatus[keyof typeof ProposalStatus]

/**
 * Proposal type
 */
export type ProposalType =
  | 'payment'           // Single payment
  | 'batch_payment'     // Multiple payments
  | 'config_change'     // Treasury configuration change
  | 'member_add'        // Add new member
  | 'member_remove'     // Remove member
  | 'threshold_change'  // Change signing threshold

/**
 * Treasury member
 */
export interface TreasuryMember {
  /** Member's address */
  address: string
  /** Member's public key for signing */
  publicKey: HexString
  /** Role in the treasury */
  role: TreasuryRole
  /** Display name */
  name?: string
  /** When the member was added */
  addedAt: number
  /** Who added this member */
  addedBy?: string
}

/**
 * Treasury configuration
 */
export interface TreasuryConfig {
  /** Unique treasury identifier */
  treasuryId: string
  /** Human-readable name */
  name: string
  /** Description */
  description?: string
  /** Primary chain for the treasury */
  chain: ChainId
  /** Number of signatures required for spending */
  signingThreshold: number
  /** Total number of signers */
  totalSigners: number
  /** List of treasury members */
  members: TreasuryMember[]
  /** Default privacy level for transactions */
  defaultPrivacy: PrivacyLevel
  /** Master viewing key for the treasury */
  masterViewingKey?: ViewingKey
  /** Daily spending limit (in USD equivalent) */
  dailyLimit?: bigint
  /** Per-transaction limit */
  transactionLimit?: bigint
  /** Creation timestamp */
  createdAt: number
  /** Last updated timestamp */
  updatedAt: number
}

/**
 * Payment recipient in a batch
 */
export interface BatchPaymentRecipient {
  /** Recipient's stealth meta-address or direct address */
  address: string
  /** Amount in token's smallest units */
  amount: bigint
  /** Optional memo/reference */
  memo?: string
  /** Payment purpose */
  purpose?: PaymentPurpose
}

/**
 * Batch payment request
 */
export interface BatchPaymentRequest {
  /** Token to transfer */
  token: Asset
  /** List of recipients */
  recipients: BatchPaymentRecipient[]
  /** Total amount (sum of all recipients) */
  totalAmount: bigint
  /** Privacy level for all payments */
  privacy: PrivacyLevel
  /** Viewing key for compliant mode */
  viewingKey?: HexString
}

/**
 * Signature on a proposal
 */
export interface ProposalSignature {
  /** Signer's address */
  signer: string
  /** The signature */
  signature: HexString
  /** Timestamp of signing */
  signedAt: number
  /** Whether this is an approval or rejection */
  approved: boolean
}

/**
 * Treasury proposal - a pending action requiring multi-sig approval
 */
export interface TreasuryProposal {
  /** Unique proposal identifier */
  proposalId: string
  /** Treasury this proposal belongs to */
  treasuryId: string
  /** Type of proposal */
  type: ProposalType
  /** Current status */
  status: ProposalStatusType
  /** Who created the proposal */
  proposer: string
  /** Title/summary */
  title: string
  /** Detailed description */
  description?: string
  /** Creation timestamp */
  createdAt: number
  /** Expiration timestamp */
  expiresAt: number
  /** Required signatures */
  requiredSignatures: number
  /** Collected signatures */
  signatures: ProposalSignature[]

  // ─── Payment Data (for payment proposals) ─────────────────────────────────────

  /** Single payment data */
  payment?: {
    recipient: string
    token: Asset
    amount: bigint
    memo?: string
    purpose?: PaymentPurpose
    privacy: PrivacyLevel
  }

  /** Batch payment data */
  batchPayment?: BatchPaymentRequest

  // ─── Config Change Data ────────────────────────────────────────────────────────

  /** Configuration changes */
  configChange?: {
    field: keyof TreasuryConfig
    oldValue: unknown
    newValue: unknown
  }

  /** Member to add/remove */
  memberChange?: {
    action: 'add' | 'remove'
    member: TreasuryMember
  }

  // ─── Execution Data ────────────────────────────────────────────────────────────

  /** Execution timestamp */
  executedAt?: number
  /** Transaction hash(es) from execution */
  transactionHashes?: string[]
  /** Resulting payments (for payment proposals) */
  resultPayments?: ShieldedPayment[]
}

/**
 * Treasury balance for a specific token
 */
export interface TreasuryBalance {
  /** The token */
  token: Asset
  /** Balance in smallest units */
  balance: bigint
  /** Committed (in pending proposals) */
  committed: bigint
  /** Available (balance - committed) */
  available: bigint
  /** Last updated timestamp */
  updatedAt: number
}

/**
 * Treasury transaction record
 */
export interface TreasuryTransaction {
  /** Transaction ID */
  transactionId: string
  /** Treasury ID */
  treasuryId: string
  /** Related proposal ID */
  proposalId?: string
  /** Type: inbound or outbound */
  direction: 'inbound' | 'outbound'
  /** Token */
  token: Asset
  /** Amount */
  amount: bigint
  /** Counterparty address */
  counterparty: string
  /** Transaction hash */
  txHash: string
  /** Block number */
  blockNumber: number
  /** Timestamp */
  timestamp: number
  /** Privacy level used */
  privacy: PrivacyLevel
  /** Memo/reference */
  memo?: string
}

/**
 * Parameters for creating a treasury
 */
export interface CreateTreasuryParams {
  /** Treasury name */
  name: string
  /** Description */
  description?: string
  /** Primary chain */
  chain: ChainId
  /** Initial members (must include at least one owner) */
  members: Omit<TreasuryMember, 'addedAt' | 'addedBy'>[]
  /** Signing threshold */
  signingThreshold: number
  /** Default privacy level */
  defaultPrivacy?: PrivacyLevel
  /** Daily spending limit */
  dailyLimit?: bigint
  /** Per-transaction limit */
  transactionLimit?: bigint
}

/**
 * Parameters for creating a payment proposal
 */
export interface CreatePaymentProposalParams {
  /** Treasury ID */
  treasuryId: string
  /** Proposal title */
  title: string
  /** Description */
  description?: string
  /** Recipient address or stealth meta-address */
  recipient: string
  /** Token to send */
  token: Asset
  /** Amount */
  amount: bigint
  /** Memo */
  memo?: string
  /** Purpose */
  purpose?: PaymentPurpose
  /** Privacy level */
  privacy?: PrivacyLevel
  /** Expiration (seconds from now, default: 7 days) */
  ttl?: number
}

/**
 * Parameters for creating a batch payment proposal
 */
export interface CreateBatchProposalParams {
  /** Treasury ID */
  treasuryId: string
  /** Proposal title */
  title: string
  /** Description */
  description?: string
  /** Token to send */
  token: Asset
  /** Recipients */
  recipients: BatchPaymentRecipient[]
  /** Privacy level */
  privacy?: PrivacyLevel
  /** Expiration (seconds from now, default: 7 days) */
  ttl?: number
}

/**
 * Auditor viewing key - derived from treasury master key
 */
export interface AuditorViewingKey {
  /** Auditor identifier */
  auditorId: string
  /** Auditor name */
  name: string
  /** The derived viewing key */
  viewingKey: ViewingKey
  /** Scope of access */
  scope: 'all' | 'inbound' | 'outbound'
  /** Start date for access */
  validFrom: number
  /** End date for access (optional) */
  validUntil?: number
  /** Who granted this key */
  grantedBy: string
  /** When granted */
  grantedAt: number
}
