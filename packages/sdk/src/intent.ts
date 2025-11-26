/**
 * ShieldedIntent class for SIP Protocol
 *
 * Main interface for creating and managing shielded intents.
 */

import {
  SIP_VERSION,
  IntentStatus,
  type ShieldedIntent,
  type CreateIntentParams,
  type TrackedIntent,
  type Quote,
  type FulfillmentResult,
  type StealthMetaAddress,
  type Commitment,
  type HexString,
  type PrivacyLevel,
} from '@sip-protocol/types'
import { generateStealthAddress, decodeStealthMetaAddress } from './stealth'
import {
  createCommitment,
  generateIntentId,
  hash,
} from './crypto'
import { getPrivacyConfig, generateViewingKey } from './privacy'

/**
 * Builder class for creating shielded intents
 */
export class IntentBuilder {
  private params: Partial<CreateIntentParams> = {}
  private senderAddress?: string

  /**
   * Set the input for the intent
   */
  input(
    chain: string,
    token: string,
    amount: number | bigint,
    sourceAddress?: string,
  ): this {
    this.params.input = {
      asset: {
        chain: chain as any,
        symbol: token,
        address: null,
        decimals: 18, // Default, should be looked up
      },
      amount: typeof amount === 'number' ? BigInt(Math.floor(amount * 1e18)) : amount,
      sourceAddress,
    }
    this.senderAddress = sourceAddress
    return this
  }

  /**
   * Set the output for the intent
   */
  output(chain: string, token: string, minAmount?: number | bigint): this {
    this.params.output = {
      asset: {
        chain: chain as any,
        symbol: token,
        address: null,
        decimals: 18,
      },
      minAmount: minAmount
        ? typeof minAmount === 'number'
          ? BigInt(Math.floor(minAmount * 1e18))
          : minAmount
        : 0n,
      maxSlippage: 0.01, // 1% default
    }
    return this
  }

  /**
   * Set the privacy level
   */
  privacy(level: PrivacyLevel): this {
    this.params.privacy = level
    return this
  }

  /**
   * Set the recipient's stealth meta-address
   */
  recipient(metaAddress: string): this {
    this.params.recipientMetaAddress = metaAddress
    return this
  }

  /**
   * Set slippage tolerance
   */
  slippage(percent: number): this {
    if (this.params.output) {
      this.params.output.maxSlippage = percent / 100
    }
    return this
  }

  /**
   * Set time-to-live in seconds
   */
  ttl(seconds: number): this {
    this.params.ttl = seconds
    return this
  }

  /**
   * Build the shielded intent
   */
  build(): ShieldedIntent {
    return createShieldedIntent(this.params as CreateIntentParams, this.senderAddress)
  }
}

/**
 * Create a new shielded intent
 */
export function createShieldedIntent(
  params: CreateIntentParams,
  senderAddress?: string,
): ShieldedIntent {
  const { input, output, privacy, recipientMetaAddress, viewingKey, ttl = 300 } = params

  // Validate required fields
  if (!input || !output || !privacy) {
    throw new Error('Missing required parameters: input, output, privacy')
  }

  // Get privacy configuration
  const privacyConfig = getPrivacyConfig(
    privacy,
    viewingKey ? { key: viewingKey, path: 'm/0', hash: hash(viewingKey) } : undefined,
  )

  // Generate intent ID
  const intentId = generateIntentId()

  // Create commitments for private fields
  const inputCommitment = createCommitment(input.amount)
  const senderCommitment = createCommitment(
    BigInt(senderAddress ? hash(senderAddress).slice(2, 18) : '0'),
  )

  // Generate stealth address for recipient (if shielded)
  let recipientStealth
  if (privacyConfig.useStealth && recipientMetaAddress) {
    const metaAddress = decodeStealthMetaAddress(recipientMetaAddress)
    const { stealthAddress } = generateStealthAddress(metaAddress)
    recipientStealth = stealthAddress
  } else {
    // For transparent mode, create a placeholder
    recipientStealth = {
      address: '0x0' as HexString,
      ephemeralPublicKey: '0x0' as HexString,
      viewTag: 0,
    }
  }

  const now = Math.floor(Date.now() / 1000)

  // Note: Proofs are NOT generated here - they require real ZK circuits
  // For TRANSPARENT mode: proofs are not required
  // For SHIELDED/COMPLIANT: proofs must be added via attachProofs() when available
  // See #14, #15, #16 for proof implementation

  return {
    intentId,
    version: SIP_VERSION,
    privacyLevel: privacy,
    createdAt: now,
    expiry: now + ttl,

    outputAsset: output.asset,
    minOutputAmount: output.minAmount,
    maxSlippage: output.maxSlippage,

    inputCommitment,
    senderCommitment,
    recipientStealth,

    // Proofs are undefined until real ZK implementation is available
    // TRANSPARENT mode: proofs not required
    // SHIELDED/COMPLIANT mode: proofs must be attached before submission
    fundingProof: undefined as any,
    validityProof: undefined as any,

    viewingKeyHash: privacyConfig.viewingKey?.hash,
  }
}

/**
 * Attach proofs to a shielded intent
 *
 * For SHIELDED and COMPLIANT modes, proofs are required before the intent
 * can be submitted. This function attaches the proofs to an intent.
 *
 * @param intent - The intent to attach proofs to
 * @param fundingProof - The funding proof (balance >= minimum)
 * @param validityProof - The validity proof (authorization)
 * @returns The intent with proofs attached
 */
export function attachProofs(
  intent: ShieldedIntent,
  fundingProof: import('@sip-protocol/types').ZKProof,
  validityProof: import('@sip-protocol/types').ZKProof,
): ShieldedIntent {
  return {
    ...intent,
    fundingProof,
    validityProof,
  }
}

/**
 * Check if an intent has all required proofs
 */
export function hasRequiredProofs(intent: ShieldedIntent): boolean {
  // TRANSPARENT mode doesn't require proofs
  if (intent.privacyLevel === 'transparent') {
    return true
  }

  // SHIELDED and COMPLIANT modes require both proofs
  return !!(intent.fundingProof && intent.validityProof)
}

/**
 * Wrap a shielded intent with status tracking
 */
export function trackIntent(intent: ShieldedIntent): TrackedIntent {
  return {
    ...intent,
    status: IntentStatus.PENDING,
    quotes: [],
  }
}

/**
 * Check if an intent has expired
 */
export function isExpired(intent: ShieldedIntent): boolean {
  return Math.floor(Date.now() / 1000) > intent.expiry
}

/**
 * Get time remaining until intent expires (in seconds)
 */
export function getTimeRemaining(intent: ShieldedIntent): number {
  const remaining = intent.expiry - Math.floor(Date.now() / 1000)
  return Math.max(0, remaining)
}

/**
 * Serialize a shielded intent to JSON
 */
export function serializeIntent(intent: ShieldedIntent): string {
  return JSON.stringify(intent, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  )
}

/**
 * Deserialize a shielded intent from JSON
 */
export function deserializeIntent(json: string): ShieldedIntent {
  return JSON.parse(json, (key, value) => {
    // Convert string numbers back to bigint for known fields
    if (
      typeof value === 'string' &&
      /^\d+$/.test(value) &&
      ['minOutputAmount', 'amount'].includes(key)
    ) {
      return BigInt(value)
    }
    return value
  })
}

/**
 * Get a human-readable summary of the intent
 */
export function getIntentSummary(intent: ShieldedIntent): string {
  const privacy = intent.privacyLevel.toUpperCase()
  const output = intent.outputAsset.symbol
  const expiry = new Date(intent.expiry * 1000).toISOString()

  return `[${privacy}] Intent ${intent.intentId.slice(0, 16)}... → ${output} (expires: ${expiry})`
}
