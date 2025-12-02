# Private Swap Example

Execute cross-chain swaps with privacy using SIP Protocol and NEAR Intents.

## What This Example Demonstrates

1. **Create Shielded Intent** - Build a swap request with hidden amounts
2. **Get Quotes** - Fetch real quotes from NEAR 1Click API
3. **Execute Swap** - Submit the shielded intent for fulfillment
4. **Track Status** - Monitor the swap until completion

## Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- (Optional) Wallet with funds for real swaps

## Quick Start

```bash
# Install dependencies
pnpm install

# Run the simulation (no real funds)
npx ts-node index.ts

# Run with real quotes from mainnet
LIVE_QUOTES=true npx ts-node index.ts
```

## How It Works

### Shielded Intent Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CREATE SHIELDED INTENT                                        │
│                                                                  │
│    User Request:                                                 │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ Swap 1 SOL → ETH with privacy                           │  │
│    └─────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│    Shielded Intent:                                             │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ sender:     HIDDEN (stealth address)                    │  │
│    │ amount:     HIDDEN (Pedersen commitment)                │  │
│    │ recipient:  HIDDEN (one-time address)                   │  │
│    │ proof:      ZK proof of sufficient balance              │  │
│    └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. SOLVER NETWORK (NEAR Intents)                                │
│                                                                  │
│    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│    │  Solver A   │  │  Solver B   │  │  Solver C   │           │
│    │             │  │             │  │             │           │
│    │  Sees:      │  │  Sees:      │  │  Sees:      │           │
│    │  - Intent ID│  │  - Intent ID│  │  - Intent ID│           │
│    │  - Output   │  │  - Output   │  │  - Output   │           │
│    │    token    │  │    token    │  │    token    │           │
│    │  - ZK proof │  │  - ZK proof │  │  - ZK proof │           │
│    │             │  │             │  │             │           │
│    │  CAN'T see: │  │  CAN'T see: │  │  CAN'T see: │           │
│    │  - Sender   │  │  - Sender   │  │  - Sender   │           │
│    │  - Amount   │  │  - Amount   │  │  - Amount   │           │
│    └─────────────┘  └─────────────┘  └─────────────┘           │
│                              │                                   │
│                        Best quote                                │
│                              ▼                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. FULFILLMENT                                                   │
│                                                                  │
│    Solver executes:                                              │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ 1. Verify ZK proof (balance sufficient)                 │  │
│    │ 2. Lock user's input (via Zcash shielded pool)          │  │
│    │ 3. Send output to stealth address                       │  │
│    │ 4. Generate fulfillment proof                           │  │
│    └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. COMPLETION                                                    │
│                                                                  │
│    User receives ETH at one-time stealth address                │
│    No link between source SOL and destination ETH               │
│                                                                  │
│    Chain analysts see:                                          │
│    - SOL: "sent to ???"                                         │
│    - ETH: "received from ???"                                   │
│    - No connection between the two                              │
└─────────────────────────────────────────────────────────────────┘
```

### Privacy Levels

| Level | Sender | Amount | Recipient | Use Case |
|-------|--------|--------|-----------|----------|
| `transparent` | Visible | Visible | Visible | Testing, public transactions |
| `shielded` | Hidden | Hidden | Hidden | Maximum privacy |
| `compliant` | Hidden | Hidden | Hidden* | Institutional (auditor can view) |

*With viewing key for authorized auditors

## Code Walkthrough

### 1. Create Shielded Intent

```typescript
import { SIP, PrivacyLevel, IntentBuilder } from '@sip-protocol/sdk'

const sip = new SIP({ network: 'mainnet' })

const intent = new IntentBuilder()
  .from({ chain: 'solana', token: 'SOL', amount: 1_000_000_000n }) // 1 SOL
  .to({ chain: 'ethereum', token: 'ETH' })
  .withPrivacy(PrivacyLevel.SHIELDED)
  .withSlippage(0.5) // 0.5%
  .build()
```

### 2. Get Quotes

```typescript
// Fetches real quotes from NEAR 1Click API
const quotes = await sip.getQuotes(intent)

console.log(`Best quote: ${quotes[0].outputAmount} ETH`)
console.log(`Rate: ${quotes[0].rate}`)
console.log(`Solver: ${quotes[0].solver}`)
```

### 3. Execute Swap

```typescript
// Execute with the best quote
const result = await sip.execute(intent, quotes[0], {
  wallet: myWallet,
})

console.log(`Transaction ID: ${result.txId}`)
```

### 4. Track Status

```typescript
// Poll for completion
const status = await sip.getStatus(result.intentId)

if (status === 'fulfilled') {
  console.log('Swap complete!')
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LIVE_QUOTES` | Fetch real quotes from mainnet | `false` |
| `PRIVACY_LEVEL` | `transparent`, `shielded`, `compliant` | `shielded` |
| `SLIPPAGE` | Slippage tolerance (percentage) | `0.5` |

## API Reference

### NEAR 1Click Integration

SIP uses NEAR Intents via the 1Click API:

```typescript
import { OneClickClient } from '@sip-protocol/sdk'

const client = new OneClickClient({
  baseUrl: 'https://1click.chaindefuser.com',
})

// Get quote
const quote = await client.getQuote({
  inputAssetId: 'solana:mainnet:native',
  outputAssetId: 'ethereum:1:native',
  exactAmountIn: '1000000000',
})
```

## Error Handling

```typescript
try {
  const result = await sip.execute(intent, quote)
} catch (error) {
  if (error.code === 'INSUFFICIENT_BALANCE') {
    console.error('Not enough funds')
  } else if (error.code === 'QUOTE_EXPIRED') {
    console.error('Quote expired, fetch new quote')
  } else if (error.code === 'SLIPPAGE_EXCEEDED') {
    console.error('Price moved too much')
  }
}
```

## Security Notes

1. **Quote expiry** - Quotes are valid for ~30 seconds, execute quickly
2. **Slippage protection** - Set appropriate slippage for volatile markets
3. **Intent expiry** - Intents expire after 10 minutes by default
4. **Proof verification** - Solvers verify ZK proofs before fulfilling

## Next Steps

- See `examples/private-payment/` for stealth address basics
- See `examples/compliance/` for adding auditor viewing keys
- See `examples/wallet-integration/` for connecting real wallets
