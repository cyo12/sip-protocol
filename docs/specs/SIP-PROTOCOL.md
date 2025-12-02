# SIP-PROTOCOL: Shielded Intents Protocol Specification

| Field | Value |
|-------|-------|
| **SIP** | 1 |
| **Title** | Shielded Intents Protocol Core Specification |
| **Authors** | SIP Protocol Team |
| **Status** | Draft |
| **Created** | 2024-11-01 |
| **Updated** | 2025-12-02 |
| **Version** | 0.1.0 |

## Abstract

The Shielded Intents Protocol (SIP) defines a standard for privacy-preserving cross-chain transactions using intent-based architecture. SIP enables users to express their desired transaction outcomes while hiding sensitive information (sender, amount, recipient) using cryptographic primitives. The protocol supports three privacy levels: transparent, shielded, and compliant, allowing users to balance privacy with regulatory requirements.

## Motivation

Current cross-chain transaction protocols expose sensitive information on-chain:
- **Sender addresses** are visible, enabling surveillance and front-running
- **Transaction amounts** are public, revealing financial positions
- **Recipient addresses** can be correlated to build transaction graphs

These privacy leaks have real consequences:
- Targeted attacks on known high-value wallets
- Front-running of large trades by MEV extractors
- Compliance risks when transaction history is exposed
- Loss of fungibility when coins become "tainted"

SIP addresses these issues by providing privacy as a first-class feature while maintaining compatibility with existing intent settlement infrastructure (NEAR Intents) and enabling selective disclosure for compliance.

## Specification

### 1. Protocol Overview

SIP operates as a privacy layer between applications and settlement networks:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  APPLICATION LAYER                                                          │
│  Wallets, DEXs, DAOs, Payment Apps                                         │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ createShieldedIntent()
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SIP PROTOCOL LAYER                                                         │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐        │
│  │ Stealth Addresses │ │ Pedersen Commits  │ │ Viewing Keys      │        │
│  │ (unlinkability)   │ │ (amount hiding)   │ │ (compliance)      │        │
│  └───────────────────┘ └───────────────────┘ └───────────────────┘        │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐        │
│  │ Funding Proof     │ │ Validity Proof    │ │ Fulfillment Proof │        │
│  │ (balance >= min)  │ │ (authorization)   │ │ (delivery)        │        │
│  └───────────────────┘ └───────────────────┘ └───────────────────┘        │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ ShieldedIntent
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SETTLEMENT LAYER                                                           │
│  NEAR Intents, Mina Protocol (future), Direct Settlement (future)          │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  BLOCKCHAIN LAYER                                                           │
│  Ethereum, Solana, NEAR, Zcash, Polygon, Arbitrum, Optimism, Base          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Core Data Structures

#### 2.1 ShieldedIntent

The primary data structure representing a privacy-preserving transaction intent:

```typescript
interface ShieldedIntent {
  // Identity
  intentId: string              // Unique identifier (UUID v4)
  version: string               // Protocol version (e.g., "0.1.0")

  // Privacy
  privacyLevel: PrivacyLevel    // 'transparent' | 'shielded' | 'compliant'

  // Timing
  createdAt: number             // Unix timestamp (seconds)
  expiry: number                // Unix timestamp (seconds)

  // Output specification (public)
  outputAsset: Asset            // Desired output asset
  minOutputAmount: bigint       // Minimum acceptable output
  maxSlippage: number           // Maximum slippage (0.01 = 1%)

  // Hidden inputs (via commitments)
  inputCommitment: Commitment   // Pedersen commitment to input amount
  senderCommitment: Commitment  // Pedersen commitment to sender

  // Recipient (via stealth address)
  recipientStealth: StealthAddress

  // Proofs (required for shielded/compliant)
  fundingProof?: ZKProof        // Proves balance >= minOutput
  validityProof?: ZKProof       // Proves sender authorization

  // Compliance (optional)
  viewingKeyHash?: Hash         // Identifies which key can decrypt
}
```

#### 2.2 Commitment

Pedersen commitments hide values while enabling verification:

```typescript
interface Commitment {
  value: HexString              // C = v*G + r*H (33 bytes compressed)
  blindingFactor: HexString     // Random r (32 bytes, secret)
}
```

#### 2.3 StealthAddress

One-time recipient addresses for unlinkability:

```typescript
interface StealthAddress {
  address: HexString            // One-time address (33 bytes secp256k1)
  ephemeralPublicKey: HexString // R = r*G (33 bytes, for recovery)
  viewTag: number               // First byte of shared secret (0-255)
}
```

#### 2.4 Asset

Cross-chain asset identifier:

```typescript
interface Asset {
  chain: ChainId                // 'ethereum' | 'solana' | 'near' | ...
  symbol: string                // 'ETH' | 'SOL' | 'USDC' | ...
  address: string | null        // Contract address (null for native)
  decimals: number              // Token decimals
}
```

### 3. Privacy Levels

SIP defines three privacy levels to accommodate different use cases:

| Level | Stealth | Encryption | Proofs | Viewing Key | Use Case |
|-------|---------|------------|--------|-------------|----------|
| `transparent` | No | No | No | No | Public transactions, testing |
| `shielded` | Yes | Yes | Yes | No | Maximum privacy |
| `compliant` | Yes | Yes | Yes | Yes | Privacy with audit capability |

#### 3.1 Transparent Mode

All transaction details are public. Useful for:
- Testing and development
- Public payments where privacy is not needed
- Regulatory requirements demanding full transparency

#### 3.2 Shielded Mode

Maximum privacy using:
- **Stealth addresses**: Recipient cannot be linked to their identity
- **Pedersen commitments**: Input amounts are hidden
- **ZK proofs**: Prove validity without revealing details

#### 3.3 Compliant Mode

Privacy with selective disclosure:
- All shielded mode features
- **Viewing keys**: Authorized parties can decrypt transaction details
- Use case: Institutional compliance, tax reporting, audit trails

### 4. Cryptographic Primitives

#### 4.1 Stealth Addresses

SIP implements dual-key stealth address protocol (DKSAP) following EIP-5564 patterns:

**For secp256k1 chains (Ethereum, Polygon, etc.):**
```
Generation:
1. Recipient generates meta-address: (P, Q) where P = p*G, Q = q*G
2. Sender generates ephemeral key: (r, R = r*G)
3. Shared secret: S = r*P = p*R
4. Stealth address: A = Q + H(S)*G
5. View tag: v = H(S)[0]  // First byte for efficient scanning

Recovery:
1. Recipient computes: S = p*R
2. Derives private key: a = q + H(S)
3. Verifies: a*G == A
```

**For ed25519 chains (Solana, NEAR):**
```
Generation:
1. Meta-address: (P, Q) as ed25519 points
2. Ephemeral key: (r, R) via ed25519
3. Shared secret: S = r*P (scalar multiplication)
4. Stealth address: A = Q + H(S)*G
5. Note: Derived private key is raw scalar (not seed)
```

See [STEALTH-ADDRESSES.md](./STEALTH-ADDRESSES.md) for full specification.

#### 4.2 Pedersen Commitments

SIP uses Pedersen commitments on secp256k1:

```
C = v*G + r*H

Where:
- v = value being committed (amount)
- r = random blinding factor
- G = secp256k1 generator point
- H = independent generator (NUMS construction)
```

**Generator H Construction (Nothing-Up-My-Sleeve):**
```
Domain separator: "SIP-PEDERSEN-GENERATOR-H-v1"
For counter = 0 to 255:
  x = SHA256(domain + ":" + counter)
  if valid_point(x):
    H = point_from_x(x)
    break
```

See [COMMITMENTS.md](./COMMITMENTS.md) for full specification.

#### 4.3 Viewing Keys

Hierarchical key derivation using HMAC-SHA512:

```
Master key generation:
  key = random(32 bytes)
  hash = SHA256(key)

Child derivation (BIP32-style):
  derived = HMAC-SHA512(master, child_path)
  child_key = derived[0:32]
  child_hash = SHA256(child_key)
```

See [VIEWING-KEYS.md](./VIEWING-KEYS.md) for full specification.

#### 4.4 Encryption

Transaction data encryption uses XChaCha20-Poly1305:

```
Key derivation: HKDF-SHA256(viewing_key, salt="SIP-VIEWING-KEY-ENCRYPTION-V1")
Nonce: 24 random bytes
Encryption: XChaCha20-Poly1305(key, nonce, plaintext)
```

### 5. Zero-Knowledge Proofs

SIP requires three types of ZK proofs for shielded/compliant modes:

#### 5.1 Funding Proof

Proves: `balance >= minimumRequired` without revealing balance.

See [FUNDING-PROOF.md](./FUNDING-PROOF.md) for circuit specification.

#### 5.2 Validity Proof

Proves: Intent is authorized by sender without revealing sender identity.

See [VALIDITY-PROOF.md](./VALIDITY-PROOF.md) for circuit specification.

#### 5.3 Fulfillment Proof

Proves: Solver delivered correct output to correct recipient.

See [FULFILLMENT-PROOF.md](./FULFILLMENT-PROOF.md) for circuit specification.

### 6. Intent Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          INTENT LIFECYCLE                                 │
└──────────────────────────────────────────────────────────────────────────┘

1. CREATION
   User → createShieldedIntent(params)
   - Validate inputs
   - Generate stealth address for recipient
   - Create Pedersen commitments
   - Generate ZK proofs (if shielded/compliant)
   - Return ShieldedIntent

2. SUBMISSION
   User → submit(intent)
   - Verify proofs (if required)
   - Publish to solver network
   - Status: PENDING

3. QUOTING
   Solver → requestQuote(intent)
   - Solver sees: outputAsset, minAmount, maxSlippage, expiry
   - Solver cannot see: sender, input amount, recipient
   - Return: Quote with exchange rate

4. ACCEPTANCE
   User → acceptQuote(quote)
   - Verify quote meets minOutput
   - Lock funds (if not already)
   - Status: ACCEPTED

5. FULFILLMENT
   Solver → fulfill(intent, quote)
   - Execute cross-chain swap
   - Deliver to stealth address
   - Generate fulfillment proof
   - Status: FULFILLED

6. COMPLETION
   Protocol → verifyFulfillment(proof)
   - Verify fulfillment proof
   - Release funds to solver
   - Status: COMPLETED
```

### 7. Supported Chains

SIP supports the following chains:

| Chain | ChainId | Curve | Stealth Support |
|-------|---------|-------|-----------------|
| Ethereum | `ethereum` | secp256k1 | Full |
| Polygon | `polygon` | secp256k1 | Full |
| Arbitrum | `arbitrum` | secp256k1 | Full |
| Optimism | `optimism` | secp256k1 | Full |
| Base | `base` | secp256k1 | Full |
| Solana | `solana` | ed25519 | Full |
| NEAR | `near` | ed25519 | Full |
| Zcash | `zcash` | secp256k1 | Native shielded |

### 8. Error Handling

SIP defines the following error codes:

| Code | Name | Description |
|------|------|-------------|
| `E001` | `INVALID_INPUT` | Invalid parameter value |
| `E002` | `INVALID_PRIVACY_LEVEL` | Unknown privacy level |
| `E003` | `MISSING_REQUIRED` | Required parameter missing |
| `E004` | `PROOF_GENERATION_FAILED` | ZK proof generation failed |
| `E005` | `PROOF_VERIFICATION_FAILED` | ZK proof verification failed |
| `E006` | `INTENT_EXPIRED` | Intent TTL exceeded |
| `E007` | `INSUFFICIENT_BALANCE` | Balance < minimum required |
| `E008` | `DECRYPTION_FAILED` | Viewing key decryption failed |
| `E009` | `CRYPTO_FAILED` | Cryptographic operation failed |

## Security Considerations

### Cryptographic Assumptions

SIP security relies on:

1. **Discrete Logarithm Problem (DLP)**: Security of stealth addresses and commitments
2. **Computational Diffie-Hellman (CDH)**: Shared secret derivation
3. **Random Oracle Model**: Hash function security (SHA-256, Keccak-256)
4. **AEAD Security**: XChaCha20-Poly1305 authenticated encryption

### Privacy Guarantees

| Property | Transparent | Shielded | Compliant |
|----------|-------------|----------|-----------|
| Sender hidden | No | Yes | Yes* |
| Amount hidden | No | Yes | Yes* |
| Recipient hidden | No | Yes | Yes* |
| Unlinkable addresses | No | Yes | Yes |

*Visible to viewing key holders

### Known Limitations

1. **Timing analysis**: Transaction timing may leak information
2. **Amount inference**: Output amount is visible, may reveal input bounds
3. **Graph analysis**: Sophisticated analysis may correlate transactions
4. **Oracle trust**: Fulfillment proofs require trusted oracle attestations

### Recommendations

1. Use shielded mode for sensitive transactions
2. Rotate stealth meta-addresses periodically
3. Use compliant mode when regulatory disclosure is required
4. Implement transaction batching to reduce timing correlation

## Test Vectors

### Stealth Address Generation (secp256k1)

```
Input:
  spending_private: 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
  viewing_private:  0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210
  chain: ethereum

Output:
  spending_public:  0x02... (33 bytes)
  viewing_public:   0x03... (33 bytes)
  encoded: sip:ethereum:0x02...:0x03...
```

### Pedersen Commitment

```
Input:
  value: 1000000000000000000  (1 ETH in wei)
  blinding: 0x... (32 random bytes)

Output:
  commitment: 0x02... (33 bytes compressed point)
```

## Reference Implementation

The reference implementation is available at:
- SDK: `@sip-protocol/sdk`
- Types: `@sip-protocol/types`
- Repository: https://github.com/sip-protocol/sip-protocol

## Appendix A: Encoding Formats

### Stealth Meta-Address Encoding

```
Format: sip:<chain>:<spendingKey>:<viewingKey>

Example (secp256k1):
sip:ethereum:0x02abc...123:0x03def...456

Example (ed25519):
sip:solana:0xabc...123:0xdef...456
```

### HexString Format

All hex strings use lowercase with `0x` prefix:
- Valid: `0xabcdef123456`
- Invalid: `0xABCDEF123456` (uppercase)
- Invalid: `abcdef123456` (no prefix)

## Appendix B: Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2024-11-01 | Initial specification |
| 0.1.1 | 2025-12-02 | Added ed25519 stealth addresses for Solana/NEAR |

## Copyright

This specification is released under the MIT License.
