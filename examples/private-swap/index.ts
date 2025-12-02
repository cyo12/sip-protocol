/**
 * Private Swap Example
 *
 * Demonstrates executing a cross-chain swap with privacy using SIP Protocol.
 *
 * Flow:
 * 1. Create a shielded intent (hidden sender, amount, recipient)
 * 2. Get quotes from NEAR Intents solvers
 * 3. Execute the swap
 * 4. Track fulfillment status
 *
 * Usage:
 *   npx ts-node examples/private-swap/index.ts
 *
 * With live quotes:
 *   LIVE_QUOTES=true npx ts-node examples/private-swap/index.ts
 */

import {
  // Main client
  SIP,
  createSIP,
  // Intent building
  IntentBuilder,
  createShieldedIntent,
  trackIntent,
  isExpired,
  getTimeRemaining,
  getIntentSummary,
  // Privacy
  PrivacyLevel,
  generateViewingKey,
  // Stealth addresses
  generateStealthMetaAddress,
  // Commitments
  commit,
  // Types
  type ShieldedIntent,
  type Quote,
  type HexString,
} from '@sip-protocol/sdk'

// ─── Configuration ────────────────────────────────────────────────────────────

const USE_LIVE_QUOTES = process.env.LIVE_QUOTES === 'true'
const PRIVACY_LEVEL = (process.env.PRIVACY_LEVEL as 'transparent' | 'shielded' | 'compliant') || 'shielded'
const SLIPPAGE = parseFloat(process.env.SLIPPAGE || '0.5')

// Swap configuration
const SWAP_CONFIG = {
  input: {
    chain: 'solana' as const,
    token: 'SOL',
    amount: 1_000_000_000n, // 1 SOL (9 decimals)
  },
  output: {
    chain: 'ethereum' as const,
    token: 'ETH',
  },
}

// ─── Main Example ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Private Swap Example')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`Mode: ${USE_LIVE_QUOTES ? 'LIVE QUOTES' : 'SIMULATION'}`)
  console.log(`Privacy Level: ${PRIVACY_LEVEL}`)
  console.log(`Slippage Tolerance: ${SLIPPAGE}%`)
  console.log('')

  // ─── Step 1: Initialize SIP Client ────────────────────────────────────────

  console.log('STEP 1: Initialize SIP client')
  console.log('─────────────────────────────────────────────────────────────────')

  const sip = createSIP({
    network: USE_LIVE_QUOTES ? 'mainnet' : 'testnet',
  })

  console.log(`  Network: ${USE_LIVE_QUOTES ? 'mainnet' : 'testnet'}`)
  console.log('  Client initialized ✓')
  console.log('')

  // ─── Step 2: Generate Stealth Address for Receiving ───────────────────────

  console.log('STEP 2: Generate stealth address for receiving')
  console.log('─────────────────────────────────────────────────────────────────')

  // Generate a stealth meta-address for the output chain
  const recipientKeys = generateStealthMetaAddress(SWAP_CONFIG.output.chain)

  console.log('  Recipient stealth meta-address generated')
  console.log(`    Chain: ${recipientKeys.metaAddress.chain}`)
  console.log(`    Spending Key: ${truncate(recipientKeys.metaAddress.spendingKey)}`)
  console.log(`    Viewing Key:  ${truncate(recipientKeys.metaAddress.viewingKey)}`)
  console.log('')

  // ─── Step 3: Create Shielded Intent ───────────────────────────────────────

  console.log('STEP 3: Create shielded intent')
  console.log('─────────────────────────────────────────────────────────────────')

  // Create a Pedersen commitment to hide the amount
  const amountCommitment = commit(SWAP_CONFIG.input.amount)

  console.log('  Amount commitment created:')
  console.log(`    Hidden amount: ${SWAP_CONFIG.input.amount.toString()} (${formatAmount(SWAP_CONFIG.input.amount, 9)} SOL)`)
  console.log(`    Commitment:    ${truncate(amountCommitment.commitment)}`)
  console.log('')

  // Build the shielded intent
  const intentBuilder = new IntentBuilder()

  // For compliant mode, generate a viewing key for auditors
  let viewingKey
  if (PRIVACY_LEVEL === 'compliant') {
    viewingKey = generateViewingKey()
    console.log('  Viewing key generated for compliance:')
    console.log(`    Hash: ${truncate(viewingKey.hash)}`)
    console.log(`    Path: ${viewingKey.path}`)
    console.log('')
  }

  const intent = await createShieldedIntent({
    input: {
      chain: SWAP_CONFIG.input.chain,
      token: SWAP_CONFIG.input.token,
      amount: SWAP_CONFIG.input.amount,
    },
    output: {
      chain: SWAP_CONFIG.output.chain,
      token: SWAP_CONFIG.output.token,
    },
    privacy: PRIVACY_LEVEL,
    recipientMeta: recipientKeys.metaAddress,
    viewingKey,
    slippage: SLIPPAGE,
    expiresIn: 600, // 10 minutes
  })

  console.log('  Shielded intent created:')
  console.log(`    Intent ID:    ${intent.id}`)
  console.log(`    Privacy:      ${intent.privacy}`)
  console.log(`    Input:        ${formatAmount(SWAP_CONFIG.input.amount, 9)} ${SWAP_CONFIG.input.token}`)
  console.log(`    Output:       ${SWAP_CONFIG.output.token}`)
  console.log(`    Expires:      ${new Date(intent.expiresAt).toLocaleTimeString()}`)
  console.log('')

  // Show what's visible vs hidden
  console.log('  What observers see:')
  if (PRIVACY_LEVEL === 'transparent') {
    console.log('    ⚠  Sender: VISIBLE')
    console.log('    ⚠  Amount: VISIBLE')
    console.log('    ⚠  Recipient: VISIBLE')
  } else {
    console.log('    ✓  Sender: HIDDEN (stealth address)')
    console.log('    ✓  Amount: HIDDEN (commitment)')
    console.log('    ✓  Recipient: HIDDEN (one-time address)')
    if (PRIVACY_LEVEL === 'compliant') {
      console.log('    📋 Auditor can view with viewing key')
    }
  }
  console.log('')

  // ─── Step 4: Get Quotes ───────────────────────────────────────────────────

  console.log('STEP 4: Get quotes from solvers')
  console.log('─────────────────────────────────────────────────────────────────')

  let quotes: Quote[]

  if (USE_LIVE_QUOTES) {
    console.log('  Fetching live quotes from NEAR Intents...')
    try {
      quotes = await sip.getQuotes(intent)
      console.log(`  Received ${quotes.length} quote(s)`)
    } catch (error) {
      console.log('  ⚠ Live quotes unavailable, using simulation')
      quotes = generateMockQuotes(intent)
    }
  } else {
    console.log('  Generating simulated quotes...')
    quotes = generateMockQuotes(intent)
  }

  console.log('')
  console.log('  Available quotes:')
  quotes.forEach((quote, i) => {
    console.log(`    [${i + 1}] ${formatAmount(quote.outputAmount, 18)} ${SWAP_CONFIG.output.token}`)
    console.log(`        Rate: 1 ${SWAP_CONFIG.input.token} = ${quote.rate.toFixed(6)} ${SWAP_CONFIG.output.token}`)
    console.log(`        Solver: ${quote.solver}`)
    console.log(`        Expires: ${new Date(quote.expiresAt).toLocaleTimeString()}`)
  })
  console.log('')

  // Select best quote
  const bestQuote = quotes[0]
  console.log(`  Selected best quote: ${formatAmount(bestQuote.outputAmount, 18)} ${SWAP_CONFIG.output.token}`)
  console.log('')

  // ─── Step 5: Execute Swap (Simulated) ─────────────────────────────────────

  console.log('STEP 5: Execute swap')
  console.log('─────────────────────────────────────────────────────────────────')

  console.log('  In production, this would:')
  console.log('    1. Connect to wallet (see wallet-integration example)')
  console.log('    2. Sign the intent with your private key')
  console.log('    3. Submit to NEAR Intents')
  console.log('    4. Wait for solver fulfillment')
  console.log('')

  // Simulate execution
  console.log('  Simulating execution...')

  const simulatedResult = {
    intentId: intent.id,
    txId: `0x${randomHex(64)}`,
    status: 'pending' as const,
    submittedAt: Date.now(),
  }

  console.log(`    Intent ID: ${simulatedResult.intentId}`)
  console.log(`    Transaction: ${truncate(simulatedResult.txId)}`)
  console.log(`    Status: ${simulatedResult.status}`)
  console.log('')

  // ─── Step 6: Track Status ─────────────────────────────────────────────────

  console.log('STEP 6: Track fulfillment status')
  console.log('─────────────────────────────────────────────────────────────────')

  // Track the intent
  const tracked = trackIntent(intent, 'pending')

  console.log('  Intent tracking:')
  console.log(`    Status: ${tracked.status}`)
  console.log(`    Time remaining: ${Math.floor(getTimeRemaining(tracked) / 1000)}s`)
  console.log(`    Expired: ${isExpired(tracked) ? 'Yes' : 'No'}`)
  console.log('')

  // Simulate status updates
  const statuses = ['pending', 'matched', 'fulfilling', 'fulfilled']

  console.log('  Simulating status updates:')
  for (const status of statuses) {
    await sleep(500)
    console.log(`    [${new Date().toLocaleTimeString()}] Status: ${status}`)
  }
  console.log('')

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  const summary = getIntentSummary(intent)
  console.log('Intent summary:')
  console.log(`  ${summary}`)
  console.log('')

  console.log('What happened:')
  console.log(`  1. Created shielded intent with ${PRIVACY_LEVEL} privacy`)
  console.log(`  2. Amount hidden with Pedersen commitment`)
  console.log(`  3. Recipient protected with stealth address`)
  console.log(`  4. Fetched ${quotes.length} quote(s) from solvers`)
  console.log(`  5. Best rate: 1 ${SWAP_CONFIG.input.token} = ${bestQuote.rate.toFixed(6)} ${SWAP_CONFIG.output.token}`)
  console.log('')

  console.log('Privacy achieved:')
  console.log('  ✓ Sender identity hidden from chain observers')
  console.log('  ✓ Amount hidden from solvers and observers')
  console.log('  ✓ Recipient uses one-time stealth address')
  console.log('  ✓ No link between input and output chains')
  console.log('')

  if (PRIVACY_LEVEL === 'compliant' && viewingKey) {
    console.log('Compliance:')
    console.log('  📋 Viewing key allows auditor to see transaction details')
    console.log(`     Share viewing key hash: ${truncate(viewingKey.hash)}`)
    console.log('')
  }

  console.log('To execute real swaps, see examples/wallet-integration/')
  console.log('')
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function truncate(hex: HexString | string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 4) return hex
  return `${hex.slice(0, chars + 2)}...${hex.slice(-chars)}`
}

function formatAmount(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = amount / divisor
  const fraction = amount % divisor
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 4)
  return `${whole}.${fractionStr}`
}

function randomHex(length: number): string {
  const chars = '0123456789abcdef'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * 16)]).join('')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function generateMockQuotes(intent: ShieldedIntent): Quote[] {
  // Simulate market rates (SOL/ETH)
  const baseRate = 0.03 + Math.random() * 0.005 // ~0.03-0.035 ETH per SOL

  return [
    {
      solver: 'solver-1.near',
      inputAmount: intent.input.amount,
      outputAmount: BigInt(Math.floor(Number(intent.input.amount) * baseRate)),
      rate: baseRate,
      fee: 0.001,
      expiresAt: Date.now() + 30000, // 30 seconds
    },
    {
      solver: 'solver-2.near',
      inputAmount: intent.input.amount,
      outputAmount: BigInt(Math.floor(Number(intent.input.amount) * (baseRate * 0.995))),
      rate: baseRate * 0.995,
      fee: 0.0008,
      expiresAt: Date.now() + 30000,
    },
  ]
}

// ─── Run Example ──────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})
