/**
 * Shielded Payments for SIP Protocol
 *
 * Provides privacy-preserving stablecoin transfers using stealth addresses
 * and Pedersen commitments. Optimized for P2P payments with lower latency
 * than cross-chain swaps.
 *
 * @example
 * ```typescript
 * // Create a shielded USDC payment
 * const payment = await new PaymentBuilder()
 *   .token('USDC', 'ethereum')
 *   .amount(100n * 10n ** 6n) // 100 USDC
 *   .recipient(recipientMetaAddress)
 *   .privacy('shielded')
 *   .memo('Payment for services')
 *   .build()
 * ```
 */

import {
  SIP_VERSION,
  PrivacyLevel,
  PaymentStatus,
  type ShieldedPayment,
  type CreatePaymentParams,
  type TrackedPayment,
  type Asset,
  type ChainId,
  type StablecoinSymbol,
  type HexString,
  type Hash,
  type PaymentPurpose,
} from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { hkdf } from '@noble/hashes/hkdf'

import { generateStealthAddress, decodeStealthMetaAddress } from '../stealth'
import { createCommitment, generateIntentId, hash } from '../crypto'
import { getPrivacyConfig } from '../privacy'
import { ValidationError, ErrorCode } from '../errors'
import { isValidChainId, isValidPrivacyLevel, isValidStealthMetaAddress } from '../validation'
import { secureWipe } from '../secure-memory'
import { getStablecoin, isStablecoin, STABLECOIN_DECIMALS } from './stablecoins'
import type { ProofProvider } from '../proofs'

/**
 * Options for creating a shielded payment
 */
export interface CreatePaymentOptions {
  /** Sender address (for ownership proof) */
  senderAddress?: string
  /** Proof provider for generating ZK proofs */
  proofProvider?: ProofProvider
}

/**
 * Builder class for creating shielded payments
 *
 * Provides a fluent interface for constructing privacy-preserving payments.
 */
export class PaymentBuilder {
  private _token?: Asset
  private _amount?: bigint
  private _recipientMetaAddress?: string
  private _recipientAddress?: string
  private _privacy: PrivacyLevel = PrivacyLevel.SHIELDED
  private _viewingKey?: HexString
  private _sourceChain?: ChainId
  private _destinationChain?: ChainId
  private _purpose?: PaymentPurpose
  private _memo?: string
  private _ttl: number = 3600 // 1 hour default
  private _senderAddress?: string
  private _proofProvider?: ProofProvider

  /**
   * Set the token to transfer
   *
   * @param tokenOrSymbol - Asset object or stablecoin symbol
   * @param chain - Chain ID (required if using symbol)
   */
  token(tokenOrSymbol: Asset | StablecoinSymbol, chain?: ChainId): this {
    if (typeof tokenOrSymbol === 'string') {
      // It's a stablecoin symbol
      if (!chain) {
        throw new ValidationError(
          'chain is required when using stablecoin symbol',
          'chain',
          undefined,
          ErrorCode.MISSING_REQUIRED
        )
      }
      if (!isStablecoin(tokenOrSymbol)) {
        throw new ValidationError(
          `unknown stablecoin: ${tokenOrSymbol}`,
          'token',
          { received: tokenOrSymbol },
          ErrorCode.INVALID_INPUT
        )
      }
      const asset = getStablecoin(tokenOrSymbol, chain)
      if (!asset) {
        throw new ValidationError(
          `${tokenOrSymbol} is not available on ${chain}`,
          'token',
          { symbol: tokenOrSymbol, chain },
          ErrorCode.INVALID_INPUT
        )
      }
      this._token = asset
      this._sourceChain = chain
    } else {
      // It's an Asset object
      this._token = tokenOrSymbol
      this._sourceChain = tokenOrSymbol.chain
    }
    return this
  }

  /**
   * Set the amount to transfer (in smallest units)
   *
   * @param amount - Amount in token's smallest units
   */
  amount(amount: bigint): this {
    if (amount <= 0n) {
      throw new ValidationError(
        'amount must be positive',
        'amount',
        { received: amount.toString() },
        ErrorCode.INVALID_INPUT
      )
    }
    this._amount = amount
    return this
  }

  /**
   * Set the amount in human-readable format
   *
   * @param amount - Human-readable amount (e.g., 100.50)
   */
  amountHuman(amount: number): this {
    if (!this._token) {
      throw new ValidationError(
        'token must be set before amountHuman',
        'token',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }
    const decimals = this._token.decimals
    this._amount = BigInt(Math.floor(amount * (10 ** decimals)))
    return this
  }

  /**
   * Set the recipient's stealth meta-address (for privacy modes)
   */
  recipient(metaAddress: string): this {
    if (!isValidStealthMetaAddress(metaAddress)) {
      throw new ValidationError(
        'invalid stealth meta-address format',
        'recipientMetaAddress',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }
    this._recipientMetaAddress = metaAddress
    this._recipientAddress = undefined // Clear direct address
    return this
  }

  /**
   * Set the recipient's direct address (for transparent mode)
   */
  recipientDirect(address: string): this {
    if (!address || address.trim().length === 0) {
      throw new ValidationError(
        'address must be a non-empty string',
        'recipientAddress',
        undefined,
        ErrorCode.INVALID_INPUT
      )
    }
    this._recipientAddress = address
    this._recipientMetaAddress = undefined // Clear stealth address
    return this
  }

  /**
   * Set the privacy level
   */
  privacy(level: PrivacyLevel): this {
    if (!isValidPrivacyLevel(level)) {
      throw new ValidationError(
        `invalid privacy level: ${level}`,
        'privacy',
        { received: level },
        ErrorCode.INVALID_PRIVACY_LEVEL
      )
    }
    this._privacy = level
    return this
  }

  /**
   * Set the viewing key (required for compliant mode)
   */
  viewingKey(key: HexString): this {
    this._viewingKey = key
    return this
  }

  /**
   * Set the destination chain (for cross-chain payments)
   */
  destinationChain(chain: ChainId): this {
    if (!isValidChainId(chain)) {
      throw new ValidationError(
        `invalid chain: ${chain}`,
        'destinationChain',
        { received: chain },
        ErrorCode.INVALID_INPUT
      )
    }
    this._destinationChain = chain
    return this
  }

  /**
   * Set the payment purpose
   */
  purpose(purpose: PaymentPurpose): this {
    this._purpose = purpose
    return this
  }

  /**
   * Set an optional memo/reference
   */
  memo(memo: string): this {
    if (memo.length > 256) {
      throw new ValidationError(
        'memo must be 256 characters or less',
        'memo',
        { received: memo.length },
        ErrorCode.INVALID_INPUT
      )
    }
    this._memo = memo
    return this
  }

  /**
   * Set time-to-live in seconds
   */
  ttl(seconds: number): this {
    if (seconds <= 0 || !Number.isInteger(seconds)) {
      throw new ValidationError(
        'ttl must be a positive integer',
        'ttl',
        { received: seconds },
        ErrorCode.INVALID_INPUT
      )
    }
    this._ttl = seconds
    return this
  }

  /**
   * Set the sender address
   */
  sender(address: string): this {
    this._senderAddress = address
    return this
  }

  /**
   * Set the proof provider
   */
  withProvider(provider: ProofProvider): this {
    this._proofProvider = provider
    return this
  }

  /**
   * Build the shielded payment
   */
  async build(): Promise<ShieldedPayment> {
    // Validate required fields
    if (!this._token) {
      throw new ValidationError(
        'token is required',
        'token',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }
    if (this._amount === undefined) {
      throw new ValidationError(
        'amount is required',
        'amount',
        undefined,
        ErrorCode.MISSING_REQUIRED
      )
    }

    // Build params
    const params: CreatePaymentParams = {
      token: this._token,
      amount: this._amount,
      recipientMetaAddress: this._recipientMetaAddress,
      recipientAddress: this._recipientAddress,
      privacy: this._privacy,
      viewingKey: this._viewingKey,
      sourceChain: this._sourceChain!,
      destinationChain: this._destinationChain,
      purpose: this._purpose,
      memo: this._memo,
      ttl: this._ttl,
    }

    return createShieldedPayment(params, {
      senderAddress: this._senderAddress,
      proofProvider: this._proofProvider,
    })
  }
}

/**
 * Create a shielded payment
 *
 * @param params - Payment creation parameters
 * @param options - Optional configuration
 * @returns Promise resolving to the shielded payment
 */
export async function createShieldedPayment(
  params: CreatePaymentParams,
  options?: CreatePaymentOptions,
): Promise<ShieldedPayment> {
  const {
    token,
    amount,
    recipientMetaAddress,
    recipientAddress,
    privacy,
    viewingKey,
    sourceChain,
    destinationChain,
    purpose,
    memo,
    ttl = 3600,
  } = params

  const { senderAddress, proofProvider } = options ?? {}

  // Resolve token if it's a symbol
  let resolvedToken: Asset
  if (typeof token === 'string') {
    if (!isStablecoin(token)) {
      throw new ValidationError(
        `unknown stablecoin: ${token}`,
        'token',
        { received: token },
        ErrorCode.INVALID_INPUT
      )
    }
    const asset = getStablecoin(token, sourceChain)
    if (!asset) {
      throw new ValidationError(
        `${token} is not available on ${sourceChain}`,
        'token',
        { symbol: token, chain: sourceChain },
        ErrorCode.INVALID_INPUT
      )
    }
    resolvedToken = asset
  } else {
    resolvedToken = token
  }

  // Validate privacy requirements
  if (privacy !== PrivacyLevel.TRANSPARENT && !recipientMetaAddress) {
    throw new ValidationError(
      'recipientMetaAddress is required for shielded/compliant privacy modes',
      'recipientMetaAddress',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
  if (privacy === PrivacyLevel.TRANSPARENT && !recipientAddress) {
    throw new ValidationError(
      'recipientAddress is required for transparent mode',
      'recipientAddress',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }
  if (privacy === PrivacyLevel.COMPLIANT && !viewingKey) {
    throw new ValidationError(
      'viewingKey is required for compliant mode',
      'viewingKey',
      undefined,
      ErrorCode.MISSING_REQUIRED
    )
  }

  // Generate payment ID
  const paymentId = generateIntentId()

  // Calculate viewing key hash
  let viewingKeyHash: Hash | undefined
  if (viewingKey) {
    const keyHex = viewingKey.startsWith('0x') ? viewingKey.slice(2) : viewingKey
    const keyBytes = hexToBytes(keyHex)
    viewingKeyHash = `0x${bytesToHex(sha256(keyBytes))}` as Hash
  }

  // Get privacy config
  const privacyConfig = getPrivacyConfig(
    privacy,
    viewingKey ? { key: viewingKey, path: 'm/0', hash: viewingKeyHash! } : undefined,
  )

  const now = Math.floor(Date.now() / 1000)

  // Create the base payment object
  const payment: ShieldedPayment = {
    paymentId,
    version: SIP_VERSION,
    privacyLevel: privacy,
    createdAt: now,
    expiry: now + ttl,
    token: resolvedToken,
    amount,
    sourceChain,
    destinationChain: destinationChain ?? sourceChain,
    purpose,
    viewingKeyHash,
  }

  // Handle privacy-specific fields
  if (privacy !== PrivacyLevel.TRANSPARENT && recipientMetaAddress) {
    // Generate stealth address
    const metaAddress = decodeStealthMetaAddress(recipientMetaAddress)
    const { stealthAddress } = generateStealthAddress(metaAddress)
    payment.recipientStealth = stealthAddress

    // Create commitments
    payment.amountCommitment = createCommitment(amount)
    payment.senderCommitment = createCommitment(
      BigInt(senderAddress ? hash(senderAddress).slice(2, 18) : '0')
    )

    // Encrypt memo if provided
    if (memo && viewingKey) {
      payment.encryptedMemo = encryptMemo(memo, viewingKey)
    } else {
      payment.memo = memo
    }
  } else {
    // Transparent mode
    payment.recipientAddress = recipientAddress
    payment.memo = memo
  }

  // Generate proofs if provider available
  if (privacy !== PrivacyLevel.TRANSPARENT && proofProvider?.isReady) {
    const hexToUint8 = (hex: HexString): Uint8Array => {
      const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
      return hexToBytes(cleanHex)
    }

    // Generate funding proof
    const fundingResult = await proofProvider.generateFundingProof({
      balance: amount,
      minimumRequired: amount,
      blindingFactor: hexToUint8(payment.amountCommitment!.blindingFactor as HexString),
      assetId: resolvedToken.symbol,
      userAddress: senderAddress ?? '0x0',
      ownershipSignature: new Uint8Array(64),
    })
    payment.fundingProof = fundingResult.proof

    // Generate validity proof (as authorization)
    const validityResult = await proofProvider.generateValidityProof({
      intentHash: hash(paymentId) as HexString,
      senderAddress: senderAddress ?? '0x0',
      senderBlinding: hexToUint8(payment.senderCommitment!.blindingFactor as HexString),
      senderSecret: new Uint8Array(32),
      authorizationSignature: new Uint8Array(64),
      nonce: new Uint8Array(32),
      timestamp: now,
      expiry: now + ttl,
    })
    payment.authorizationProof = validityResult.proof
  }

  return payment
}

/**
 * Encrypt a memo using the viewing key
 */
function encryptMemo(memo: string, viewingKey: HexString): HexString {
  const keyHex = viewingKey.startsWith('0x') ? viewingKey.slice(2) : viewingKey
  const keyBytes = hexToBytes(keyHex)

  // Derive encryption key using HKDF
  const encKey = hkdf(sha256, keyBytes, new Uint8Array(0), new Uint8Array(0), 32)

  try {
    // Generate nonce
    const nonce = randomBytes(24)

    // Encrypt
    const cipher = xchacha20poly1305(encKey, nonce)
    const plaintext = new TextEncoder().encode(memo)
    const ciphertext = cipher.encrypt(plaintext)

    // Concatenate nonce + ciphertext
    const result = new Uint8Array(nonce.length + ciphertext.length)
    result.set(nonce)
    result.set(ciphertext, nonce.length)

    return `0x${bytesToHex(result)}` as HexString
  } finally {
    secureWipe(keyBytes)
    secureWipe(encKey)
  }
}

/**
 * Decrypt a memo using the viewing key
 */
export function decryptMemo(encryptedMemo: HexString, viewingKey: HexString): string {
  const keyHex = viewingKey.startsWith('0x') ? viewingKey.slice(2) : viewingKey
  const keyBytes = hexToBytes(keyHex)

  // Derive encryption key using HKDF
  const encKey = hkdf(sha256, keyBytes, new Uint8Array(0), new Uint8Array(0), 32)

  try {
    // Parse encrypted data
    const dataHex = encryptedMemo.startsWith('0x') ? encryptedMemo.slice(2) : encryptedMemo
    const data = hexToBytes(dataHex)

    // Extract nonce and ciphertext
    const nonce = data.slice(0, 24)
    const ciphertext = data.slice(24)

    // Decrypt
    const cipher = xchacha20poly1305(encKey, nonce)
    const plaintext = cipher.decrypt(ciphertext)

    return new TextDecoder().decode(plaintext)
  } finally {
    secureWipe(keyBytes)
    secureWipe(encKey)
  }
}

/**
 * Track a payment's status
 */
export function trackPayment(payment: ShieldedPayment): TrackedPayment {
  return {
    ...payment,
    status: PaymentStatus.DRAFT,
  }
}

/**
 * Check if a payment has expired
 */
export function isPaymentExpired(payment: ShieldedPayment): boolean {
  return Math.floor(Date.now() / 1000) > payment.expiry
}

/**
 * Get time remaining until payment expires (in seconds)
 */
export function getPaymentTimeRemaining(payment: ShieldedPayment): number {
  const remaining = payment.expiry - Math.floor(Date.now() / 1000)
  return Math.max(0, remaining)
}

/**
 * Serialize a payment to JSON
 */
export function serializePayment(payment: ShieldedPayment): string {
  return JSON.stringify(payment, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  )
}

/**
 * Deserialize a payment from JSON
 */
export function deserializePayment(json: string): ShieldedPayment {
  return JSON.parse(json, (key, value) => {
    if (typeof value === 'string' && /^\d+$/.test(value) && key === 'amount') {
      return BigInt(value)
    }
    return value
  })
}

/**
 * Get a human-readable summary of the payment
 */
export function getPaymentSummary(payment: ShieldedPayment): string {
  const privacy = payment.privacyLevel.toUpperCase()
  const amount = Number(payment.amount) / (10 ** payment.token.decimals)
  const token = payment.token.symbol
  const expiry = new Date(payment.expiry * 1000).toISOString()

  return `[${privacy}] Payment ${payment.paymentId.slice(0, 12)}... ${amount} ${token} (expires: ${expiry})`
}
