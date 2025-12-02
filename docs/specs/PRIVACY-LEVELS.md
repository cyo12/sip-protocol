# PRIVACY-LEVELS: SIP Privacy Level Specification

| Field | Value |
|-------|-------|
| **SIP** | 5 |
| **Title** | Privacy Level Semantics and Configuration |
| **Authors** | SIP Protocol Team |
| **Status** | Draft |
| **Created** | 2024-11-01 |
| **Updated** | 2025-12-02 |
| **Requires** | SIP-1, SIP-2 (STEALTH-ADDRESSES), SIP-3 (COMMITMENTS), SIP-4 (VIEWING-KEYS) |

## Abstract

This specification defines the three privacy levels supported by SIP: transparent, shielded, and compliant. Each level provides different trade-offs between privacy, functionality, and regulatory compliance.

## Motivation

Different use cases require different privacy guarantees:

| Use Case | Privacy Need | Compliance Need |
|----------|--------------|-----------------|
| Public donations | None | N/A |
| Personal payments | High | Low |
| Institutional transfers | Medium | High |
| DAO treasury | Variable | Medium |
| Regulatory reporting | None | Full |

A one-size-fits-all approach fails these diverse needs. SIP's three-level system allows users to choose the appropriate balance.

## Specification

### 1. Privacy Level Enum

```typescript
enum PrivacyLevel {
  TRANSPARENT = 'transparent',
  SHIELDED = 'shielded',
  COMPLIANT = 'compliant'
}
```

### 2. Level Comparison

| Feature | Transparent | Shielded | Compliant |
|---------|-------------|----------|-----------|
| Stealth addresses | No | Yes | Yes |
| Pedersen commitments | No | Yes | Yes |
| Amount hidden | No | Yes | Yes* |
| Sender hidden | No | Yes | Yes* |
| Recipient hidden | No | Yes | Yes* |
| ZK proofs required | No | Yes | Yes |
| Viewing key | No | No | Yes |
| Auditable | N/A | No | Yes |

*Hidden from public, visible to viewing key holders

### 3. Transparent Mode

#### 3.1 Description

Transparent mode provides no privacy. All transaction details are visible on-chain. This is equivalent to standard blockchain transactions.

#### 3.2 Configuration

```typescript
function getTransparentConfig(): PrivacyConfig {
  return {
    level: 'transparent',
    useStealth: false,
    encryptData: false,
    viewingKey: undefined
  }
}
```

#### 3.3 Intent Structure

```typescript
// Transparent intent - all fields public
interface TransparentIntent {
  intentId: string
  version: string
  privacyLevel: 'transparent'

  // Public: input details
  inputAsset: Asset
  inputAmount: bigint
  senderAddress: string

  // Public: output details
  outputAsset: Asset
  minOutputAmount: bigint
  maxSlippage: number
  recipientAddress: string  // Direct address, no stealth

  // Timing
  createdAt: number
  expiry: number

  // No proofs required
  fundingProof?: undefined
  validityProof?: undefined
  viewingKeyHash?: undefined
}
```

#### 3.4 Use Cases

- Testing and development
- Public payments (donations, crowdfunding)
- Regulatory environments requiring full transparency
- Low-value transactions where privacy is not a concern

### 4. Shielded Mode

#### 4.1 Description

Shielded mode provides maximum privacy. Sender, amount, and recipient are all hidden using cryptographic techniques. No viewing key is created, meaning the transaction details cannot be revealed even by the parties involved.

#### 4.2 Configuration

```typescript
function getShieldedConfig(): PrivacyConfig {
  return {
    level: 'shielded',
    useStealth: true,
    encryptData: true,
    viewingKey: undefined  // No viewing key
  }
}
```

#### 4.3 Intent Structure

```typescript
// Shielded intent - maximum privacy
interface ShieldedIntent {
  intentId: string
  version: string
  privacyLevel: 'shielded'

  // Hidden: input details (via commitment)
  inputCommitment: Commitment  // C = amount*G + r*H
  senderCommitment: Commitment // C = hash(sender)*G + r*H

  // Public: output specification only
  outputAsset: Asset
  minOutputAmount: bigint  // Minimum, not exact
  maxSlippage: number

  // Hidden: recipient (via stealth address)
  recipientStealth: StealthAddress

  // Timing
  createdAt: number
  expiry: number

  // Required proofs
  fundingProof: ZKProof    // Proves balance >= minOutput
  validityProof: ZKProof   // Proves sender authorization

  // No viewing key
  viewingKeyHash?: undefined
}
```

#### 4.4 What's Hidden

| Field | Visibility | Method |
|-------|------------|--------|
| Input amount | Hidden | Pedersen commitment |
| Sender address | Hidden | Commitment + ZK proof |
| Recipient address | Hidden | Stealth address |
| Output amount | Partially hidden | Only minimum visible |

#### 4.5 What's Visible

| Field | Visibility | Reason |
|-------|------------|--------|
| Output asset | Public | Solvers need to know what to deliver |
| Minimum output | Public | Solvers need to quote |
| Expiry | Public | Settlement timing |
| Stealth ephemeral key | Public | For recipient scanning |

#### 4.6 Use Cases

- Personal privacy (payments between individuals)
- High-value transfers requiring confidentiality
- Competitive trading (hiding strategy)
- Jurisdictions with strong privacy rights

### 5. Compliant Mode

#### 5.1 Description

Compliant mode combines privacy with auditability. Transaction details are hidden by default but can be revealed to authorized parties holding the viewing key. This enables regulatory compliance while maintaining privacy from the general public.

#### 5.2 Configuration

```typescript
function getCompliantConfig(viewingKey: ViewingKey): PrivacyConfig {
  if (!viewingKey) {
    throw new Error('viewingKey is required for compliant mode')
  }

  return {
    level: 'compliant',
    useStealth: true,
    encryptData: true,
    viewingKey: viewingKey
  }
}
```

#### 5.3 Intent Structure

```typescript
// Compliant intent - privacy with audit capability
interface CompliantIntent {
  intentId: string
  version: string
  privacyLevel: 'compliant'

  // Hidden inputs (same as shielded)
  inputCommitment: Commitment
  senderCommitment: Commitment

  // Public output spec (same as shielded)
  outputAsset: Asset
  minOutputAmount: bigint
  maxSlippage: number

  // Hidden recipient (same as shielded)
  recipientStealth: StealthAddress

  // Timing
  createdAt: number
  expiry: number

  // Required proofs
  fundingProof: ZKProof
  validityProof: ZKProof

  // Compliance additions
  viewingKeyHash: Hash              // Identifies which key can decrypt
  encryptedData?: EncryptedTransaction  // Optional encrypted details
}
```

#### 5.4 Audit Flow

```
                    ┌─────────────────┐
                    │ User creates    │
                    │ compliant intent│
                    └────────┬────────┘
                             │
                             ▼
        ┌────────────────────────────────────────┐
        │ Transaction executes with full privacy │
        │ (sender, amount, recipient hidden)     │
        └────────────────────┬───────────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │ Viewing key hash stored  │
              │ on-chain (identifier)    │
              └──────────────┬───────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
    ┌───────────┐    ┌───────────┐    ┌───────────┐
    │ Auditor   │    │ Regulator │    │ Tax Auth  │
    │ requests  │    │ subpoenas │    │ requires  │
    │ disclosure│    │ records   │    │ report    │
    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
          │                │                │
          └────────────────┼────────────────┘
                           ▼
              ┌──────────────────────────┐
              │ User provides viewing    │
              │ key to authorized party  │
              └──────────────┬───────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │ Authorized party decrypts│
              │ transaction details      │
              └──────────────────────────┘
```

#### 5.5 Use Cases

- Institutional transactions (banks, funds)
- Business payments requiring audit trails
- Regulatory compliance (AML, tax)
- Enterprise treasury operations

### 6. Privacy Level Selection

#### 6.1 Decision Flow

```
START
  │
  ▼
Is privacy needed?
  │
  ├─ No ──────────────────────> TRANSPARENT
  │
  └─ Yes
      │
      ▼
    Is audit/compliance needed?
      │
      ├─ No ──────────────────> SHIELDED
      │
      └─ Yes ─────────────────> COMPLIANT
```

#### 6.2 Programmatic Selection

```typescript
function selectPrivacyLevel(options: {
  requiresPrivacy: boolean
  requiresCompliance: boolean
  jurisdictionRules?: string
}): PrivacyLevel {
  if (!options.requiresPrivacy) {
    return PrivacyLevel.TRANSPARENT
  }

  if (options.requiresCompliance) {
    return PrivacyLevel.COMPLIANT
  }

  return PrivacyLevel.SHIELDED
}
```

### 7. Validation Functions

```typescript
function isValidPrivacyLevel(level: string): level is PrivacyLevel {
  return ['transparent', 'shielded', 'compliant'].includes(level)
}

function isPrivate(level: PrivacyLevel): boolean {
  return level === 'shielded' || level === 'compliant'
}

function supportsViewingKey(level: PrivacyLevel): boolean {
  return level === 'compliant'
}

function requiresProofs(level: PrivacyLevel): boolean {
  return level !== 'transparent'
}
```

### 8. Human-Readable Descriptions

```typescript
const PRIVACY_DESCRIPTIONS: Record<PrivacyLevel, string> = {
  transparent: 'Public transaction - all details visible on-chain',
  shielded: 'Private transaction - sender, amount, and recipient hidden',
  compliant: 'Private with audit - hidden but viewable with key'
}

function getPrivacyDescription(level: PrivacyLevel): string {
  return PRIVACY_DESCRIPTIONS[level]
}
```

### 9. Feature Matrix

#### 9.1 Cryptographic Primitives Used

| Primitive | Transparent | Shielded | Compliant |
|-----------|-------------|----------|-----------|
| Stealth addresses | - | Required | Required |
| Pedersen commitments | - | Required | Required |
| ZK proofs (Funding) | - | Required | Required |
| ZK proofs (Validity) | - | Required | Required |
| HKDF key derivation | - | - | Required |
| XChaCha20-Poly1305 | - | Optional | Required |
| Viewing keys | - | - | Required |

#### 9.2 Privacy Guarantees

| Guarantee | Transparent | Shielded | Compliant |
|-----------|-------------|----------|-----------|
| Sender anonymity | None | Full | Conditional* |
| Amount privacy | None | Full | Conditional* |
| Recipient unlinkability | None | Full | Full |
| Transaction graph privacy | None | Partial† | Partial† |

*Conditional: Hidden unless viewing key disclosed
†Partial: Timing and output asset still visible

### 10. Security Considerations

#### 10.1 Transparent Mode

No privacy guarantees. All information is public.

#### 10.2 Shielded Mode

- **Strength**: Maximum privacy, no audit capability
- **Risk**: Cannot prove compliance if required
- **Mitigation**: Use compliant mode in regulated contexts

#### 10.3 Compliant Mode

- **Strength**: Privacy with audit capability
- **Risk**: Viewing key compromise exposes history
- **Mitigation**: Key rotation, hierarchical keys, secure storage

### 11. Migration Between Levels

Users may need to change privacy levels for existing funds:

#### 11.1 Transparent → Shielded

```
1. Create new stealth meta-address
2. Create shielded intent with self as recipient
3. Funds move from public address to stealth address
4. Original address now has lower balance (visible)
```

#### 11.2 Transparent → Compliant

Same as above, but with viewing key attached.

#### 11.3 Shielded → Compliant

Not directly possible. Create new compliant transaction from shielded funds.

#### 11.4 Compliant → Shielded

Not directly possible without revealing transaction (creates audit gap).

## Reference Implementation

See `packages/sdk/src/privacy.ts` in the SIP Protocol repository:
- `getPrivacyConfig()` - Get configuration for privacy level
- `isValidPrivacyLevel()` - Validate privacy level string
- `getPrivacyDescription()` - Human-readable description

See `@sip-protocol/types/src/privacy.ts` for type definitions:
- `PrivacyLevel` enum
- `isPrivate()` helper
- `supportsViewingKey()` helper

## Copyright

This specification is released under the MIT License.
