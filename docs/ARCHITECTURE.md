# SIP Protocol Architecture

| Field | Value |
|-------|-------|
| **Document** | ARCHITECTURE |
| **Version** | 1.0 |
| **Status** | Draft |
| **Authors** | SIP Protocol Team |
| **Created** | 2024-11-01 |
| **Updated** | 2025-12-02 |

## Overview

SIP (Shielded Intents Protocol) is a privacy layer for cross-chain transactions. This document describes the system architecture, component relationships, and design decisions.

**One-liner**: SIP wraps blockchain intents in cryptographic privacy — stealth addresses hide recipients, Pedersen commitments hide amounts, and ZK proofs prove validity without revealing data.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Layer Overview](#2-layer-overview)
3. [Component Deep-Dives](#3-component-deep-dives)
4. [Data Flows](#4-data-flows)
5. [Design Decisions](#5-design-decisions)
6. [Integration Points](#6-integration-points)
7. [Security Architecture](#7-security-architecture)
8. [Deployment Architecture](#8-deployment-architecture)

---

## 1. System Architecture

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATIONS                                    │
│   Wallets  •  DEXs  •  DAOs  •  Payments  •  NFT  •  Gaming  •  Enterprise  │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     │ @sip-protocol/sdk
                                     │ "Add privacy with one import"
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SIP PROTOCOL STACK                                  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         SDK LAYER (Public API)                         │ │
│  │  SIP Client  •  IntentBuilder  •  PaymentBuilder  •  TreasuryManager   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         PRIVACY LAYER (Core)                           │ │
│  │  Stealth Addresses  •  Pedersen Commitments  •  Viewing Keys  •  ZK    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         PROOF LAYER                                    │ │
│  │  Funding Proof  •  Validity Proof  •  Fulfillment Proof  •  Noir/BB    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                     │                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         ADAPTER LAYER                                  │ │
│  │  NEAR Intents  •  Zcash RPC  •  Wallet Adapters  •  Oracle Interface   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     │ Settlement
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BLOCKCHAIN LAYER                                    │
│   Ethereum  •  Solana  •  NEAR  •  Bitcoin  •  Zcash  •  Cosmos  •  More    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Package Structure

```
@sip-protocol/
├── sdk                    # Core SDK (main package)
│   ├── src/
│   │   ├── sip.ts         # SIP client class
│   │   ├── intent.ts      # IntentBuilder
│   │   ├── stealth.ts     # Stealth address generation
│   │   ├── commitment.ts  # Pedersen commitments
│   │   ├── privacy.ts     # Viewing keys, encryption
│   │   ├── proofs/        # ZK proof providers
│   │   │   ├── interface.ts
│   │   │   ├── mock.ts
│   │   │   └── noir.ts
│   │   └── adapters/      # External integrations
│   │       ├── near/
│   │       ├── zcash/
│   │       └── wallets/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── e2e/
│
└── types                  # Shared TypeScript types
    └── src/
        ├── intent.ts
        ├── privacy.ts
        ├── stealth.ts
        └── proofs.ts
```

---

## 2. Layer Overview

### 2.1 Layer Responsibilities

| Layer | Responsibility | Key Components |
|-------|----------------|----------------|
| **SDK** | Public API, orchestration | SIP, IntentBuilder, PaymentBuilder |
| **Privacy** | Cryptographic primitives | Stealth, Commitments, ViewingKeys |
| **Proof** | Zero-knowledge proofs | ProofProvider, Noir circuits |
| **Adapter** | External system integration | NEAR, Zcash, Wallets |

### 2.2 Dependency Graph

```
                    ┌─────────────┐
                    │  SDK Layer  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ Privacy  │ │  Proof   │ │ Adapter  │
       │  Layer   │ │  Layer   │ │  Layer   │
       └────┬─────┘ └────┬─────┘ └────┬─────┘
            │            │            │
            │            │            │
            ▼            ▼            ▼
       ┌─────────────────────────────────────┐
       │         @noble/* Libraries          │
       │   curves  •  hashes  •  ciphers     │
       └─────────────────────────────────────┘
```

---

## 3. Component Deep-Dives

### 3.1 Crypto Layer

The cryptographic foundation providing privacy primitives.

#### 3.1.1 Stealth Addresses

**Purpose**: Generate one-time addresses so recipients cannot be linked across transactions.

**Algorithm**: Dual-Key Stealth Address Protocol (DKSAP)

```
┌─────────────────────────────────────────────────────────────────┐
│                    STEALTH ADDRESS GENERATION                    │
│                                                                  │
│  Recipient has:                                                  │
│    • Spending key pair: (k_spend, K_spend)                      │
│    • Viewing key pair:  (k_view, K_view)                        │
│                                                                  │
│  Sender generates:                                               │
│    1. Random ephemeral keypair (r, R = r*G)                     │
│    2. Shared secret: S = r * K_view                             │
│    3. Stealth public key: P = K_spend + hash(S)*G               │
│    4. Publish: (R, P) - ephemeral key + stealth address         │
│                                                                  │
│  Recipient derives:                                              │
│    1. Shared secret: S = k_view * R                             │
│    2. Private key: p = k_spend + hash(S)                        │
│    3. Can now spend from P                                       │
└─────────────────────────────────────────────────────────────────┘
```

**Supported Curves**:
| Curve | Use Case | Chains |
|-------|----------|--------|
| secp256k1 | EVM-compatible | Ethereum, Polygon, BSC |
| ed25519 | Non-EVM | Solana, NEAR |

**Key Files**: `src/stealth.ts`

#### 3.1.2 Pedersen Commitments

**Purpose**: Hide transaction amounts while allowing mathematical verification.

**Construction**:
```
C = v*G + r*H

Where:
  v = value (amount)
  r = random blinding factor
  G = generator point (secp256k1 base point)
  H = NUMS generator (nothing-up-my-sleeve)
```

**Properties**:
| Property | Description | Benefit |
|----------|-------------|---------|
| **Hiding** | Cannot determine `v` from `C` | Amount privacy |
| **Binding** | Cannot find different `(v', r')` for same `C` | Integrity |
| **Homomorphic** | `C1 + C2 = (v1+v2)*G + (r1+r2)*H` | Balance verification |

**NUMS Generator Construction**:
```typescript
// H derived from hashing G with domain separator
// "Nothing Up My Sleeve" - provably not chosen maliciously
const H = hashToCurve("SIP-PEDERSEN-GENERATOR-H-v1")
```

**Key Files**: `src/commitment.ts`

#### 3.1.3 Viewing Keys

**Purpose**: Selective disclosure for compliance without exposing to public.

**Hierarchy**:
```
Master Viewing Key (m/0)
├── m/0/auditor/external      # External auditors
├── m/0/auditor/internal      # Internal team
├── m/0/regulatory/tax        # Tax authority
├── m/0/regulatory/aml        # AML compliance
├── m/0/year/2024             # Time-scoped
└── m/0/purpose/treasury      # Purpose-scoped
```

**Encryption**: XChaCha20-Poly1305 with HKDF key derivation

**Key Files**: `src/privacy.ts`

### 3.2 Proof Layer

Zero-knowledge proofs that verify properties without revealing data.

#### 3.2.1 Proof Types

```
┌─────────────────────────────────────────────────────────────────┐
│                        PROOF SYSTEM                              │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   FUNDING    │  │   VALIDITY   │  │     FULFILLMENT      │  │
│  │    PROOF     │  │    PROOF     │  │       PROOF          │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤  │
│  │ Proves:      │  │ Proves:      │  │ Proves:              │  │
│  │ balance >= X │  │ sender auth  │  │ correct delivery     │  │
│  │              │  │ valid sig    │  │ oracle attestation   │  │
│  │              │  │ not expired  │  │ amount verification  │  │
│  ├──────────────┤  ├──────────────┤  ├──────────────────────┤  │
│  │ ~22k constr  │  │ ~72k constr  │  │ ~22k constr          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  Framework: Noir + Barretenberg (Aztec)                         │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2.2 Proof Provider Interface

```typescript
interface ProofProvider {
  // Prove balance sufficient for intent
  generateFundingProof(params: FundingProofParams): Promise<ProofResult>

  // Prove intent authorized by sender
  generateValidityProof(params: ValidityProofParams): Promise<ProofResult>

  // Prove fulfillment correct
  generateFulfillmentProof(params: FulfillmentProofParams): Promise<ProofResult>

  // Verify any proof
  verifyProof(proof: ZKProof): Promise<boolean>
}
```

#### 3.2.3 Implementations

| Provider | Use Case | Status |
|----------|----------|--------|
| `MockProofProvider` | Testing, development | Complete |
| `NoirProofProvider` | Production proofs | In Progress |

**Key Files**: `src/proofs/interface.ts`, `src/proofs/noir.ts`

### 3.3 Adapter Layer

External system integrations for settlement and wallets.

#### 3.3.1 NEAR Intents Adapter

**Purpose**: Route intents through NEAR's solver network.

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEAR INTENTS FLOW                             │
│                                                                  │
│  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────────────┐  │
│  │  SIP   │───▶│ 1Click │───▶│Solvers │───▶│ Cross-Chain    │  │
│  │ Intent │    │  API   │    │Network │    │ Settlement     │  │
│  └────────┘    └────────┘    └────────┘    └────────────────┘  │
│                                                                  │
│  Endpoints:                                                      │
│    • POST /quote - Get solver quotes                            │
│    • POST /execute - Execute intent                             │
│    • GET /status/{id} - Check fulfillment                       │
└─────────────────────────────────────────────────────────────────┘
```

**Key Files**: `src/adapters/near/intents.ts`

#### 3.3.2 Zcash RPC Client

**Purpose**: Interact with Zcash shielded pool for privacy backbone.

**Capabilities**:
- Shielded transaction creation (`z_sendmany`)
- Balance queries (`z_getbalance`)
- Address generation (`z_getnewaddress`)
- Transaction status (`z_getoperationstatus`)

**Key Files**: `src/adapters/zcash/client.ts`

#### 3.3.3 Wallet Adapters

**Purpose**: Abstract wallet interactions across different ecosystems.

```typescript
interface WalletAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>
  getAddress(): Promise<string>
  signMessage(message: string): Promise<string>
  signTransaction(tx: Transaction): Promise<SignedTransaction>
}
```

**Implementations**:
| Adapter | Ecosystem | Status |
|---------|-----------|--------|
| `EthereumWalletAdapter` | MetaMask, WalletConnect | Complete |
| `SolanaWalletAdapter` | Phantom, Solflare | Complete |
| `LedgerAdapter` | Hardware wallet | Complete |
| `TrezorAdapter` | Hardware wallet | Complete |

**Key Files**: `src/adapters/wallets/`

### 3.4 SDK Layer

Public API for application integration.

#### 3.4.1 SIP Client

The main entry point for the SDK.

```typescript
const sip = new SIP({
  network: 'mainnet',
  proofProvider: new NoirProofProvider(),
  nearConfig: { ... },
  zcashConfig: { ... }
})

// Create shielded intent
const intent = await sip.createIntent({
  input: { chain: 'solana', token: 'SOL', amount: 10 },
  output: { chain: 'ethereum', token: 'ETH' },
  privacy: PrivacyLevel.SHIELDED
})

// Get quotes and execute
const quotes = await intent.getQuotes()
const result = await intent.execute(quotes[0])
```

#### 3.4.2 IntentBuilder

Fluent API for constructing intents.

```typescript
const intent = new IntentBuilder()
  .setInput({ chain: 'ethereum', token: 'USDC', amount: 1000 })
  .setOutput({ chain: 'solana', token: 'SOL' })
  .setPrivacy(PrivacyLevel.COMPLIANT)
  .setViewingKey(viewingKey)
  .setExpiry(Date.now() + 3600000) // 1 hour
  .build()
```

**Key Files**: `src/sip.ts`, `src/intent.ts`

---

## 4. Data Flows

### 4.1 Shielded Intent Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SHIELDED INTENT CREATION                                │
└─────────────────────────────────────────────────────────────────────────────┘

User Input                Privacy Layer              Proof Layer
    │                          │                          │
    │  amount, recipient       │                          │
    │─────────────────────────▶│                          │
    │                          │                          │
    │                    ┌─────┴─────┐                    │
    │                    │ Generate  │                    │
    │                    │ stealth   │                    │
    │                    │ address   │                    │
    │                    └─────┬─────┘                    │
    │                          │                          │
    │                    ┌─────┴─────┐                    │
    │                    │ Create    │                    │
    │                    │ amount    │                    │
    │                    │ commitment│                    │
    │                    └─────┬─────┘                    │
    │                          │                          │
    │                          │  commitment, stealth     │
    │                          │─────────────────────────▶│
    │                          │                          │
    │                          │                    ┌─────┴─────┐
    │                          │                    │ Generate  │
    │                          │                    │ funding   │
    │                          │                    │ proof     │
    │                          │                    └─────┬─────┘
    │                          │                          │
    │                          │                    ┌─────┴─────┐
    │                          │                    │ Generate  │
    │                          │                    │ validity  │
    │                          │                    │ proof     │
    │                          │                    └─────┬─────┘
    │                          │                          │
    │◀─────────────────────────┴──────────────────────────┤
    │                                                      │
    │         ShieldedIntent { commitment, stealth,        │
    │                          proofs, expiry }            │
    │                                                      │
```

### 4.2 Intent Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTENT EXECUTION FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

     User              SIP SDK            NEAR Intents         Solver
       │                  │                    │                  │
       │  execute(quote)  │                    │                  │
       │─────────────────▶│                    │                  │
       │                  │                    │                  │
       │                  │  POST /execute     │                  │
       │                  │───────────────────▶│                  │
       │                  │                    │                  │
       │                  │                    │  intent details  │
       │                  │                    │─────────────────▶│
       │                  │                    │                  │
       │                  │                    │                  │ ┌──────────┐
       │                  │                    │                  │ │ Execute  │
       │                  │                    │                  │ │ cross-   │
       │                  │                    │                  │ │ chain    │
       │                  │                    │                  │ │ swap     │
       │                  │                    │                  │ └────┬─────┘
       │                  │                    │                  │      │
       │                  │                    │  fulfillment tx  │      │
       │                  │                    │◀─────────────────┤◀─────┘
       │                  │                    │                  │
       │                  │  fulfillment proof │                  │
       │                  │◀───────────────────│                  │
       │                  │                    │                  │
       │   result         │                    │                  │
       │◀─────────────────│                    │                  │
       │                  │                    │                  │
```

### 4.3 Viewing Key Disclosure Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      VIEWING KEY DISCLOSURE                                  │
└─────────────────────────────────────────────────────────────────────────────┘

     User                   Auditor                  Encrypted Data
       │                       │                          │
       │  derive scoped key    │                          │
       │──────────────────────▶│                          │
       │                       │                          │
       │  m/0/auditor/2024     │                          │
       │◀──────────────────────│                          │
       │                       │                          │
       │                       │   request disclosure     │
       │                       │─────────────────────────▶│
       │                       │                          │
       │                       │   encrypted tx data      │
       │                       │◀─────────────────────────│
       │                       │                          │
       │                       │ ┌──────────────────────┐ │
       │                       │ │ Decrypt with         │ │
       │                       │ │ viewing key          │ │
       │                       │ └──────────────────────┘ │
       │                       │                          │
       │                       │   plaintext: sender,     │
       │                       │   recipient, amount      │
       │                       │                          │
```

---

## 5. Design Decisions

### 5.1 Why Noir over Halo2/Circom?

| Factor | Noir | Halo2 | Circom |
|--------|------|-------|--------|
| **Learning Curve** | Low (Rust-like) | High | Medium |
| **Proof Size** | Small (~2KB) | Small | Large |
| **Proving Time** | Fast | Fast | Slow |
| **Tooling** | Excellent (Aztec) | Good | Good |
| **Production Use** | Aztec Network | Zcash, Scroll | Many projects |
| **Auditability** | High-level DSL | Low-level | Medium |

**Decision**: Noir provides the best balance of developer experience, proof efficiency, and production readiness. Barretenberg backend is battle-tested at Aztec.

### 5.2 Why Dual-Curve (secp256k1 + ed25519)?

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURVE SELECTION                               │
│                                                                  │
│  secp256k1                        ed25519                       │
│  ┌────────────────────┐           ┌────────────────────┐        │
│  │ • Ethereum         │           │ • Solana           │        │
│  │ • Bitcoin          │           │ • NEAR             │        │
│  │ • Polygon          │           │ • Cosmos (some)    │        │
│  │ • BSC              │           │ • Cardano          │        │
│  │ • Most EVM chains  │           │ • Polkadot         │        │
│  └────────────────────┘           └────────────────────┘        │
│                                                                  │
│  SIP supports BOTH for maximum chain coverage                   │
└─────────────────────────────────────────────────────────────────┘
```

**Decision**: Supporting both curves allows native stealth addresses on all major chains without bridge overhead or curve conversion complexity.

### 5.3 Why Viewing Keys over Full Disclosure?

| Approach | Privacy | Compliance | Complexity |
|----------|---------|------------|------------|
| **Full Transparency** | None | Full | Low |
| **Full Privacy** | Maximum | None | Medium |
| **Viewing Keys** | Selective | Selective | Medium |

**Decision**: Viewing keys enable "compliant privacy" — transactions are private by default but can be disclosed to authorized parties (auditors, regulators) when legally required. This enables institutional adoption.

### 5.4 Why Intent-Based over Direct Swaps?

```
Direct Swap:                    Intent-Based:
┌──────────┐                    ┌──────────┐
│   User   │                    │   User   │
└────┬─────┘                    └────┬─────┘
     │                               │
     │ finds liquidity               │ expresses intent
     │ routes manually               │
     │ executes each hop             │
     ▼                               ▼
┌──────────┐                    ┌──────────┐
│  DEX A   │                    │ Solvers  │ (compete to fill)
└────┬─────┘                    └────┬─────┘
     │                               │
     ▼                               │ finds best route
┌──────────┐                         │ executes atomically
│  DEX B   │                         │
└────┬─────┘                         │
     │                               ▼
     ▼                          ┌──────────┐
┌──────────┐                    │  Result  │
│  Result  │                    └──────────┘
└──────────┘

Complexity: User                 Complexity: Solver
```

**Decision**: Intent-based architecture moves complexity from users to professional solvers. Users express what they want; solvers compete to deliver the best execution. This also enables privacy — solvers only see commitments, not actual amounts.

### 5.5 Why Pedersen over Other Commitment Schemes?

| Scheme | Hiding | Binding | Homomorphic | Size |
|--------|--------|---------|-------------|------|
| **Pedersen** | Perfect | Computational | Yes | 33 bytes |
| Hash-based | Computational | Perfect | No | 32 bytes |
| ElGamal | Perfect | Computational | Yes (mult) | 66 bytes |

**Decision**: Pedersen commitments provide perfect hiding (information-theoretic security), computational binding (secure under DLP), and additive homomorphism (essential for balance verification without revealing amounts).

---

## 6. Integration Points

### 6.1 Wallet Integration

```typescript
// 1. Install SDK
npm install @sip-protocol/sdk

// 2. Connect wallet adapter
import { SIP, createEthereumAdapter } from '@sip-protocol/sdk'

const wallet = await createEthereumAdapter({
  provider: window.ethereum
})

const sip = new SIP({ wallet })

// 3. Create shielded transaction
const intent = await sip.createIntent({
  input: { chain: 'ethereum', token: 'ETH', amount: 1 },
  output: { chain: 'solana', token: 'SOL' },
  privacy: PrivacyLevel.SHIELDED
})
```

### 6.2 Solver Integration

```typescript
// Solvers receive shielded intents with:
interface SolverIntent {
  intentId: string
  inputCommitment: Commitment    // Hidden amount
  outputAsset: Asset             // What to deliver
  minOutput: bigint              // Minimum acceptable
  recipientStealth: StealthAddress  // Where to deliver
  fundingProof: ZKProof          // Proves sufficient balance
  validityProof: ZKProof         // Proves authorization
  expiry: number                 // Deadline
}

// Solvers can:
// 1. Verify proofs (balance sufficient, authorized)
// 2. Quote based on minOutput (don't know exact input)
// 3. Fulfill to stealth address
// 4. Generate fulfillment proof
```

### 6.3 Settlement Backend Integration

```typescript
// Settlement backends implement:
interface SettlementAdapter {
  // Submit intent for execution
  submitIntent(intent: ShieldedIntent): Promise<string>

  // Get quotes from solver network
  getQuotes(intentId: string): Promise<Quote[]>

  // Execute with selected quote
  execute(intentId: string, quote: Quote): Promise<ExecutionResult>

  // Check fulfillment status
  getStatus(intentId: string): Promise<IntentStatus>
}

// Current: NEAR Intents
// Future: Direct chain settlement, Mina, others
```

### 6.4 Oracle Integration

```typescript
// Oracles attest to cross-chain fulfillment
interface OracleAttestation {
  oracleId: string
  intentId: string
  fulfilled: boolean
  outputAmount: bigint
  outputTxHash: HexString
  timestamp: number
  signature: HexString  // Oracle signs all fields
}

// Multiple oracles for Byzantine fault tolerance
// Threshold signatures (e.g., 3-of-5)
```

---

## 7. Security Architecture

### 7.1 Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│  TRUSTED (User Device)                                          │
│  • Private keys                                                 │
│  • Viewing keys                                                 │
│  • Proof generation                                             │
│  • Stealth key derivation                                       │
└─────────────────────────────────────────────────────────────────┘
                    ║ TRUST BOUNDARY
┌─────────────────────────────────────────────────────────────────┐
│  SEMI-TRUSTED                                                   │
│  • Oracle attestations (verified by signature)                  │
│  • Settlement layer (verified by proof)                         │
└─────────────────────────────────────────────────────────────────┘
                    ║ TRUST BOUNDARY
┌─────────────────────────────────────────────────────────────────┐
│  UNTRUSTED                                                      │
│  • Network observers                                            │
│  • Solvers                                                      │
│  • Other users                                                  │
│  • Public blockchain data                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Cryptographic Dependencies

| Library | Purpose | Security |
|---------|---------|----------|
| `@noble/curves` | Elliptic curves | Audited, constant-time |
| `@noble/hashes` | Hash functions | Audited, constant-time |
| `@noble/ciphers` | Symmetric encryption | Audited |
| `Barretenberg` | ZK proofs | Aztec production |

### 7.3 Threat Mitigations

See [THREAT-MODEL.md](security/THREAT-MODEL.md) for comprehensive threat analysis.

| Threat | Mitigation |
|--------|------------|
| Transaction graph analysis | Stealth addresses |
| Amount correlation | Pedersen commitments |
| Front-running / MEV | Hidden amounts, solver competition |
| Replay attacks | Nullifiers, nonces |
| Key compromise | Hardware wallet support, key hierarchy |

---

## 8. Deployment Architecture

### 8.1 SDK Distribution

```
┌─────────────────────────────────────────────────────────────────┐
│                    DISTRIBUTION CHANNELS                         │
│                                                                  │
│  npm registry          CDN (future)         Source              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │@sip-protocol │     │ unpkg.com/   │     │ GitHub       │    │
│  │   /sdk       │     │ sip-protocol │     │ releases     │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│                                                                  │
│  Usage:                                                          │
│  • npm install @sip-protocol/sdk                                │
│  • <script src="unpkg.com/@sip-protocol/sdk">                  │
│  • git clone + build                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Runtime Requirements

| Environment | Requirements |
|-------------|--------------|
| **Node.js** | v18+ (crypto, fetch) |
| **Browser** | Modern (ES2020+, WebCrypto) |
| **React Native** | With crypto polyfills |

### 8.3 Infrastructure Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION INFRASTRUCTURE                     │
│                                                                  │
│  Client-Side (SDK)           Server-Side (Optional)             │
│  ┌────────────────────┐      ┌────────────────────┐            │
│  │ • Proof generation │      │ • RPC relay        │            │
│  │ • Key management   │      │ • Quote aggregation│            │
│  │ • Stealth scanning │      │ • Status tracking  │            │
│  └────────────────────┘      └────────────────────┘            │
│                                                                  │
│  External Services                                               │
│  ┌────────────────────┐      ┌────────────────────┐            │
│  │ NEAR Intents API   │      │ Zcash Node         │            │
│  │ (1Click)           │      │ (self-hosted rec.) │            │
│  └────────────────────┘      └────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## References

- [SIP Protocol Specification](specs/SIP-PROTOCOL.md)
- [Stealth Address Specification](specs/STEALTH-ADDRESSES.md)
- [Commitment Specification](specs/COMMITMENTS.md)
- [Viewing Key Specification](specs/VIEWING-KEYS.md)
- [Privacy Levels Specification](specs/PRIVACY-LEVELS.md)
- [Threat Model](security/THREAT-MODEL.md)
- [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [Noir Documentation](https://noir-lang.org/docs)
- [NEAR Intents](https://near.org/intents)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-02 | Initial release |

---

## Copyright

This document is released under the MIT License.
