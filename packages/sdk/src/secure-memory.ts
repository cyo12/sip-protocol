/**
 * Secure Memory Utilities
 *
 * Provides secure memory handling for cryptographic secrets.
 *
 * ## Security Properties
 * - **Zeroization**: Secrets are overwritten before being freed
 * - **Defense in Depth**: Overwrite with random data, then zero
 *
 * ## Limitations
 * - JavaScript garbage collection may leave copies
 * - JIT compilation may create copies
 * - Memory may be swapped to disk
 *
 * This provides best-effort cleanup for JavaScript environments.
 *
 * @see docs/security/KNOWN_LIMITATIONS.md
 */

import { randomBytes } from '@noble/hashes/utils'

/**
 * Securely wipe a buffer containing sensitive data
 *
 * This performs a defense-in-depth wipe:
 * 1. Overwrite with random data (defeats simple memory scrapers)
 * 2. Zero the buffer (standard cleanup)
 *
 * Note: Due to JavaScript's garbage collection and potential JIT
 * optimizations, this cannot guarantee complete erasure. However,
 * it provides significant improvement over leaving secrets in memory.
 *
 * @param buffer - The buffer to wipe (modified in place)
 *
 * @example
 * ```typescript
 * const secretKey = randomBytes(32)
 * // ... use the key ...
 * secureWipe(secretKey) // Clean up when done
 * ```
 */
export function secureWipe(buffer: Uint8Array): void {
  if (!buffer || buffer.length === 0) {
    return
  }

  // Step 1: Overwrite with random data
  // This defeats simple memory scrapers looking for zeroed patterns
  const random = randomBytes(buffer.length)
  buffer.set(random)

  // Step 2: Zero the buffer
  // Standard cleanup - makes the data unreadable
  buffer.fill(0)
}

/**
 * Execute a function with a secret buffer and ensure cleanup
 *
 * Provides a safer pattern for using secrets - the buffer is
 * automatically wiped after the function completes (or throws).
 *
 * @param createSecret - Function to create the secret buffer
 * @param useSecret - Function that uses the secret
 * @returns The result of useSecret
 *
 * @example
 * ```typescript
 * const signature = await withSecureBuffer(
 *   () => generatePrivateKey(),
 *   async (privateKey) => {
 *     return signMessage(message, privateKey)
 *   }
 * )
 * // privateKey is automatically wiped after signing
 * ```
 */
export async function withSecureBuffer<T>(
  createSecret: () => Uint8Array,
  useSecret: (secret: Uint8Array) => T | Promise<T>,
): Promise<T> {
  const secret = createSecret()
  try {
    return await useSecret(secret)
  } finally {
    secureWipe(secret)
  }
}

/**
 * Synchronous version of withSecureBuffer
 *
 * @param createSecret - Function to create the secret buffer
 * @param useSecret - Function that uses the secret (sync)
 * @returns The result of useSecret
 */
export function withSecureBufferSync<T>(
  createSecret: () => Uint8Array,
  useSecret: (secret: Uint8Array) => T,
): T {
  const secret = createSecret()
  try {
    return useSecret(secret)
  } finally {
    secureWipe(secret)
  }
}

/**
 * Wipe multiple buffers at once
 *
 * Convenience function for cleaning up multiple secrets.
 *
 * @param buffers - Array of buffers to wipe
 */
export function secureWipeAll(...buffers: (Uint8Array | undefined | null)[]): void {
  for (const buffer of buffers) {
    if (buffer) {
      secureWipe(buffer)
    }
  }
}
