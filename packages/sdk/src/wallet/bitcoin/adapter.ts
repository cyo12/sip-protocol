/**
 * Bitcoin Wallet Adapter
 *
 * Implementation of WalletAdapter for Bitcoin.
 * Supports Unisat, Xverse, Leather, and OKX wallets.
 */

import type {
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
import type {
  UnisatAPI,
  BitcoinAdapterConfig,
  BitcoinWalletName,
  BitcoinNetwork,
  BitcoinAddress,
  BitcoinBalance,
  SignPsbtOptions,
} from './types'
import {
  getBitcoinProvider,
  bitcoinPublicKeyToHex,
  isValidTaprootAddress,
} from './types'

/**
 * Bitcoin wallet adapter
 *
 * Provides SIP-compatible wallet interface for Bitcoin.
 * Works with Unisat, OKX, Xverse, and Leather wallets.
 *
 * @example Browser usage with Unisat
 * ```typescript
 * const wallet = new BitcoinWalletAdapter({ wallet: 'unisat' })
 * await wallet.connect()
 *
 * const balance = await wallet.getBalance()
 * console.log(`Balance: ${balance} sats`)
 *
 * // Sign a message
 * const sig = await wallet.signMessage(new TextEncoder().encode('Hello Bitcoin'))
 * ```
 *
 * @example With custom network
 * ```typescript
 * const wallet = new BitcoinWalletAdapter({
 *   wallet: 'unisat',
 *   network: 'testnet',
 * })
 * ```
 */
export class BitcoinWalletAdapter extends BaseWalletAdapter {
  readonly chain = 'bitcoin' as const
  readonly name: string

  private provider: UnisatAPI | undefined
  private walletName: BitcoinWalletName
  private network: BitcoinNetwork

  constructor(config: BitcoinAdapterConfig = {}) {
    super()
    this.walletName = config.wallet ?? 'unisat'
    this.name = `bitcoin-${this.walletName}`
    this.network = config.network ?? 'livenet'

    // Allow injecting provider for testing
    if (config.provider) {
      this.provider = config.provider
    }
  }

  /**
   * Get the current Bitcoin network
   */
  getNetwork(): BitcoinNetwork {
    return this.network
  }

  /**
   * Set the Bitcoin network
   */
  async setNetwork(network: BitcoinNetwork): Promise<void> {
    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      await this.provider.switchNetwork(network)
      this.network = network
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to switch network'
      throw new WalletError(message, WalletErrorCode.UNKNOWN, { cause: error as Error })
    }
  }

  /**
   * Connect to the wallet
   */
  async connect(): Promise<void> {
    this._connectionState = 'connecting'

    try {
      // Get provider if not already set
      if (!this.provider) {
        this.provider = getBitcoinProvider(this.walletName)
      }

      if (!this.provider) {
        this.setError(
          WalletErrorCode.NOT_INSTALLED,
          `${this.walletName} wallet is not installed`
        )
        throw new WalletError(
          `${this.walletName} wallet is not installed`,
          WalletErrorCode.NOT_INSTALLED
        )
      }

      // Request account access
      const accounts = await this.provider.requestAccounts()

      if (!accounts || accounts.length === 0) {
        throw new WalletError(
          'No accounts returned from wallet',
          WalletErrorCode.CONNECTION_FAILED
        )
      }

      // Get the first account (Taproot address)
      const address = accounts[0]

      // Validate Taproot address format
      if (!isValidTaprootAddress(address, this.network)) {
        throw new WalletError(
          `Invalid Taproot address format: ${address}`,
          WalletErrorCode.CONNECTION_FAILED
        )
      }

      // Get public key
      const publicKey = await this.provider.getPublicKey()
      const hexPubKey = bitcoinPublicKeyToHex(publicKey)

      // Update state
      this.setConnected(address, hexPubKey)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed'

      // Check if user rejected
      if (message.includes('User rejected') || message.includes('rejected') || message.includes('cancelled')) {
        this.setError(WalletErrorCode.CONNECTION_REJECTED, message)
        throw new WalletError(message, WalletErrorCode.CONNECTION_REJECTED)
      }

      this.setError(WalletErrorCode.CONNECTION_FAILED, message)
      throw error instanceof WalletError
        ? error
        : new WalletError(message, WalletErrorCode.CONNECTION_FAILED, { cause: error as Error })
    }
  }

  /**
   * Disconnect from the wallet
   */
  async disconnect(): Promise<void> {
    this.setDisconnected('User disconnected')
    // Note: Unisat doesn't have a disconnect method
    // The wallet remains accessible but we clear our state
  }

  /**
   * Sign a message
   *
   * Uses BIP-322 simple signature format by default
   */
  async signMessage(message: Uint8Array): Promise<Signature> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      // Convert message to string (Unisat expects string)
      const messageStr = new TextDecoder().decode(message)

      // Sign using BIP-322 simple format (preferred for Taproot)
      const signature = await this.provider.signMessage(messageStr, 'bip322-simple')

      // Signature is returned as base64, convert to hex
      const sigBytes = Buffer.from(signature, 'base64')

      return {
        signature: ('0x' + sigBytes.toString('hex')) as HexString,
        publicKey: this._publicKey as HexString,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'

      if (message.includes('User rejected') || message.includes('rejected') || message.includes('cancelled')) {
        throw new WalletError(message, WalletErrorCode.SIGNING_REJECTED)
      }

      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Sign a PSBT (Partially Signed Bitcoin Transaction)
   *
   * The transaction data should be a PSBT in hex format
   */
  async signTransaction(tx: UnsignedTransaction): Promise<SignedTransaction> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      // Extract PSBT from transaction data
      const psbtHex = tx.data as string
      const options = tx.metadata?.signPsbtOptions as SignPsbtOptions | undefined

      // Sign PSBT
      const signedPsbt = await this.provider.signPsbt(psbtHex, options)

      return {
        unsigned: tx,
        signatures: [
          {
            signature: ('0x' + signedPsbt) as HexString,
            publicKey: this._publicKey as HexString,
          },
        ],
        serialized: ('0x' + signedPsbt) as HexString,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signing failed'

      if (message.includes('User rejected') || message.includes('rejected') || message.includes('cancelled')) {
        throw new WalletError(message, WalletErrorCode.SIGNING_REJECTED)
      }

      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Sign and send a PSBT
   *
   * Note: This signs the PSBT and broadcasts the finalized transaction
   */
  async signAndSendTransaction(tx: UnsignedTransaction): Promise<TransactionReceipt> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      // First, sign the transaction
      const signed = await this.signTransaction(tx)

      // Extract the signed PSBT hex (without 0x prefix)
      const signedPsbt = signed.serialized.slice(2)

      // If PSBT is not finalized, we need to finalize it
      // For now, assume it's finalized (autoFinalized: true in options)
      // TODO: Add PSBT finalization logic here

      // Broadcast the transaction
      const txid = await this.provider.pushTx(signedPsbt)

      return {
        txHash: ('0x' + txid) as HexString,
        status: 'pending', // Transaction is broadcast but not confirmed
        timestamp: Date.now(),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction failed'

      if (message.includes('User rejected') || message.includes('rejected') || message.includes('cancelled')) {
        throw new WalletError(message, WalletErrorCode.TRANSACTION_REJECTED)
      }

      if (message.includes('insufficient') || message.includes('Insufficient')) {
        throw new WalletError(message, WalletErrorCode.INSUFFICIENT_FUNDS)
      }

      throw new WalletError(message, WalletErrorCode.TRANSACTION_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Get native BTC balance
   */
  async getBalance(): Promise<bigint> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const balance = await this.provider.getBalance()
      return BigInt(balance.total)
    } catch (error) {
      throw new WalletError(
        'Failed to get balance',
        WalletErrorCode.UNKNOWN,
        { cause: error as Error }
      )
    }
  }

  /**
   * Get token balance
   *
   * For Bitcoin, this would return balance of inscriptions or BRC-20 tokens
   * Not implemented yet - returns 0
   */
  async getTokenBalance(asset: Asset): Promise<bigint> {
    this.requireConnected()

    if (asset.chain !== 'bitcoin') {
      throw new WalletError(
        `Asset chain ${asset.chain} not supported by Bitcoin adapter`,
        WalletErrorCode.UNSUPPORTED_CHAIN
      )
    }

    // TODO: Implement BRC-20 token balance query
    // For now, return 0
    return 0n
  }

  /**
   * Get Bitcoin addresses
   *
   * Returns the current Taproot address with metadata
   */
  async getAddresses(): Promise<BitcoinAddress[]> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const accounts = await this.provider.getAccounts()
      const publicKey = await this.provider.getPublicKey()

      return accounts.map((address) => ({
        address,
        publicKey,
        type: 'p2tr' as const, // Unisat uses Taproot by default
      }))
    } catch (error) {
      throw new WalletError(
        'Failed to get addresses',
        WalletErrorCode.UNKNOWN,
        { cause: error as Error }
      )
    }
  }

  /**
   * Get detailed balance information
   */
  async getBalanceDetails(): Promise<BitcoinBalance> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      const balance = await this.provider.getBalance()
      return {
        confirmed: BigInt(balance.confirmed),
        unconfirmed: BigInt(balance.unconfirmed),
        total: BigInt(balance.total),
      }
    } catch (error) {
      throw new WalletError(
        'Failed to get balance details',
        WalletErrorCode.UNKNOWN,
        { cause: error as Error }
      )
    }
  }

  /**
   * Sign a PSBT directly
   *
   * Bitcoin-specific method for PSBT signing with options
   */
  async signPsbt(psbtHex: string, options?: SignPsbtOptions): Promise<string> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      return await this.provider.signPsbt(psbtHex, options)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PSBT signing failed'

      if (message.includes('User rejected') || message.includes('rejected') || message.includes('cancelled')) {
        throw new WalletError(message, WalletErrorCode.SIGNING_REJECTED)
      }

      throw new WalletError(message, WalletErrorCode.SIGNING_FAILED, {
        cause: error as Error,
      })
    }
  }

  /**
   * Push a raw transaction to the network
   *
   * Bitcoin-specific method for broadcasting transactions
   */
  async pushTx(rawTx: string): Promise<string> {
    this.requireConnected()

    if (!this.provider) {
      throw new WalletError('Provider not available', WalletErrorCode.NOT_CONNECTED)
    }

    try {
      return await this.provider.pushTx(rawTx)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transaction broadcast failed'

      if (message.includes('insufficient') || message.includes('Insufficient')) {
        throw new WalletError(message, WalletErrorCode.INSUFFICIENT_FUNDS)
      }

      throw new WalletError(message, WalletErrorCode.TRANSACTION_FAILED, {
        cause: error as Error,
      })
    }
  }
}

/**
 * Create a Bitcoin wallet adapter with default configuration
 */
export function createBitcoinAdapter(
  config: BitcoinAdapterConfig = {}
): BitcoinWalletAdapter {
  return new BitcoinWalletAdapter(config)
}
