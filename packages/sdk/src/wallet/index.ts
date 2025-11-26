/**
 * Wallet Module
 *
 * Chain-agnostic wallet adapter interface for SIP Protocol.
 */

// Base adapter class
export { BaseWalletAdapter, MockWalletAdapter } from './base-adapter'

// Wallet errors
export { WalletError, notConnectedError, featureNotSupportedError } from './errors'

// Registry
export {
  walletRegistry,
  registerWallet,
  createWalletFactory,
  isPrivateWalletAdapter,
} from './registry'

// Solana adapter
export {
  SolanaWalletAdapter,
  createSolanaAdapter,
  MockSolanaAdapter,
  createMockSolanaAdapter,
  createMockSolanaProvider,
  createMockSolanaConnection,
  getSolanaProvider,
  detectSolanaWallets,
  solanaPublicKeyToHex,
  base58ToHex,
} from './solana'

export type {
  SolanaPublicKey,
  SolanaTransaction,
  SolanaVersionedTransaction,
  SolanaWalletProvider,
  SolanaWalletName,
  SolanaCluster,
  SolanaAdapterConfig,
  SolanaConnection,
  SolanaSendOptions,
  SolanaUnsignedTransaction,
  SolanaSignature,
  MockSolanaAdapterConfig,
} from './solana'

// Re-export types from types package for convenience
export type {
  // Core types
  WalletConnectionState,
  Signature,
  UnsignedTransaction,
  SignedTransaction,
  TransactionReceipt,
  // Events
  WalletEventType,
  WalletEvent,
  WalletEventHandler,
  WalletConnectEvent,
  WalletDisconnectEvent,
  WalletAccountChangedEvent,
  WalletChainChangedEvent,
  WalletErrorEvent,
  // Adapter interfaces
  WalletAdapter,
  PrivateWalletAdapter,
  // Privacy types
  WalletShieldedSendParams,
  WalletShieldedSendResult,
  // Registry types
  WalletInfo,
  WalletAdapterFactory,
  WalletRegistryEntry,
} from '@sip-protocol/types'

export { WalletErrorCode } from '@sip-protocol/types'
