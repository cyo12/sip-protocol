/**
 * Private Payments Module for SIP Protocol
 *
 * Provides privacy-preserving stablecoin transfers and P2P payments.
 *
 * @example
 * ```typescript
 * import {
 *   PaymentBuilder,
 *   getStablecoin,
 *   toStablecoinUnits,
 * } from '@sip-protocol/sdk/payment'
 *
 * // Create a shielded USDC payment
 * const payment = await new PaymentBuilder()
 *   .token('USDC', 'ethereum')
 *   .amountHuman(100) // 100 USDC
 *   .recipient(recipientMetaAddress)
 *   .privacy('shielded')
 *   .build()
 * ```
 */

// Payment builder and functions
export {
  PaymentBuilder,
  createShieldedPayment,
  decryptMemo,
  trackPayment,
  isPaymentExpired,
  getPaymentTimeRemaining,
  serializePayment,
  deserializePayment,
  getPaymentSummary,
} from './payment'
export type { CreatePaymentOptions } from './payment'

// Stablecoin registry
export {
  STABLECOIN_INFO,
  STABLECOIN_ADDRESSES,
  STABLECOIN_DECIMALS,
  getStablecoin,
  getStablecoinsForChain,
  isStablecoin,
  getStablecoinInfo,
  getSupportedStablecoins,
  isStablecoinOnChain,
  getChainsForStablecoin,
  toStablecoinUnits,
  fromStablecoinUnits,
  formatStablecoinAmount,
} from './stablecoins'
export type { StablecoinInfo } from './stablecoins'
