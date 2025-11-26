/**
 * @sip-protocol/types
 *
 * TypeScript type definitions for Shielded Intents Protocol (SIP)
 */

// Privacy
export { PrivacyLevel, isPrivate, supportsViewingKey } from './privacy'

// Crypto primitives
export type {
  HexString,
  Hash,
  Commitment,
  ZKProof,
  ViewingKey,
  EncryptedTransaction,
  ViewingProof,
} from './crypto'

// Stealth addresses
export type {
  StealthMetaAddress,
  StealthAddress,
  StealthAddressRecovery,
  ChainId,
  StealthRegistryEntry,
} from './stealth'

// Assets
export type {
  Asset,
  AssetAmount,
  IntentInput,
  IntentOutput,
} from './asset'
export { NATIVE_TOKENS } from './asset'

// Intents
export { SIP_VERSION, IntentStatus } from './intent'
export type {
  ShieldedIntent,
  CreateIntentParams,
  Quote,
  FulfillmentResult,
  TrackedIntent,
} from './intent'

// Solver
export type {
  Solver,
  SIPSolver,
  FulfillmentRequest,
  FulfillmentCommitment,
} from './solver'
