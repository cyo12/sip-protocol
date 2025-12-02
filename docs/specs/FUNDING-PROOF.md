# FUNDING-PROOF: SIP Funding Proof Specification

| Field | Value |
|-------|-------|
| **SIP** | 6 |
| **Title** | Funding Proof Circuit Specification |
| **Authors** | SIP Protocol Team |
| **Status** | Draft |
| **Created** | 2024-11-01 |
| **Updated** | 2025-12-02 |
| **Requires** | SIP-1, SIP-3 (COMMITMENTS) |

## Abstract

This specification defines the Funding Proof circuit used in SIP to prove that a user has sufficient balance to fund an intent without revealing the exact balance amount. The proof demonstrates `balance >= minimumRequired` while keeping the actual balance private.

## Motivation

In a shielded transaction system, we face a dilemma:
- Users must prove they can fund the transaction (solvency)
- Users should not reveal their exact balance (privacy)

The Funding Proof resolves this by using zero-knowledge proofs to demonstrate the inequality `balance >= minimum` without revealing `balance`.

## Specification

### 1. Proof Statement

The Funding Proof proves the following statement:

```
Given:
  - Public commitment C to balance
  - Public minimum required amount M
  - Private balance B
  - Private blinding factor r

Prove:
  1. C = B*G + r*H  (commitment opens correctly)
  2. B >= M         (balance sufficient)
  3. User owns the balance (via signature)
```

### 2. Circuit Inputs

#### 2.1 Public Inputs

| Input | Type | Description |
|-------|------|-------------|
| `commitment` | Point | Pedersen commitment to balance |
| `minimumRequired` | u64 | Minimum balance required |
| `assetId` | Field | Asset identifier hash |
| `publicKey` | Point | User's public key (for ownership) |

#### 2.2 Private Inputs

| Input | Type | Description |
|-------|------|-------------|
| `balance` | u64 | Actual user balance |
| `blindingFactor` | Field | Pedersen blinding factor |
| `ownershipSignature` | Signature | Proof of key ownership |

### 3. Circuit Constraints

#### 3.1 Commitment Verification

```noir
// Verify commitment opens to claimed balance
fn verify_commitment(
    commitment: Point,
    balance: u64,
    blinding: Field,
    G: Point,
    H: Point
) {
    let expected = ec_mul(G, balance as Field) + ec_mul(H, blinding);
    assert(commitment == expected);
}
```

#### 3.2 Balance Comparison

```noir
// Verify balance >= minimum
fn verify_sufficient_balance(
    balance: u64,
    minimum_required: u64
) {
    assert(balance >= minimum_required);
}
```

#### 3.3 Ownership Proof

```noir
// Verify user controls the balance
fn verify_ownership(
    public_key: Point,
    message: Field,
    signature: Signature
) {
    let valid = ecdsa_secp256k1_verify(
        public_key,
        message,
        signature
    );
    assert(valid);
}
```

### 4. Noir Circuit Implementation

```noir
// funding_proof.nr

use dep::std::ec::secp256k1::{Point, Signature, ecdsa_secp256k1_verify};
use dep::std::hash::sha256;

// Generator points (SIP Pedersen generators)
global G_X: Field = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798;
global G_Y: Field = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8;
// H from SIP NUMS construction
global H_X: Field = <implementation_specific>;
global H_Y: Field = <implementation_specific>;

struct FundingProofPublic {
    commitment_x: Field,
    commitment_y: Field,
    minimum_required: u64,
    asset_id: Field,
    public_key_x: Field,
    public_key_y: Field,
}

struct FundingProofPrivate {
    balance: u64,
    blinding_factor: Field,
    signature_r: Field,
    signature_s: Field,
}

fn main(
    public: FundingProofPublic,
    private: FundingProofPrivate
) {
    // 1. Reconstruct generator points
    let G = Point { x: G_X, y: G_Y };
    let H = Point { x: H_X, y: H_Y };
    let commitment = Point {
        x: public.commitment_x,
        y: public.commitment_y
    };
    let public_key = Point {
        x: public.public_key_x,
        y: public.public_key_y
    };

    // 2. Verify commitment: C == balance*G + blinding*H
    let balance_point = ec_mul(G, private.balance as Field);
    let blinding_point = ec_mul(H, private.blinding_factor);
    let expected_commitment = ec_add(balance_point, blinding_point);
    assert(commitment.x == expected_commitment.x);
    assert(commitment.y == expected_commitment.y);

    // 3. Verify sufficient balance
    assert(private.balance >= public.minimum_required);

    // 4. Verify ownership (user controls this balance)
    let message = sha256([
        public.commitment_x,
        public.commitment_y,
        public.asset_id
    ]);
    let signature = Signature {
        r: private.signature_r,
        s: private.signature_s
    };
    let valid = ecdsa_secp256k1_verify(
        public_key,
        message,
        signature
    );
    assert(valid);
}
```

### 5. Constraint Count

| Component | Constraints |
|-----------|-------------|
| Commitment verification | ~6,000 |
| EC scalar multiplication (G) | ~3,000 |
| EC scalar multiplication (H) | ~3,000 |
| EC point addition | ~100 |
| Comparison (balance >= min) | ~200 |
| ECDSA signature verification | ~15,000 |
| SHA256 hashing | ~500 |
| **Total** | **~22,000** |

### 6. Proof Generation

```typescript
interface FundingProofParams {
  /** User's actual balance (private) */
  balance: bigint

  /** Minimum amount required (public) */
  minimumRequired: bigint

  /** Blinding factor for commitment (private) */
  blindingFactor: Uint8Array

  /** Asset identifier (public) */
  assetId: string

  /** User's address (private, for ownership) */
  userAddress: string

  /** Signature proving ownership (private) */
  ownershipSignature: Uint8Array
}

async function generateFundingProof(
  params: FundingProofParams
): Promise<ProofResult> {
  // 1. Prepare public inputs
  const commitment = commit(params.balance, params.blindingFactor)
  const assetIdHash = hash(params.assetId)
  const publicKey = derivePublicKey(params.userAddress)

  const publicInputs = [
    commitment.x,
    commitment.y,
    params.minimumRequired,
    assetIdHash,
    publicKey.x,
    publicKey.y
  ]

  // 2. Prepare private inputs
  const privateInputs = {
    balance: params.balance,
    blindingFactor: params.blindingFactor,
    signatureR: params.ownershipSignature.slice(0, 32),
    signatureS: params.ownershipSignature.slice(32, 64)
  }

  // 3. Generate proof
  const proof = await noir.prove(
    'funding_proof',
    publicInputs,
    privateInputs
  )

  return {
    proof: {
      proofType: 'funding',
      proof: proof.bytes,
      publicInputs: publicInputs.map(toHex),
      verificationKey: proof.vk
    },
    commitment: commitment
  }
}
```

### 7. Proof Verification

```typescript
async function verifyFundingProof(proof: ZKProof): Promise<boolean> {
  // Extract public inputs from proof
  const [
    commitmentX,
    commitmentY,
    minimumRequired,
    assetId,
    publicKeyX,
    publicKeyY
  ] = proof.publicInputs

  // Verify the proof
  return await noir.verify(
    'funding_proof',
    proof.proof,
    proof.publicInputs,
    proof.verificationKey
  )
}
```

### 8. Security Considerations

#### 8.1 Balance Overflow

**Risk**: Balance values near 2^64 could overflow in arithmetic.

**Mitigation**: Use range-checked arithmetic. Constrain balance to reasonable bounds (e.g., 2^63 - 1).

#### 8.2 Commitment Soundness

**Risk**: Malicious user could create commitment to negative value.

**Mitigation**: Balance is unsigned integer type in circuit. Commitment to negative values impossible.

#### 8.3 Replay Protection

**Risk**: Old proofs could be replayed.

**Mitigation**: Include timestamp/nonce in ownership signature message.

#### 8.4 Front-Running

**Risk**: Observer could front-run by seeing proof before execution.

**Mitigation**: Proof validity tied to specific intent ID (via ownership signature).

### 9. Edge Cases

#### 9.1 Balance Equals Minimum

```
balance = 100, minimum = 100
Result: VALID (>= is satisfied)
```

#### 9.2 Zero Balance

```
balance = 0, minimum = 0
Result: VALID
```

```
balance = 0, minimum = 1
Result: INVALID (balance < minimum)
```

#### 9.3 Maximum Balance

```
balance = 2^64 - 1
Result: Must ensure no overflow in commitment computation
```

### 10. Integration

#### 10.1 Creating Intent with Funding Proof

```typescript
const intent = await createShieldedIntent({
  input: {
    asset: { chain: 'ethereum', symbol: 'ETH' },
    amount: 1_000_000_000_000_000_000n, // 1 ETH
    sourceAddress: wallet.address
  },
  output: {
    asset: { chain: 'solana', symbol: 'SOL' },
    minAmount: 9_500_000_000n // 9.5 SOL minimum
  },
  privacy: 'shielded'
}, {
  proofProvider: noirProvider
})

// intent.fundingProof is now populated
```

#### 10.2 Verifying Before Settlement

```typescript
// Solver verifies funding proof before quoting
const isValid = await proofProvider.verifyProof(intent.fundingProof)

if (!isValid) {
  throw new Error('Invalid funding proof - cannot quote')
}
```

### 11. Test Vectors

#### 11.1 Valid Proof

```
Balance: 1000000000000000000 (1 ETH in wei)
Minimum: 500000000000000000 (0.5 ETH in wei)
Blinding: 0x0123...cdef (32 bytes)

Expected: Proof validates successfully
```

#### 11.2 Insufficient Balance

```
Balance: 100000000000000000 (0.1 ETH)
Minimum: 500000000000000000 (0.5 ETH)
Blinding: 0x0123...cdef

Expected: Proof generation fails (balance < minimum)
```

## Reference Implementation

See `packages/sdk/src/proofs/interface.ts`:
- `FundingProofParams` - Input parameters
- `ProofProvider.generateFundingProof()` - Generation interface

See `packages/sdk/src/proofs/noir.ts`:
- `NoirProofProvider.generateFundingProof()` - Noir implementation

See `packages/sdk/src/proofs/circuits/funding_proof.nr` (planned):
- Noir circuit implementation

## References

1. [Bulletproofs: Short Proofs for Confidential Transactions](https://eprint.iacr.org/2017/1066.pdf)
2. [Noir Language Documentation](https://noir-lang.org/docs)
3. [Zcash Protocol Specification - Balance Proofs](https://zips.z.cash/protocol/protocol.pdf)

## Copyright

This specification is released under the MIT License.
