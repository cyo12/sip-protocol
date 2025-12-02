/**
 * Browser-compatible utilities for proof generation
 *
 * These utilities replace Node.js-specific functions (like Buffer)
 * with browser-compatible alternatives using Web APIs.
 *
 * @module proofs/browser-utils
 */

/**
 * Convert hex string to Uint8Array (browser-compatible)
 */
export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex
  if (h.length === 0) return new Uint8Array(0)
  if (h.length % 2 !== 0) {
    throw new Error('Hex string must have even length')
  }
  const bytes = new Uint8Array(h.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Convert Uint8Array to hex string (browser-compatible)
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined'
}

/**
 * Check if Web Workers are available
 */
export function supportsWebWorkers(): boolean {
  return typeof Worker !== 'undefined'
}

/**
 * Check if SharedArrayBuffer is available (required for some WASM operations)
 */
export function supportsSharedArrayBuffer(): boolean {
  try {
    return typeof SharedArrayBuffer !== 'undefined'
  } catch {
    return false
  }
}

/**
 * Get browser info for diagnostics
 */
export function getBrowserInfo(): {
  isBrowser: boolean
  supportsWorkers: boolean
  supportsSharedArrayBuffer: boolean
  userAgent: string | null
} {
  return {
    isBrowser: isBrowser(),
    supportsWorkers: supportsWebWorkers(),
    supportsSharedArrayBuffer: supportsSharedArrayBuffer(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }
}

/**
 * Load script dynamically (for WASM loading)
 */
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error('loadScript can only be used in browser'))
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

/**
 * Estimate available memory (approximate, browser-specific)
 */
export async function estimateAvailableMemory(): Promise<number | null> {
  if (!isBrowser()) return null

  // Use Performance API if available (Chrome)
  // @ts-expect-error - Performance.measureUserAgentSpecificMemory is Chrome-specific
  if (typeof performance !== 'undefined' && performance.measureUserAgentSpecificMemory) {
    try {
      // @ts-expect-error - Chrome-specific API
      const result = await performance.measureUserAgentSpecificMemory()
      return result.bytes
    } catch {
      // API not available or permission denied
    }
  }

  // Use navigator.deviceMemory if available (Chrome, Opera)
  // @ts-expect-error - deviceMemory is non-standard
  if (typeof navigator !== 'undefined' && navigator.deviceMemory) {
    // Returns approximate device memory in GB
    // @ts-expect-error - deviceMemory is non-standard
    return navigator.deviceMemory * 1024 * 1024 * 1024
  }

  return null
}

/**
 * Create a blob URL for worker code (inline worker support)
 */
export function createWorkerBlobUrl(code: string): string {
  if (!isBrowser()) {
    throw new Error('createWorkerBlobUrl can only be used in browser')
  }
  const blob = new Blob([code], { type: 'application/javascript' })
  return URL.createObjectURL(blob)
}

/**
 * Revoke a blob URL to free memory
 */
export function revokeWorkerBlobUrl(url: string): void {
  if (isBrowser() && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
