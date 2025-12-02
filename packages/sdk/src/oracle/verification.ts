/**
 * Oracle Attestation Verification
 *
 * Verification of oracle signatures on attestation messages.
 *
 * @see docs/specs/ORACLE-ATTESTATION.md Section 4
 */

import { ed25519 } from '@noble/curves/ed25519'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'
import type {
  OracleId,
  OracleInfo,
  OracleRegistry,
  OracleRegistryConfig,
  OracleSignature,
  SignedOracleAttestation,
  VerificationResult,
} from './types'
import { DEFAULT_THRESHOLD, DEFAULT_TOTAL_ORACLES } from './types'
import { computeAttestationHash } from './serialization'

/**
 * Derive oracle ID from public key
 *
 * OracleId = SHA256(publicKey)
 */
export function deriveOracleId(publicKey: HexString | Uint8Array): OracleId {
  const keyBytes = typeof publicKey === 'string'
    ? hexToBytes(publicKey.startsWith('0x') ? publicKey.slice(2) : publicKey)
    : publicKey

  const hash = sha256(keyBytes)
  return `0x${bytesToHex(hash)}` as OracleId
}

/**
 * Verify a signed oracle attestation
 *
 * Checks:
 * 1. Sufficient signatures (>= threshold)
 * 2. All signatures are from registered, active oracles
 * 3. All signatures are valid Ed25519 signatures
 * 4. No duplicate oracles
 */
export function verifyAttestation(
  attestation: SignedOracleAttestation,
  registry: OracleRegistry
): VerificationResult {
  const { message, signatures } = attestation
  const errors: string[] = []
  const validOracles: OracleId[] = []

  // Check we have enough signatures
  if (signatures.length < registry.threshold) {
    errors.push(
      `Insufficient signatures: ${signatures.length} < ${registry.threshold} required`
    )
  }

  // Compute message hash for verification
  const messageHash = computeAttestationHash(message)

  // Track seen oracles to prevent duplicates
  const seenOracles = new Set<OracleId>()
  let validCount = 0

  for (const sig of signatures) {
    // Check for duplicate oracles
    if (seenOracles.has(sig.oracleId)) {
      errors.push(`Duplicate signature from oracle: ${sig.oracleId}`)
      continue
    }
    seenOracles.add(sig.oracleId)

    // Get oracle from registry
    const oracle = registry.oracles.get(sig.oracleId)
    if (!oracle) {
      errors.push(`Unknown oracle: ${sig.oracleId}`)
      continue
    }

    if (oracle.status !== 'active') {
      errors.push(`Oracle not active: ${sig.oracleId} (status: ${oracle.status})`)
      continue
    }

    // Verify Ed25519 signature
    try {
      const publicKeyBytes = hexToBytes(
        oracle.publicKey.startsWith('0x')
          ? oracle.publicKey.slice(2)
          : oracle.publicKey
      )
      const signatureBytes = hexToBytes(
        sig.signature.startsWith('0x')
          ? sig.signature.slice(2)
          : sig.signature
      )

      const isValid = ed25519.verify(signatureBytes, messageHash, publicKeyBytes)

      if (isValid) {
        validCount++
        validOracles.push(sig.oracleId)
      } else {
        errors.push(`Invalid signature from oracle: ${sig.oracleId}`)
      }
    } catch (e) {
      errors.push(`Signature verification error for ${sig.oracleId}: ${e}`)
    }
  }

  const valid = validCount >= registry.threshold && errors.length === 0

  return {
    valid,
    validSignatures: validCount,
    threshold: registry.threshold,
    validOracles,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Verify a single oracle signature
 */
export function verifyOracleSignature(
  signature: OracleSignature,
  messageHash: Uint8Array,
  oracle: OracleInfo
): boolean {
  try {
    const publicKeyBytes = hexToBytes(
      oracle.publicKey.startsWith('0x')
        ? oracle.publicKey.slice(2)
        : oracle.publicKey
    )
    const signatureBytes = hexToBytes(
      signature.signature.startsWith('0x')
        ? signature.signature.slice(2)
        : signature.signature
    )

    return ed25519.verify(signatureBytes, messageHash, publicKeyBytes)
  } catch {
    return false
  }
}

/**
 * Sign an attestation message (for oracle implementations)
 */
export function signAttestationMessage(
  messageHash: Uint8Array,
  privateKey: Uint8Array
): OracleSignature {
  const signature = ed25519.sign(messageHash, privateKey)
  const publicKey = ed25519.getPublicKey(privateKey)
  const oracleId = deriveOracleId(publicKey)

  return {
    oracleId,
    signature: `0x${bytesToHex(signature)}` as HexString,
  }
}

// ─── Registry Management ──────────────────────────────────────────────────────

/**
 * Create a new oracle registry
 */
export function createOracleRegistry(
  config: OracleRegistryConfig = {}
): OracleRegistry {
  const registry: OracleRegistry = {
    oracles: new Map(),
    threshold: config.threshold ?? DEFAULT_THRESHOLD,
    totalOracles: 0,
    version: 1,
    lastUpdated: Date.now(),
  }

  // Add custom oracles if provided
  if (config.customOracles) {
    for (const oracle of config.customOracles) {
      registry.oracles.set(oracle.id, oracle)
    }
    registry.totalOracles = config.customOracles.length
  }

  return registry
}

/**
 * Add an oracle to the registry
 */
export function addOracle(
  registry: OracleRegistry,
  oracle: OracleInfo
): void {
  registry.oracles.set(oracle.id, oracle)
  registry.totalOracles = registry.oracles.size
  registry.lastUpdated = Date.now()
}

/**
 * Remove an oracle from the registry
 */
export function removeOracle(
  registry: OracleRegistry,
  oracleId: OracleId
): boolean {
  const removed = registry.oracles.delete(oracleId)
  if (removed) {
    registry.totalOracles = registry.oracles.size
    registry.lastUpdated = Date.now()
  }
  return removed
}

/**
 * Update oracle status
 */
export function updateOracleStatus(
  registry: OracleRegistry,
  oracleId: OracleId,
  status: OracleInfo['status']
): boolean {
  const oracle = registry.oracles.get(oracleId)
  if (!oracle) {
    return false
  }

  oracle.status = status
  registry.lastUpdated = Date.now()
  return true
}

/**
 * Get all active oracles
 */
export function getActiveOracles(registry: OracleRegistry): OracleInfo[] {
  return Array.from(registry.oracles.values()).filter(
    (oracle) => oracle.status === 'active'
  )
}

/**
 * Check if registry has enough active oracles for threshold
 */
export function hasEnoughOracles(registry: OracleRegistry): boolean {
  const activeCount = getActiveOracles(registry).length
  return activeCount >= registry.threshold
}
