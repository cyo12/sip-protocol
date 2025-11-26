/**
 * Solver interface types for SIP Protocol
 */

import type { ShieldedIntent, Quote, FulfillmentResult } from './intent'
import type { ZKProof, HexString } from './crypto'

/**
 * Solver information
 */
export interface Solver {
  /** Unique solver identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Supported chains */
  supportedChains: string[]
  /** Solver's reputation score (0-100) */
  reputation: number
  /** Total volume processed */
  totalVolume: bigint
  /** Success rate (0-1) */
  successRate: number
}

/**
 * SIP Solver interface - what solvers must implement
 */
export interface SIPSolver {
  /** Solver information */
  info: Solver

  /**
   * Check if solver can fulfill an intent and provide a quote
   * Solvers only see public fields of the intent
   */
  canFulfill(intent: ShieldedIntent): Promise<Quote | null>

  /**
   * Fulfill an intent with the given quote
   * Returns fulfillment proof for verification
   */
  fulfill(
    intent: ShieldedIntent,
    quote: Quote,
  ): Promise<FulfillmentResult>
}

/**
 * Request to fulfill an intent
 */
export interface FulfillmentRequest {
  /** The intent to fulfill */
  intent: ShieldedIntent
  /** The accepted quote */
  quote: Quote
  /** Solver's signature on the quote */
  solverSignature: HexString
}

/**
 * Solver's fulfillment commitment
 */
export interface FulfillmentCommitment {
  /** Quote being committed to */
  quoteId: string
  /** Solver's collateral (locked until fulfillment) */
  collateral: bigint
  /** Deadline for fulfillment */
  deadline: number
  /** Proof of collateral lock */
  collateralProof: ZKProof
}
