# Compliance Reporting Example

Demonstrate selective disclosure using viewing keys for regulatory compliance.

## What This Example Demonstrates

1. **Generate Viewing Keys** - Create master and derived viewing keys
2. **Encrypt Transaction Data** - Encrypt transaction details for authorized parties
3. **Auditor Disclosure** - Auditor decrypts and views transaction details
4. **Selective Disclosure** - Show only what's necessary for compliance

## Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)

## Quick Start

```bash
# Install dependencies
pnpm install

# Run the example
npx ts-node index.ts
```

## How It Works

### Viewing Key Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ ORGANIZATION (DAO, Institution, Company)                        │
│                                                                  │
│  Master Viewing Key                                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ key: 0xabc...123                                            │ │
│  │ path: m/0                                                   │ │
│  │ hash: 0xdef...456 (public identifier)                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│     ┌────────────────────────┼────────────────────────┐         │
│     │                        │                        │         │
│     ▼                        ▼                        ▼         │
│  ┌──────────┐          ┌──────────┐          ┌──────────┐       │
│  │ auditor/ │          │ tax/     │          │ legal/   │       │
│  │ 2024     │          │ q1-2024  │          │ case-123 │       │
│  └──────────┘          └──────────┘          └──────────┘       │
│                                                                  │
│  Each derived key can only view transactions tagged with its    │
│  specific path. Cannot derive parent or sibling keys.           │
└─────────────────────────────────────────────────────────────────┘
```

### Privacy Levels

| Level | On-Chain | Solvers | Auditors |
|-------|----------|---------|----------|
| `transparent` | All visible | All visible | N/A |
| `shielded` | Nothing visible | Commitment only | Nothing |
| `compliant` | Nothing visible | Commitment only | Full details |

### Encryption Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. TRANSACTION CREATION                                          │
│                                                                  │
│    Transaction Data:                                            │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ sender:    "0x1234...abcd"                              │  │
│    │ recipient: "0x5678...efgh"                              │  │
│    │ amount:    "1000.00 USDC"                               │  │
│    │ timestamp: 1701388800                                   │  │
│    └─────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│    Encryption (XChaCha20-Poly1305):                             │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ key = HKDF(viewing_key, "SIP-VIEWING-KEY-ENCRYPTION-V1")│  │
│    │ nonce = random(24 bytes)                                │  │
│    │ ciphertext = encrypt(data, key, nonce)                  │  │
│    └─────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│    Encrypted Transaction:                                       │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ ciphertext:     "0x8a7b3c..."                           │  │
│    │ nonce:          "0x4d5e6f..."                           │  │
│    │ viewingKeyHash: "0xdef...456"                           │  │
│    └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Store encrypted data
                              │ (on-chain or off-chain)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. AUDITOR DISCLOSURE                                            │
│                                                                  │
│    Auditor receives viewing key (out-of-band):                  │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ viewing_key shared via secure channel                   │  │
│    │ (encrypted email, in-person, secure messaging)          │  │
│    └─────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│    Decryption:                                                  │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ 1. Check viewingKeyHash matches                         │  │
│    │ 2. Derive encryption key from viewing key               │  │
│    │ 3. Decrypt ciphertext with AEAD verification            │  │
│    │ 4. Parse JSON transaction data                          │  │
│    └─────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│    Auditor sees full transaction details                        │
└─────────────────────────────────────────────────────────────────┘
```

## Code Walkthrough

### 1. Generate Viewing Keys

```typescript
import {
  generateViewingKey,
  deriveViewingKey,
} from '@sip-protocol/sdk'

// Master viewing key (keep secure)
const masterKey = generateViewingKey('m/0')

// Derive auditor-specific key
const auditorKey = deriveViewingKey(masterKey, 'auditor/2024')

// Derive keys for different purposes
const taxKey = deriveViewingKey(masterKey, 'tax/q1-2024')
const legalKey = deriveViewingKey(masterKey, 'legal/case-123')
```

### 2. Encrypt Transaction Data

```typescript
import { encryptForViewing, type TransactionData } from '@sip-protocol/sdk'

const txData: TransactionData = {
  sender: '0x1234...abcd',
  recipient: '0x5678...efgh',
  amount: '1000.00',
  timestamp: Date.now(),
}

// Encrypt for specific viewing key holder
const encrypted = encryptForViewing(txData, auditorKey)

// Store encrypted.ciphertext and encrypted.nonce
// Share encrypted.viewingKeyHash to identify which key can decrypt
```

### 3. Auditor Decrypts

```typescript
import { decryptWithViewing } from '@sip-protocol/sdk'

// Auditor receives viewing key through secure channel
const receivedKey = auditorKey

// Verify key hash matches
if (encrypted.viewingKeyHash !== receivedKey.hash) {
  throw new Error('Wrong viewing key')
}

// Decrypt transaction details
const txData = decryptWithViewing(encrypted, receivedKey)

console.log(`Sender: ${txData.sender}`)
console.log(`Recipient: ${txData.recipient}`)
console.log(`Amount: ${txData.amount}`)
```

### 4. Selective Disclosure

```typescript
// Give auditor only 2024 transactions
const auditor2024Key = deriveViewingKey(masterKey, 'auditor/2024')

// Encrypt each transaction with year-specific key
const encrypted2024Txs = transactions2024.map(tx =>
  encryptForViewing(tx, auditor2024Key)
)

// Auditor can ONLY see 2024 transactions
// Cannot derive 2023 or 2025 keys from 2024 key
```

## Security Properties

| Property | Guarantee |
|----------|-----------|
| **Confidentiality** | Only viewing key holders can decrypt |
| **Integrity** | AEAD prevents tampering |
| **Non-correlation** | Different paths = unrelated keys |
| **One-way derivation** | Child key cannot derive parent |
| **Selective scope** | Each key only reveals its scope |

## Use Cases

### DAO Treasury

```typescript
// DAO creates master key (multisig controls)
const daoMasterKey = generateViewingKey('m/dao-treasury')

// Derive keys for different auditors
const annualAuditKey = deriveViewingKey(daoMasterKey, 'audit/2024')
const taxComplianceKey = deriveViewingKey(daoMasterKey, 'tax/irs/2024')
const grantReportingKey = deriveViewingKey(daoMasterKey, 'grants/ethereum-foundation')
```

### Institution KYC

```typescript
// Institution creates compliance viewing key
const kycKey = generateViewingKey('m/kyc')

// Derive for specific regulators
const secKey = deriveViewingKey(kycKey, 'sec/registration')
const fincenKey = deriveViewingKey(kycKey, 'fincen/sar')
```

### Personal Tax Reporting

```typescript
// Individual creates tax viewing key
const taxKey = generateViewingKey('m/personal/tax')

// Share with accountant
const accountantKey = deriveViewingKey(taxKey, 'accountant/2024')

// Share with IRS if audited
const irsAuditKey = deriveViewingKey(taxKey, 'irs-audit/2024')
```

## API Reference

### `generateViewingKey(path?: string)`

Create a new random viewing key.

### `deriveViewingKey(masterKey, childPath)`

Derive a child key using HMAC-SHA512 (BIP32-style).

### `encryptForViewing(data, viewingKey)`

Encrypt transaction data using XChaCha20-Poly1305.

### `decryptWithViewing(encrypted, viewingKey)`

Decrypt and verify transaction data.

## Error Handling

```typescript
try {
  const data = decryptWithViewing(encrypted, viewingKey)
} catch (error) {
  if (error.code === 'DECRYPTION_FAILED') {
    // Wrong key or tampered data
    console.error('Cannot decrypt - wrong viewing key?')
  }
}
```

## Best Practices

1. **Backup master keys** - Store securely, consider multisig for organizations
2. **Rotate derived keys** - Create time-bound keys (e.g., `audit/2024`)
3. **Minimize scope** - Only derive keys for specific needs
4. **Secure transmission** - Share viewing keys via encrypted channels
5. **Audit key usage** - Log when keys are used for accountability

## Next Steps

- See `examples/private-payment/` for stealth address basics
- See `examples/private-swap/` for cross-chain swaps with privacy
- See `examples/wallet-integration/` for connecting real wallets
