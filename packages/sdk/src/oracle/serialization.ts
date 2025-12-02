/**
 * Oracle Attestation Serialization
 *
 * Canonical serialization of attestation messages for signing and verification.
 *
 * @see docs/specs/ORACLE-ATTESTATION.md Section 2.2
 */

import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils'
import type { HexString } from '@sip-protocol/types'
import type { OracleAttestationMessage } from './types'
import { ORACLE_DOMAIN, CHAIN_NUMERIC_IDS } from './types'
import { ValidationError } from '../errors'

/**
 * Serialize an attestation message to canonical byte format
 *
 * Layout (197 bytes total):
 * - version: 1 byte
 * - chainId: 4 bytes (big-endian)
 * - intentHash: 32 bytes
 * - recipient: 32 bytes
 * - amount: 16 bytes (big-endian u128)
 * - assetId: 32 bytes
 * - txHash: 32 bytes
 * - blockNumber: 8 bytes (big-endian)
 * - blockHash: 32 bytes
 * - timestamp: 8 bytes (big-endian)
 */
export function serializeAttestationMessage(
  message: OracleAttestationMessage
): Uint8Array {
  const buffer = new Uint8Array(197)
  const view = new DataView(buffer.buffer)
  let offset = 0

  // version (1 byte)
  buffer[offset++] = message.version

  // chainId (4 bytes, big-endian)
  view.setUint32(offset, message.chainId, false)
  offset += 4

  // intentHash (32 bytes)
  const intentHashBytes = normalizeToBytes(message.intentHash, 32, 'intentHash')
  buffer.set(intentHashBytes, offset)
  offset += 32

  // recipient (32 bytes, zero-padded if needed)
  const recipientBytes = normalizeToBytes(message.recipient, 32, 'recipient')
  buffer.set(recipientBytes, offset)
  offset += 32

  // amount (16 bytes, big-endian u128)
  const amountBytes = bigintToBytes(message.amount, 16)
  buffer.set(amountBytes, offset)
  offset += 16

  // assetId (32 bytes)
  const assetIdBytes = normalizeToBytes(message.assetId, 32, 'assetId')
  buffer.set(assetIdBytes, offset)
  offset += 32

  // txHash (32 bytes)
  const txHashBytes = normalizeToBytes(message.txHash, 32, 'txHash')
  buffer.set(txHashBytes, offset)
  offset += 32

  // blockNumber (8 bytes, big-endian)
  view.setBigUint64(offset, message.blockNumber, false)
  offset += 8

  // blockHash (32 bytes)
  const blockHashBytes = normalizeToBytes(message.blockHash, 32, 'blockHash')
  buffer.set(blockHashBytes, offset)
  offset += 32

  // timestamp (8 bytes, big-endian)
  view.setBigUint64(offset, BigInt(message.timestamp), false)

  return buffer
}

/**
 * Deserialize bytes back to attestation message
 */
export function deserializeAttestationMessage(
  bytes: Uint8Array
): OracleAttestationMessage {
  if (bytes.length !== 197) {
    throw new ValidationError(
      `Invalid attestation message length: ${bytes.length}, expected 197`,
      'bytes'
    )
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset)
  let offset = 0

  // version
  const version = bytes[offset++]

  // chainId
  const chainId = view.getUint32(offset, false)
  offset += 4

  // intentHash
  const intentHash = `0x${bytesToHex(bytes.slice(offset, offset + 32))}` as HexString
  offset += 32

  // recipient
  const recipient = `0x${bytesToHex(bytes.slice(offset, offset + 32))}` as HexString
  offset += 32

  // amount
  const amount = bytesToBigint(bytes.slice(offset, offset + 16))
  offset += 16

  // assetId
  const assetId = `0x${bytesToHex(bytes.slice(offset, offset + 32))}` as HexString
  offset += 32

  // txHash
  const txHash = `0x${bytesToHex(bytes.slice(offset, offset + 32))}` as HexString
  offset += 32

  // blockNumber
  const blockNumber = view.getBigUint64(offset, false)
  offset += 8

  // blockHash
  const blockHash = `0x${bytesToHex(bytes.slice(offset, offset + 32))}` as HexString
  offset += 32

  // timestamp
  const timestamp = Number(view.getBigUint64(offset, false))

  return {
    version,
    chainId,
    intentHash,
    recipient,
    amount,
    assetId,
    txHash,
    blockNumber,
    blockHash,
    timestamp,
  }
}

/**
 * Compute the hash to be signed for an attestation
 *
 * hash = SHA256(domain || serialized_message)
 */
export function computeAttestationHash(
  message: OracleAttestationMessage
): Uint8Array {
  const domain = utf8ToBytes(ORACLE_DOMAIN)
  const messageBytes = serializeAttestationMessage(message)

  // Concatenate domain and message
  const toHash = new Uint8Array(domain.length + messageBytes.length)
  toHash.set(domain, 0)
  toHash.set(messageBytes, domain.length)

  return sha256(toHash)
}

/**
 * Get the numeric chain ID for a chain identifier
 */
export function getChainNumericId(chain: string): number {
  const id = CHAIN_NUMERIC_IDS[chain as keyof typeof CHAIN_NUMERIC_IDS]
  if (id === undefined) {
    throw new ValidationError(`Unknown chain: ${chain}`, 'chain')
  }
  return id
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Convert hex string to bytes, normalizing to specified length
 */
function normalizeToBytes(
  hex: HexString,
  length: number,
  field: string
): Uint8Array {
  const stripped = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = hexToBytes(stripped)

  if (bytes.length === length) {
    return bytes
  }

  if (bytes.length > length) {
    throw new ValidationError(
      `${field} is too long: ${bytes.length} bytes, max ${length}`,
      field
    )
  }

  // Zero-pad on the left
  const padded = new Uint8Array(length)
  padded.set(bytes, length - bytes.length)
  return padded
}

/**
 * Convert bigint to big-endian bytes
 */
function bigintToBytes(value: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  let v = value

  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn)
    v >>= 8n
  }

  return bytes
}

/**
 * Convert big-endian bytes to bigint
 */
function bytesToBigint(bytes: Uint8Array): bigint {
  let result = 0n
  for (const byte of bytes) {
    result = (result << 8n) + BigInt(byte)
  }
  return result
}
