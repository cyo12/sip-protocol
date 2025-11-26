/**
 * Privacy level handling for SIP Protocol
 */

import type {
  PrivacyLevel,
  ViewingKey,
  EncryptedTransaction,
  HexString,
  Hash,
} from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'

/**
 * Privacy configuration for an intent
 */
export interface PrivacyConfig {
  /** The privacy level */
  level: PrivacyLevel
  /** Viewing key (required for compliant mode) */
  viewingKey?: ViewingKey
  /** Whether to use stealth addresses */
  useStealth: boolean
  /** Whether to encrypt transaction data */
  encryptData: boolean
}

/**
 * Get privacy configuration for a privacy level
 */
export function getPrivacyConfig(
  level: PrivacyLevel,
  viewingKey?: ViewingKey,
): PrivacyConfig {
  switch (level) {
    case 'transparent':
      return {
        level,
        useStealth: false,
        encryptData: false,
      }

    case 'shielded':
      return {
        level,
        useStealth: true,
        encryptData: true,
      }

    case 'compliant':
      if (!viewingKey) {
        throw new Error('Viewing key required for compliant mode')
      }
      return {
        level,
        viewingKey,
        useStealth: true,
        encryptData: true,
      }

    default:
      throw new Error(`Unknown privacy level: ${level}`)
  }
}

/**
 * Generate a new viewing key
 */
export function generateViewingKey(path: string = 'm/0'): ViewingKey {
  const keyBytes = randomBytes(32)
  const key = `0x${bytesToHex(keyBytes)}` as HexString
  const hashBytes = sha256(keyBytes)

  return {
    key,
    path,
    hash: `0x${bytesToHex(hashBytes)}` as Hash,
  }
}

/**
 * Derive a child viewing key
 */
export function deriveViewingKey(
  masterKey: ViewingKey,
  childPath: string,
): ViewingKey {
  // Simple derivation: hash(masterKey || childPath)
  const combined = new TextEncoder().encode(`${masterKey.key}:${childPath}`)
  const derivedBytes = sha256(combined)
  const derived = `0x${bytesToHex(derivedBytes)}` as HexString
  const hashBytes = sha256(derivedBytes)

  return {
    key: derived,
    path: `${masterKey.path}/${childPath}`,
    hash: `0x${bytesToHex(hashBytes)}` as Hash,
  }
}

/**
 * Encrypt transaction data for viewing key holders
 * Note: This is a simplified mock - real implementation would use proper encryption
 */
export function encryptForViewing(
  data: {
    sender: string
    recipient: string
    amount: string
    timestamp: number
  },
  viewingKey: ViewingKey,
): EncryptedTransaction {
  // Mock encryption (XOR with hash of viewing key)
  // In production: use proper authenticated encryption (ChaCha20-Poly1305, etc.)
  const plaintext = JSON.stringify(data)
  const nonce = randomBytes(12)
  const keyHash = sha256(new TextEncoder().encode(viewingKey.key))

  // Simple XOR encryption (NOT secure - demo only)
  const plaintextBytes = new TextEncoder().encode(plaintext)
  const ciphertext = new Uint8Array(plaintextBytes.length)
  for (let i = 0; i < plaintextBytes.length; i++) {
    ciphertext[i] = plaintextBytes[i] ^ keyHash[i % keyHash.length]
  }

  return {
    ciphertext: `0x${bytesToHex(ciphertext)}` as HexString,
    nonce: `0x${bytesToHex(nonce)}` as HexString,
    viewingKeyHash: viewingKey.hash,
  }
}

/**
 * Decrypt transaction data with viewing key
 */
export function decryptWithViewing(
  encrypted: EncryptedTransaction,
  viewingKey: ViewingKey,
): {
  sender: string
  recipient: string
  amount: string
  timestamp: number
} {
  // Verify viewing key hash matches
  const hashBytes = sha256(new TextEncoder().encode(viewingKey.key))
  const computedHash = `0x${bytesToHex(hashBytes)}` as Hash

  if (computedHash !== encrypted.viewingKeyHash) {
    throw new Error('Viewing key does not match encrypted data')
  }

  // Mock decryption (reverse XOR)
  const ciphertextBytes = hexToBytes(encrypted.ciphertext.slice(2))
  const keyHash = sha256(new TextEncoder().encode(viewingKey.key))
  const plaintext = new Uint8Array(ciphertextBytes.length)
  for (let i = 0; i < ciphertextBytes.length; i++) {
    plaintext[i] = ciphertextBytes[i] ^ keyHash[i % keyHash.length]
  }

  const decoded = new TextDecoder().decode(plaintext)
  return JSON.parse(decoded)
}

/**
 * Validate privacy level string
 */
export function isValidPrivacyLevel(level: string): level is PrivacyLevel {
  return ['transparent', 'shielded', 'compliant'].includes(level)
}

/**
 * Get human-readable description of privacy level
 */
export function getPrivacyDescription(level: PrivacyLevel): string {
  const descriptions: Record<PrivacyLevel, string> = {
    transparent: 'Public transaction - all details visible on-chain',
    shielded: 'Private transaction - sender, amount, and recipient hidden',
    compliant: 'Private with audit - hidden but viewable with key',
  }
  return descriptions[level]
}

// Helper to convert hex to bytes
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
