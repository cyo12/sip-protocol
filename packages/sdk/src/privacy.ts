/**
 * Privacy level handling for SIP Protocol
 *
 * IMPORTANT: Encryption functions require real ChaCha20-Poly1305 implementation.
 * Functions will throw EncryptionNotImplementedError until implemented.
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
import { EncryptionNotImplementedError } from './errors'

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
 *
 * Uses ChaCha20-Poly1305 authenticated encryption.
 *
 * @throws {EncryptionNotImplementedError} Real ChaCha20-Poly1305 implementation required
 * @see docs/specs/VIEWING-KEY.md for specification
 */
export function encryptForViewing(
  _data: {
    sender: string
    recipient: string
    amount: string
    timestamp: number
  },
  _viewingKey: ViewingKey,
): EncryptedTransaction {
  throw new EncryptionNotImplementedError(
    'encrypt',
    'docs/specs/VIEWING-KEY.md',
  )
}

/**
 * Decrypt transaction data with viewing key
 *
 * Uses ChaCha20-Poly1305 authenticated decryption.
 *
 * @throws {EncryptionNotImplementedError} Real ChaCha20-Poly1305 implementation required
 * @see docs/specs/VIEWING-KEY.md for specification
 */
export function decryptWithViewing(
  _encrypted: EncryptedTransaction,
  _viewingKey: ViewingKey,
): {
  sender: string
  recipient: string
  amount: string
  timestamp: number
} {
  throw new EncryptionNotImplementedError(
    'decrypt',
    'docs/specs/VIEWING-KEY.md',
  )
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

// hexToBytes removed - was only needed for mocked XOR encryption
