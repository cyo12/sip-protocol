# SIP Specification v0.1

> Shielded Intents Protocol — Privacy layer for cross-chain transactions

**Status**: Draft
**Authors**: RECTOR Labs
**Created**: 2025-11-26

---

## Abstract

SIP (Shielded Intents Protocol) extends intent-based cross-chain transaction systems with privacy-preserving capabilities. It enables users to execute cross-chain swaps and transfers without exposing sender identity, transaction amounts, or recipient addresses to public observation.

## Motivation

Current cross-chain intent systems (e.g., NEAR Intents) provide excellent UX for cross-chain transactions but expose all transaction details publicly. This creates several problems:

1. **Front-running**: Visible pending intents can be front-run
2. **Surveillance**: Transaction history is permanently public
3. **Target identification**: Large holders become visible targets
4. **Privacy leakage**: Even privacy-focused assets (e.g., Zcash) lose privacy when bridging

### The Specific Problem

As documented by blockchain investigator ZachXBT, the current NEAR Intents + Zcash integration has a privacy vulnerability:

- Refund transactions use transparent addresses
- The same address is reused for all refunds
- This creates linkability between shielded and unshielded funds

SIP addresses these issues by introducing shielded intents with proper privacy guarantees.

---

## Specification

### 1. Shielded Intent Format

```typescript
interface ShieldedIntent {
  // Public fields (visible to solvers)
  intentId: string
  version: "sip-v1"
  outputAsset: Asset
  minOutputAmount: bigint
  maxSlippage: number
  expiry: number

  // Private fields (hidden from solvers)
  inputCommitment: Commitment
  senderCommitment: Commitment
  recipientStealth: StealthAddress

  // Proofs
  fundingProof: ZKProof
  validityProof: ZKProof

  // Metadata
  privacyLevel: PrivacyLevel
  viewingKeyHash?: Hash
}

type PrivacyLevel = "transparent" | "shielded" | "compliant"
```

### 2. Privacy Levels

#### 2.1 Transparent Mode
Standard intent with no privacy. Equivalent to current NEAR Intents behavior.

#### 2.2 Shielded Mode
Full privacy via Zcash shielded pool:
- Sender identity hidden
- Transaction amounts hidden
- Recipient uses stealth address
- No on-chain linkability

#### 2.3 Compliant Mode
Shielded mode with viewing key:
- Same privacy as shielded mode
- Viewing key allows selective disclosure
- Suitable for institutional use

### 3. Stealth Addresses

Stealth addresses prevent address reuse and linkability.

#### 3.1 Generation

```
1. Recipient publishes stealth meta-address (P, Q)
2. Sender generates ephemeral keypair (r, R = r*G)
3. Sender computes shared secret: S = r * P
4. Sender derives stealth address: A = Q + hash(S)*G
5. Sender publishes R alongside transaction
6. Recipient scans: for each R, compute S = p * R, check if A matches
```

#### 3.2 Properties
- One-time use per transaction
- Unlinkable to recipient's main address
- Recipient can derive private key to spend

### 4. Commitment Scheme

Input amounts and sender identity are hidden using Pedersen commitments:

```
Commitment = value * G + blinding * H
```

This allows:
- Hiding the actual value
- Proving properties about the value (e.g., > 0, sufficient funds)
- Verifying without revealing

### 5. Proof Requirements

#### 5.1 Funding Proof
Proves: "I have sufficient funds to fulfill this intent"
- Without revealing: exact balance, source of funds

#### 5.2 Validity Proof
Proves: "This intent is well-formed and authorized"
- Without revealing: sender identity, input details

### 6. Solver Interface

Solvers interact with shielded intents via a modified interface:

```typescript
interface SIPSolver {
  // Solvers see limited information
  canFulfill(intent: ShieldedIntent): Promise<Quote>

  // Fulfillment happens through shielded channel
  fulfill(
    intent: ShieldedIntent,
    quote: Quote,
    fulfillmentProof: ZKProof
  ): Promise<FulfillmentResult>
}
```

### 7. Viewing Keys

For compliant mode, viewing keys enable selective disclosure:

```typescript
interface ViewingKey {
  // Derive from master key
  derive(masterKey: MasterKey, path: string): ViewingKey

  // Decrypt transaction for authorized viewer
  decrypt(encryptedTx: EncryptedTransaction): Transaction

  // Generate proof of transaction for auditor
  generateProof(tx: Transaction): ViewingProof
}
```

---

## Security Considerations

### Threat Model
- Malicious solvers attempting to front-run
- Chain analysis firms attempting to link transactions
- Compromised infrastructure

### Mitigations
- Stealth addresses prevent linkability
- Commitment scheme hides amounts
- ZK proofs prevent forgery
- Viewing keys enable selective disclosure without full deanonymization

---

## Reference Implementation

See `packages/sdk` for TypeScript reference implementation.

---

## Changelog

- **v0.1** (2025-11-26): Initial draft
