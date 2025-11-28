/**
 * Trezor Hardware Wallet Adapter
 *
 * Provides integration with Trezor hardware wallets (Model One, Model T, Safe 3/5)
 * for secure transaction signing.
 *
 * @example
 * ```typescript
 * import { TrezorWalletAdapter } from '@sip-protocol/sdk'
 *
 * const trezor = new TrezorWalletAdapter({
 *   chain: 'ethereum',
 *   accountIndex: 0,
 *   manifestEmail: 'dev@myapp.com',
 *   manifestAppName: 'My DApp',
 *   manifestUrl: 'https://myapp.com',
 * })
 *
 * await trezor.connect()
 * const signature = await trezor.signMessage(message)
 * ```
 *
 * @remarks
 * Uses Trezor Connect for device communication.
 *
 * External dependency (install separately):
 * - @trezor/connect-web
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
import { BaseWalletAdapter } from '../base-adapter'
import { WalletError } from '../errors'
import {
  type TrezorConfig,
  type HardwareDeviceInfo,
  type HardwareAccount,
  type HardwareSignature,
  type HardwareEthereumTx,
  HardwareErrorCode,
  HardwareWalletError,
  getDerivationPath,
} from './types'

/**
 * Trezor wallet adapter
 *
 * Supports Ethereum chain via Trezor Connect.
 */
export class TrezorWalletAdapter extends BaseWalletAdapter {
  readonly chain: ChainId
  readonly name: string = 'trezor'

  private config: TrezorConfig
  private trezorConnect: TrezorConnectType | null = null
  private initialized: boolean = false
  private _derivationPath: string
  private _deviceInfo: HardwareDeviceInfo | null = null
  private _account: HardwareAccount | null = null

  constructor(config: TrezorConfig) {
    super()
    this.chain = config.chain
    this.config = {
      accountIndex: 0,
      timeout: 30000,
      popup: true,
      manifestEmail: 'support@sip-protocol.org',
      manifestAppName: 'SIP Protocol',
      manifestUrl: 'https://sip-protocol.org',
      ...config,
    }
    this._derivationPath = config.derivationPath ??
      getDerivationPath(config.chain, config.accountIndex ?? 0)
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
   * Connect to Trezor device
   */
  async connect(): Promise<void> {
    this._connectionState = 'connecting'

    try {
      // Load and initialize Trezor Connect
      await this.initializeTrezorConnect()

      // Get account from device
      this._account = await this.getAccountFromDevice()

      // Get device features
      const features = await this.getDeviceFeatures()
      this._deviceInfo = {
        manufacturer: 'trezor',
        model: features.model ?? 'unknown',
        firmwareVersion: features.firmwareVersion,
        isLocked: features.pinProtection && !features.pinCached,
        label: features.label,
        deviceId: features.deviceId,
      }

      this.setConnected(this._account.address, this._account.publicKey)
    } catch (error) {
      this._connectionState = 'error'
      throw this.handleError(error)
    }
  }

  /**
   * Disconnect from Trezor device
   */
  async disconnect(): Promise<void> {
    if (this.trezorConnect) {
      // Trezor Connect doesn't have explicit disconnect
      // Just clear state
    }
    this._account = null
    this._deviceInfo = null
    this.setDisconnected()
  }

  /**
   * Sign a message
   */
  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()

    if (!this.trezorConnect) {
      throw new HardwareWalletError(
        'Trezor Connect not initialized',
        HardwareErrorCode.TRANSPORT_ERROR,
        'trezor'
      )
    }

    try {
      const sig = await this.signMessageOnDevice(message)

      return {
        signature: sig.signature,
        publicKey: this._account!.publicKey,
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    if (!this.trezorConnect) {
      throw new HardwareWalletError(
        'Trezor Connect not initialized',
        HardwareErrorCode.TRANSPORT_ERROR,
        'trezor'
      )
    }

    try {
      const sig = await this.signTransactionOnDevice(tx)

      return {
        unsigned: tx,
        signatures: [
          {
            signature: sig.signature,
            publicKey: this._account!.publicKey,
          },
        ],
        serialized: sig.signature,
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Sign and send transaction
   *
   * Note: Hardware wallets can only sign, not send. This returns a signed
   * transaction that must be broadcast separately.
   */
  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    const signed = await this.signTransaction(tx)

    return {
      txHash: signed.serialized.slice(0, 66) as HexString,
      status: 'pending',
    }
  }

  /**
   * Get native token balance
   *
   * Note: Hardware wallets don't track balances - this requires RPC.
   */
  async getBalance(): Promise<bigint> {
    throw new WalletError(
      'Hardware wallets do not track balances. Use an RPC provider.',
      WalletErrorCode.UNSUPPORTED_OPERATION
    )
  }

  /**
   * Get token balance
   *
   * Note: Hardware wallets don't track balances - this requires RPC.
   */
  async getTokenBalance(_asset: Asset): Promise<bigint> {
    throw new WalletError(
      'Hardware wallets do not track balances. Use an RPC provider.',
      WalletErrorCode.UNSUPPORTED_OPERATION
    )
  }

  // ─── Account Management ─────────────────────────────────────────────────────

  /**
   * Get multiple accounts from device
   */
  async getAccounts(startIndex: number = 0, count: number = 5): Promise<HardwareAccount[]> {
    this.requireConnected()

    const accounts: HardwareAccount[] = []

    for (let i = startIndex; i < startIndex + count; i++) {
      const path = getDerivationPath(this.chain, i)
      const account = await this.getAccountAtPath(path, i)
      accounts.push(account)
    }

    return accounts
  }

  /**
   * Switch to different account index
   */
  async switchAccount(accountIndex: number): Promise<HardwareAccount> {
    this.requireConnected()

    this._derivationPath = getDerivationPath(this.chain, accountIndex)
    this._account = await this.getAccountFromDevice()

    const previousAddress = this._address
    this.setConnected(this._account.address, this._account.publicKey)

    if (previousAddress !== this._account.address) {
      this.emitAccountChanged(previousAddress, this._account.address)
    }

    return this._account
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  /**
   * Initialize Trezor Connect
   */
  private async initializeTrezorConnect(): Promise<void> {
    if (this.initialized) return

    try {
      // Dynamic import of Trezor Connect
      // @ts-expect-error - Dynamic import
      const TrezorConnect = await import('@trezor/connect-web')
      this.trezorConnect = TrezorConnect.default

      // Initialize with manifest
      await this.trezorConnect.init({
        manifest: {
          email: this.config.manifestEmail!,
          appUrl: this.config.manifestUrl!,
        },
        popup: this.config.popup,
      })

      this.initialized = true
    } catch (error) {
      throw new HardwareWalletError(
        'Failed to load Trezor Connect. Install @trezor/connect-web',
        HardwareErrorCode.TRANSPORT_ERROR,
        'trezor',
        error
      )
    }
  }

  /**
   * Get device features
   */
  private async getDeviceFeatures(): Promise<TrezorFeatures> {
    if (!this.trezorConnect) {
      throw new HardwareWalletError(
        'Trezor Connect not initialized',
        HardwareErrorCode.TRANSPORT_ERROR,
        'trezor'
      )
    }

    const result = await this.trezorConnect.getFeatures()

    if (!result.success) {
      throw new HardwareWalletError(
        result.payload.error ?? 'Failed to get device features',
        HardwareErrorCode.TRANSPORT_ERROR,
        'trezor'
      )
    }

    return {
      model: result.payload.model,
      firmwareVersion: `${result.payload.major_version}.${result.payload.minor_version}.${result.payload.patch_version}`,
      label: result.payload.label ?? undefined,
      deviceId: result.payload.device_id ?? undefined,
      pinProtection: result.payload.pin_protection ?? false,
      pinCached: result.payload.pin_cached ?? false,
    }
  }

  /**
   * Get account from device at current derivation path
   */
  private async getAccountFromDevice(): Promise<HardwareAccount> {
    return this.getAccountAtPath(this._derivationPath, this.config.accountIndex ?? 0)
  }

  /**
   * Get account at specific derivation path
   */
  private async getAccountAtPath(path: string, index: number): Promise<HardwareAccount> {
    if (!this.trezorConnect) {
      throw new HardwareWalletError(
        'Trezor Connect not initialized',
        HardwareErrorCode.TRANSPORT_ERROR,
        'trezor'
      )
    }

    if (this.chain === 'ethereum') {
      const result = await this.trezorConnect.ethereumGetAddress({
        path,
        showOnTrezor: false,
      })

      if (!result.success) {
        throw new HardwareWalletError(
          result.payload.error ?? 'Failed to get address',
          HardwareErrorCode.TRANSPORT_ERROR,
          'trezor'
        )
      }

      return {
        address: result.payload.address,
        publicKey: result.payload.address as HexString, // Trezor returns address, not public key for Ethereum
        derivationPath: path,
        index,
        chain: this.chain,
      }
    }

    throw new HardwareWalletError(
      `Chain ${this.chain} not supported by Trezor adapter`,
      HardwareErrorCode.UNSUPPORTED,
      'trezor'
    )
  }

  /**
   * Sign message on device
   */
  private async signMessageOnDevice(message: Uint8Array): Promise<HardwareSignature> {
    if (!this.trezorConnect) {
      throw new HardwareWalletError(
        'Trezor Connect not initialized',
        HardwareErrorCode.TRANSPORT_ERROR,
        'trezor'
      )
    }

    if (this.chain === 'ethereum') {
      const messageHex = `0x${Buffer.from(message).toString('hex')}`

      const result = await this.trezorConnect.ethereumSignMessage({
        path: this._derivationPath,
        message: messageHex,
        hex: true,
      })

      if (!result.success) {
        throw new HardwareWalletError(
          result.payload.error ?? 'Failed to sign message',
          HardwareErrorCode.USER_REJECTED,
          'trezor'
        )
      }

      return {
        r: '0x' as HexString,
        s: '0x' as HexString,
        v: 0,
        signature: `0x${result.payload.signature}` as HexString,
      }
    }

    throw new HardwareWalletError(
      `Message signing not supported for ${this.chain}`,
      HardwareErrorCode.UNSUPPORTED,
      'trezor'
    )
  }

  /**
   * Sign transaction on device
   */
  private async signTransactionOnDevice(tx: UnsignedTransaction): Promise<HardwareSignature> {
    if (!this.trezorConnect) {
      throw new HardwareWalletError(
        'Trezor Connect not initialized',
        HardwareErrorCode.TRANSPORT_ERROR,
        'trezor'
      )
    }

    if (this.chain === 'ethereum') {
      const ethTx = tx.data as HardwareEthereumTx

      const result = await this.trezorConnect.ethereumSignTransaction({
        path: this._derivationPath,
        transaction: {
          to: ethTx.to,
          value: ethTx.value,
          gasLimit: ethTx.gasLimit,
          gasPrice: ethTx.gasPrice,
          nonce: ethTx.nonce,
          data: ethTx.data ?? '0x',
          chainId: ethTx.chainId,
        },
      })

      if (!result.success) {
        throw new HardwareWalletError(
          result.payload.error ?? 'Failed to sign transaction',
          HardwareErrorCode.USER_REJECTED,
          'trezor'
        )
      }

      return {
        r: `0x${result.payload.r}` as HexString,
        s: `0x${result.payload.s}` as HexString,
        v: parseInt(result.payload.v, 16),
        signature: `0x${result.payload.r}${result.payload.s}${result.payload.v}` as HexString,
      }
    }

    throw new HardwareWalletError(
      `Transaction signing not supported for ${this.chain}`,
      HardwareErrorCode.UNSUPPORTED,
      'trezor'
    )
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: unknown): Error {
    if (error instanceof HardwareWalletError) {
      return error
    }

    if (error instanceof WalletError) {
      return error
    }

    const err = error as { code?: string; message?: string }

    // Trezor Connect error codes
    if (err.code) {
      switch (err.code) {
        case 'Failure_ActionCancelled':
        case 'Method_Cancel':
          return new HardwareWalletError(
            'Action cancelled on device',
            HardwareErrorCode.USER_REJECTED,
            'trezor'
          )
        case 'Failure_PinCancelled':
          return new HardwareWalletError(
            'PIN entry cancelled',
            HardwareErrorCode.USER_REJECTED,
            'trezor'
          )
        case 'Device_CallInProgress':
          return new HardwareWalletError(
            'Another operation in progress',
            HardwareErrorCode.TRANSPORT_ERROR,
            'trezor'
          )
      }
    }

    if (err.message?.includes('cancelled') || err.message?.includes('Cancelled')) {
      return new HardwareWalletError(
        'Operation cancelled',
        HardwareErrorCode.USER_REJECTED,
        'trezor'
      )
    }

    if (err.message?.includes('not found') || err.message?.includes('No device')) {
      return new HardwareWalletError(
        'Trezor device not found',
        HardwareErrorCode.DEVICE_NOT_FOUND,
        'trezor'
      )
    }

    return new HardwareWalletError(
      err.message ?? 'Unknown Trezor error',
      HardwareErrorCode.TRANSPORT_ERROR,
      'trezor',
      error
    )
  }
}

// ─── Type Stubs for Dynamic Imports ───────────────────────────────────────────

/**
 * Trezor Connect type stub
 */
interface TrezorConnectType {
  init(params: {
    manifest: { email: string; appUrl: string }
    popup?: boolean
  }): Promise<void>

  getFeatures(): Promise<TrezorResponse<TrezorFeaturesPayload>>

  ethereumGetAddress(params: {
    path: string
    showOnTrezor?: boolean
  }): Promise<TrezorResponse<{ address: string }>>

  ethereumSignMessage(params: {
    path: string
    message: string
    hex?: boolean
  }): Promise<TrezorResponse<{ signature: string }>>

  ethereumSignTransaction(params: {
    path: string
    transaction: {
      to: string
      value: HexString
      gasLimit: HexString
      gasPrice?: HexString
      nonce: HexString
      data?: HexString
      chainId: number
    }
  }): Promise<TrezorResponse<{ r: string; s: string; v: string }>>
}

/**
 * Trezor response wrapper
 */
interface TrezorResponse<T> {
  success: boolean
  payload: T | { error: string }
}

/**
 * Trezor device features payload
 */
interface TrezorFeaturesPayload {
  model?: string
  major_version?: number
  minor_version?: number
  patch_version?: number
  label?: string
  device_id?: string
  pin_protection?: boolean
  pin_cached?: boolean
}

/**
 * Parsed Trezor features
 */
interface TrezorFeatures {
  model?: string
  firmwareVersion?: string
  label?: string
  deviceId?: string
  pinProtection: boolean
  pinCached: boolean
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a Trezor wallet adapter
 */
export function createTrezorAdapter(config: TrezorConfig): TrezorWalletAdapter {
  return new TrezorWalletAdapter(config)
}
