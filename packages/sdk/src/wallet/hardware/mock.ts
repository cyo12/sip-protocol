/**
 * Mock Hardware Wallet Adapters
 *
 * Mock implementations of hardware wallet adapters for testing.
 * These simulate Ledger and Trezor device behavior without actual hardware.
 */

import type {
  ChainId,
  HexString,
  Asset,
  Signature,
  UnsignedTransaction,
  SignedTransaction,
  TransactionReceipt,
} from '@sip-protocol/types'
import { WalletErrorCode } from '@sip-protocol/types'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'
import { BaseWalletAdapter } from '../base-adapter'
import { WalletError } from '../errors'
import {
  type HardwareWalletConfig,
  type HardwareDeviceInfo,
  type HardwareAccount,
  type HardwareWalletType,
  type LedgerModel,
  type TrezorModel,
  HardwareErrorCode,
  HardwareWalletError,
  getDerivationPath,
} from './types'

// ─── Mock Configuration ─────────────────────────────────────────────────────────

/**
 * Mock hardware wallet configuration
 */
export interface MockHardwareConfig extends HardwareWalletConfig {
  /** Device type to simulate */
  deviceType: HardwareWalletType
  /** Device model */
  model?: LedgerModel | TrezorModel
  /** Simulate device locked state */
  isLocked?: boolean
  /** Simulate signing delay (ms) */
  signingDelay?: number
  /** Simulate user rejection */
  shouldReject?: boolean
  /** Simulate connection failure */
  shouldFailConnect?: boolean
  /** Mock address to return */
  mockAddress?: string
  /** Mock public key to return */
  mockPublicKey?: HexString
  /** Number of accounts available */
  accountCount?: number
}

/**
 * Mock Ledger adapter for testing
 */
export class MockLedgerAdapter extends BaseWalletAdapter {
  readonly chain: ChainId
  readonly name: string = 'mock-ledger'

  private config: MockHardwareConfig
  private _derivationPath: string
  private _deviceInfo: HardwareDeviceInfo | null = null
  private _account: HardwareAccount | null = null
  private mockAccounts: HardwareAccount[] = []

  constructor(config: MockHardwareConfig) {
    super()
    this.chain = config.chain
    this.config = {
      model: 'nanoX',
      accountIndex: 0,
      isLocked: false,
      signingDelay: 100,
      shouldReject: false,
      shouldFailConnect: false,
      accountCount: 5,
      ...config,
    }
    this._derivationPath = config.derivationPath ??
      getDerivationPath(config.chain, config.accountIndex ?? 0)

    // Generate mock accounts
    this.generateMockAccounts()
  }

  /**
   * Get device information
   */
  get deviceInfo(): HardwareDeviceInfo | null {
    return this._deviceInfo
  }

  /**
   * Get current derivation path
   */
  get derivationPath(): string {
    return this._derivationPath
  }

  /**
   * Get current account
   */
  get account(): HardwareAccount | null {
    return this._account
  }

  /**
   * Connect to mock Ledger device
   */
  async connect(): Promise<void> {
    this._connectionState = 'connecting'

    // Simulate connection delay
    await this.delay(200)

    if (this.config.shouldFailConnect) {
      this._connectionState = 'error'
      throw new HardwareWalletError(
        'Mock connection failure',
        HardwareErrorCode.DEVICE_NOT_FOUND,
        'ledger'
      )
    }

    if (this.config.isLocked) {
      this._connectionState = 'error'
      throw new HardwareWalletError(
        'Device is locked. Please enter PIN.',
        HardwareErrorCode.DEVICE_LOCKED,
        'ledger'
      )
    }

    this._account = this.mockAccounts[this.config.accountIndex ?? 0]

    this._deviceInfo = {
      manufacturer: 'ledger',
      model: this.config.model as string ?? 'Nano X',
      firmwareVersion: '2.1.0',
      isLocked: false,
      currentApp: this.getAppName(),
      label: 'Mock Ledger',
      deviceId: 'mock-ledger-001',
    }

    this.setConnected(this._account.address, this._account.publicKey)
  }

  /**
   * Disconnect from mock device
   */
  async disconnect(): Promise<void> {
    this._account = null
    this._deviceInfo = null
    this.setDisconnected()
  }

  /**
   * Sign a message
   */
  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()

    // Simulate signing delay
    await this.delay(this.config.signingDelay ?? 100)

    if (this.config.shouldReject) {
      throw new HardwareWalletError(
        'User rejected on device',
        HardwareErrorCode.USER_REJECTED,
        'ledger'
      )
    }

    // Generate mock signature
    const sig = this.generateMockSignature(message)

    return {
      signature: sig,
      publicKey: this._account!.publicKey,
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    await this.delay(this.config.signingDelay ?? 100)

    if (this.config.shouldReject) {
      throw new HardwareWalletError(
        'Transaction rejected on device',
        HardwareErrorCode.USER_REJECTED,
        'ledger'
      )
    }

    const sig = this.generateMockSignature(
      new TextEncoder().encode(JSON.stringify(tx.data))
    )

    return {
      unsigned: tx,
      signatures: [
        {
          signature: sig,
          publicKey: this._account!.publicKey,
        },
      ],
      serialized: sig,
    }
  }

  /**
   * Sign and send transaction
   */
  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    const signed = await this.signTransaction(tx)

    return {
      txHash: signed.serialized.slice(0, 66) as HexString,
      status: 'pending',
    }
  }

  /**
   * Get balance (not supported by hardware wallets)
   */
  async getBalance(): Promise<bigint> {
    throw new WalletError(
      'Hardware wallets do not track balances',
      WalletErrorCode.UNSUPPORTED_OPERATION
    )
  }

  /**
   * Get token balance (not supported by hardware wallets)
   */
  async getTokenBalance(_asset: Asset): Promise<bigint> {
    throw new WalletError(
      'Hardware wallets do not track balances',
      WalletErrorCode.UNSUPPORTED_OPERATION
    )
  }

  /**
   * Get multiple accounts
   */
  async getAccounts(startIndex: number = 0, count: number = 5): Promise<HardwareAccount[]> {
    this.requireConnected()
    return this.mockAccounts.slice(startIndex, startIndex + count)
  }

  /**
   * Switch account
   */
  async switchAccount(accountIndex: number): Promise<HardwareAccount> {
    this.requireConnected()

    if (accountIndex >= this.mockAccounts.length) {
      throw new HardwareWalletError(
        'Account index out of range',
        HardwareErrorCode.INVALID_PATH,
        'ledger'
      )
    }

    const previousAddress = this._address
    this._account = this.mockAccounts[accountIndex]
    this._derivationPath = this._account.derivationPath

    this.setConnected(this._account.address, this._account.publicKey)

    if (previousAddress !== this._account.address) {
      this.emitAccountChanged(previousAddress, this._account.address)
    }

    return this._account
  }

  // ─── Test Helpers ───────────────────────────────────────────────────────────

  /**
   * Set whether device should reject signing
   */
  setShouldReject(shouldReject: boolean): void {
    this.config.shouldReject = shouldReject
  }

  /**
   * Set signing delay
   */
  setSigningDelay(delay: number): void {
    this.config.signingDelay = delay
  }

  /**
   * Simulate device lock
   */
  simulateLock(): void {
    if (this._deviceInfo) {
      this._deviceInfo.isLocked = true
    }
    this.config.isLocked = true
  }

  /**
   * Simulate device unlock
   */
  simulateUnlock(): void {
    if (this._deviceInfo) {
      this._deviceInfo.isLocked = false
    }
    this.config.isLocked = false
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private getAppName(): string {
    switch (this.chain) {
      case 'ethereum':
        return 'Ethereum'
      case 'solana':
        return 'Solana'
      default:
        return 'Unknown'
    }
  }

  private generateMockAccounts(): void {
    const count = this.config.accountCount ?? 5

    for (let i = 0; i < count; i++) {
      const path = getDerivationPath(this.chain, i)
      const address = this.config.mockAddress && i === 0
        ? this.config.mockAddress
        : this.generateMockAddress(i)
      const publicKey = this.config.mockPublicKey && i === 0
        ? this.config.mockPublicKey
        : this.generateMockPublicKey(i)

      this.mockAccounts.push({
        address,
        publicKey,
        derivationPath: path,
        index: i,
        chain: this.chain,
      })
    }
  }

  private generateMockAddress(index: number): string {
    const bytes = randomBytes(20)
    bytes[0] = index // Make addresses deterministic based on index
    return `0x${bytesToHex(bytes)}`
  }

  private generateMockPublicKey(index: number): HexString {
    const bytes = randomBytes(33)
    bytes[0] = 0x02 // Compressed public key prefix
    bytes[1] = index
    return `0x${bytesToHex(bytes)}` as HexString
  }

  private generateMockSignature(data: Uint8Array): HexString {
    const sig = new Uint8Array(65)
    for (let i = 0; i < 32; i++) {
      sig[i] = (data[i % data.length] ?? 0) ^ (i * 7) // r
      sig[32 + i] = (data[i % data.length] ?? 0) ^ (i * 11) // s
    }
    sig[64] = 27 // v
    return `0x${bytesToHex(sig)}` as HexString
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Mock Trezor adapter for testing
 */
export class MockTrezorAdapter extends BaseWalletAdapter {
  readonly chain: ChainId
  readonly name: string = 'mock-trezor'

  private config: MockHardwareConfig
  private _derivationPath: string
  private _deviceInfo: HardwareDeviceInfo | null = null
  private _account: HardwareAccount | null = null
  private mockAccounts: HardwareAccount[] = []

  constructor(config: MockHardwareConfig) {
    super()
    this.chain = config.chain
    this.config = {
      model: 'T',
      accountIndex: 0,
      isLocked: false,
      signingDelay: 100,
      shouldReject: false,
      shouldFailConnect: false,
      accountCount: 5,
      ...config,
    }
    this._derivationPath = config.derivationPath ??
      getDerivationPath(config.chain, config.accountIndex ?? 0)

    this.generateMockAccounts()
  }

  get deviceInfo(): HardwareDeviceInfo | null {
    return this._deviceInfo
  }

  get derivationPath(): string {
    return this._derivationPath
  }

  get account(): HardwareAccount | null {
    return this._account
  }

  async connect(): Promise<void> {
    this._connectionState = 'connecting'

    await this.delay(200)

    if (this.config.shouldFailConnect) {
      this._connectionState = 'error'
      throw new HardwareWalletError(
        'Mock connection failure',
        HardwareErrorCode.DEVICE_NOT_FOUND,
        'trezor'
      )
    }

    if (this.config.isLocked) {
      this._connectionState = 'error'
      throw new HardwareWalletError(
        'Device requires PIN',
        HardwareErrorCode.DEVICE_LOCKED,
        'trezor'
      )
    }

    this._account = this.mockAccounts[this.config.accountIndex ?? 0]

    this._deviceInfo = {
      manufacturer: 'trezor',
      model: this.config.model as string ?? 'Model T',
      firmwareVersion: '2.5.3',
      isLocked: false,
      label: 'Mock Trezor',
      deviceId: 'mock-trezor-001',
    }

    this.setConnected(this._account.address, this._account.publicKey)
  }

  async disconnect(): Promise<void> {
    this._account = null
    this._deviceInfo = null
    this.setDisconnected()
  }

  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()

    await this.delay(this.config.signingDelay ?? 100)

    if (this.config.shouldReject) {
      throw new HardwareWalletError(
        'User rejected on device',
        HardwareErrorCode.USER_REJECTED,
        'trezor'
      )
    }

    const sig = this.generateMockSignature(message)

    return {
      signature: sig,
      publicKey: this._account!.publicKey,
    }
  }

  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    await this.delay(this.config.signingDelay ?? 100)

    if (this.config.shouldReject) {
      throw new HardwareWalletError(
        'Transaction rejected on device',
        HardwareErrorCode.USER_REJECTED,
        'trezor'
      )
    }

    const sig = this.generateMockSignature(
      new TextEncoder().encode(JSON.stringify(tx.data))
    )

    return {
      unsigned: tx,
      signatures: [
        {
          signature: sig,
          publicKey: this._account!.publicKey,
        },
      ],
      serialized: sig,
    }
  }

  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    const signed = await this.signTransaction(tx)

    return {
      txHash: signed.serialized.slice(0, 66) as HexString,
      status: 'pending',
    }
  }

  async getBalance(): Promise<bigint> {
    throw new WalletError(
      'Hardware wallets do not track balances',
      WalletErrorCode.UNSUPPORTED_OPERATION
    )
  }

  async getTokenBalance(_asset: Asset): Promise<bigint> {
    throw new WalletError(
      'Hardware wallets do not track balances',
      WalletErrorCode.UNSUPPORTED_OPERATION
    )
  }

  async getAccounts(startIndex: number = 0, count: number = 5): Promise<HardwareAccount[]> {
    this.requireConnected()
    return this.mockAccounts.slice(startIndex, startIndex + count)
  }

  async switchAccount(accountIndex: number): Promise<HardwareAccount> {
    this.requireConnected()

    if (accountIndex >= this.mockAccounts.length) {
      throw new HardwareWalletError(
        'Account index out of range',
        HardwareErrorCode.INVALID_PATH,
        'trezor'
      )
    }

    const previousAddress = this._address
    this._account = this.mockAccounts[accountIndex]
    this._derivationPath = this._account.derivationPath

    this.setConnected(this._account.address, this._account.publicKey)

    if (previousAddress !== this._account.address) {
      this.emitAccountChanged(previousAddress, this._account.address)
    }

    return this._account
  }

  setShouldReject(shouldReject: boolean): void {
    this.config.shouldReject = shouldReject
  }

  setSigningDelay(delay: number): void {
    this.config.signingDelay = delay
  }

  simulateLock(): void {
    if (this._deviceInfo) {
      this._deviceInfo.isLocked = true
    }
    this.config.isLocked = true
  }

  simulateUnlock(): void {
    if (this._deviceInfo) {
      this._deviceInfo.isLocked = false
    }
    this.config.isLocked = false
  }

  private generateMockAccounts(): void {
    const count = this.config.accountCount ?? 5

    for (let i = 0; i < count; i++) {
      const path = getDerivationPath(this.chain, i)
      const address = this.config.mockAddress && i === 0
        ? this.config.mockAddress
        : this.generateMockAddress(i)
      const publicKey = this.config.mockPublicKey && i === 0
        ? this.config.mockPublicKey
        : this.generateMockPublicKey(i)

      this.mockAccounts.push({
        address,
        publicKey,
        derivationPath: path,
        index: i,
        chain: this.chain,
      })
    }
  }

  private generateMockAddress(index: number): string {
    const bytes = randomBytes(20)
    bytes[0] = index + 100 // Different from Ledger mocks
    return `0x${bytesToHex(bytes)}`
  }

  private generateMockPublicKey(index: number): HexString {
    const bytes = randomBytes(33)
    bytes[0] = 0x03 // Different compressed prefix
    bytes[1] = index + 100
    return `0x${bytesToHex(bytes)}` as HexString
  }

  private generateMockSignature(data: Uint8Array): HexString {
    const sig = new Uint8Array(65)
    for (let i = 0; i < 32; i++) {
      sig[i] = (data[i % data.length] ?? 0) ^ (i * 13)
      sig[32 + i] = (data[i % data.length] ?? 0) ^ (i * 17)
    }
    sig[64] = 28
    return `0x${bytesToHex(sig)}` as HexString
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ─── Factory Functions ────────────────────────────────────────────────────────

/**
 * Create a mock Ledger adapter
 */
export function createMockLedgerAdapter(
  config: Omit<MockHardwareConfig, 'deviceType'>
): MockLedgerAdapter {
  return new MockLedgerAdapter({ ...config, deviceType: 'ledger' })
}

/**
 * Create a mock Trezor adapter
 */
export function createMockTrezorAdapter(
  config: Omit<MockHardwareConfig, 'deviceType'>
): MockTrezorAdapter {
  return new MockTrezorAdapter({ ...config, deviceType: 'trezor' })
}
