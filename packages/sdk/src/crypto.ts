/**
 * Cryptographic utilities for SIP Protocol
 *
 * Implements Pedersen commitments and mock ZK proofs.
 * Note: ZK proofs are mocked for the hackathon demo - real implementation
 * would use a proper ZK proving system (e.g., Groth16, PLONK).
 */

import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils'
import type { Commitment, ZKProof, HexString, Hash } from '@sip-protocol/types'

// Generator point H for Pedersen commitments (nothing-up-my-sleeve point)
// H = hash_to_curve("SIP-PROTOCOL-H")
const H_BYTES = sha256(new TextEncoder().encode('SIP-PROTOCOL-H'))

/**
 * Create a Pedersen commitment to a value
 * Commitment = value * G + blinding * H
 *
 * @param value - The value to commit to
 * @param blindingFactor - Optional blinding factor (random if not provided)
 * @returns Commitment object
 */
export function createCommitment(
  value: bigint,
  blindingFactor?: Uint8Array,
): Commitment {
  const blinding = blindingFactor ?? randomBytes(32)

  // value * G
  const valueScalar = bigIntToBytes(value, 32)
  const valuePoint = secp256k1.ProjectivePoint.BASE.multiply(bytesToBigInt(valueScalar))

  // blinding * H (we use H_BYTES as a scalar to derive a point)
  const hPoint = secp256k1.ProjectivePoint.BASE.multiply(bytesToBigInt(H_BYTES))
  const blindingPoint = hPoint.multiply(bytesToBigInt(blinding))

  // Commitment = valuePoint + blindingPoint
  const commitmentPoint = valuePoint.add(blindingPoint)
  const commitmentBytes = commitmentPoint.toRawBytes(true)

  return {
    value: `0x${bytesToHex(commitmentBytes)}` as HexString,
    blindingFactor: `0x${bytesToHex(blinding)}` as HexString,
  }
}

/**
 * Verify a Pedersen commitment (requires knowing the value and blinding factor)
 */
export function verifyCommitment(
  commitment: Commitment,
  expectedValue: bigint,
): boolean {
  if (!commitment.blindingFactor) {
    throw new Error('Cannot verify commitment without blinding factor')
  }

  // Recreate the commitment
  const blinding = hexToBytes(commitment.blindingFactor.slice(2))
  const recreated = createCommitment(expectedValue, blinding)

  return recreated.value === commitment.value
}

/**
 * Create a mock funding proof
 * In production, this would generate a real ZK proof showing:
 * - User has sufficient funds to cover the intent
 * - Without revealing: exact balance, source of funds
 */
export function createFundingProof(
  inputAmount: bigint,
  inputCommitment: Commitment,
): ZKProof {
  // Mock proof generation
  // In production: use a ZK proving system
  const proofData = sha256(
    new TextEncoder().encode(
      `funding:${inputAmount}:${inputCommitment.value}:${Date.now()}`,
    ),
  )

  return {
    type: 'funding',
    proof: `0x${bytesToHex(proofData)}` as HexString,
    publicInputs: [inputCommitment.value],
  }
}

/**
 * Create a mock validity proof
 * In production, this would generate a real ZK proof showing:
 * - Intent is well-formed and authorized
 * - Without revealing: sender identity, input details
 */
export function createValidityProof(
  intentId: string,
  senderCommitment: Commitment,
): ZKProof {
  // Mock proof generation
  const proofData = sha256(
    new TextEncoder().encode(
      `validity:${intentId}:${senderCommitment.value}:${Date.now()}`,
    ),
  )

  return {
    type: 'validity',
    proof: `0x${bytesToHex(proofData)}` as HexString,
    publicInputs: [senderCommitment.value],
  }
}

/**
 * Create a mock fulfillment proof
 * Proves that the solver correctly fulfilled the intent
 */
export function createFulfillmentProof(
  intentId: string,
  outputAmount: bigint,
): ZKProof {
  const proofData = sha256(
    new TextEncoder().encode(
      `fulfillment:${intentId}:${outputAmount}:${Date.now()}`,
    ),
  )

  return {
    type: 'fulfillment',
    proof: `0x${bytesToHex(proofData)}` as HexString,
    publicInputs: [],
  }
}

/**
 * Verify a mock proof (always returns true for mocks)
 * In production: actual ZK verification
 */
export function verifyProof(proof: ZKProof): boolean {
  // Mock verification - always true for demo
  // In production: actual cryptographic verification
  return proof.proof.length > 2
}

/**
 * Generate a random intent ID
 */
export function generateIntentId(): string {
  const bytes = randomBytes(16)
  return `sip-${bytesToHex(bytes)}`
}

/**
 * Hash data using SHA256
 */
export function hash(data: string | Uint8Array): Hash {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data
  return `0x${bytesToHex(sha256(input))}` as Hash
}

/**
 * Generate random bytes
 */
export function generateRandomBytes(length: number): HexString {
  return `0x${bytesToHex(randomBytes(length))}` as HexString
}

// ─── Utility Functions ──────────────────────────────────────────────────────

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n
  for (const byte of bytes) {
    result = (result << 8n) + BigInt(byte)
  }
  return result
}

function bigIntToBytes(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  let v = value
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return bytes
}
