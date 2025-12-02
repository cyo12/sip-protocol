# VALIDITY-PROOF: SIP Validity Proof Specification

| Field | Value |
|-------|-------|
| **SIP** | 7 |
| **Title** | Validity Proof Circuit Specification |
| **Authors** | SIP Protocol Team |
| **Status** | Draft |
| **Created** | 2024-11-01 |
| **Updated** | 2025-12-02 |
| **Requires** | SIP-1, SIP-3 (COMMITMENTS) |

## Abstract

This specification defines the Validity Proof circuit used in SIP to prove that a shielded intent is authorized by its sender without revealing the sender's identity. The proof demonstrates knowledge of the sender's private key and valid authorization signature while keeping the sender anonymous.

## Motivation

In shielded transactions, we must verify:
- The intent was created by someone who controls the input funds
- The intent hasn't been tampered with
- The intent is within its validity period

Without revealing:
- Who the sender is
- The sender's public key
- The sender's signature (directly)

The Validity Proof enables this by proving knowledge of a valid signature in zero-knowledge.

## Specification

### 1. Proof Statement

The Validity Proof proves the following statement:

```
Given:
  - Public intent hash H
  - Public sender commitment C
  - Public timestamp T
  - Public expiry E
  - Private sender address/key K
  - Private blinding factor r
  - Private authorization signature S
  - Private nonce N

Prove:
  1. C = hash(K)*G + r*H  (sender committed correctly)
  2. S is valid signature by K on H  (intent authorized)
  3. T <= current_time <= E  (within validity window)
  4. Nullifier is derived correctly (prevents double-use)
```

### 2. Circuit Inputs

#### 2.1 Public Inputs

| Input | Type | Description |
|-------|------|-------------|
| `intentHash` | Field | SHA256 hash of intent |
| `senderCommitment` | Point | Commitment to sender identity |
| `timestamp` | u64 | Intent creation time |
| `expiry` | u64 | Intent expiration time |
| `nullifier` | Field | Nullifier to prevent replay |

#### 2.2 Private Inputs

| Input | Type | Description |
|-------|------|-------------|
| `senderAddress` | Field | Sender's address (as hash) |
| `senderBlinding` | Field | Blinding for sender commitment |
| `senderPublicKey` | Point | Sender's secp256k1 public key |
| `authorizationSignature` | Signature | ECDSA signature authorizing intent |
| `nonce` | Field | Random nonce for nullifier |

### 3. Circuit Constraints

#### 3.1 Sender Commitment Verification

```noir
// Verify sender is committed correctly
fn verify_sender_commitment(
    commitment: Point,
    sender_address: Field,
    blinding: Field,
    G: Point,
    H: Point
) {
    // Hash address to get commitment value
    let sender_hash = sha256([sender_address]);

    // Verify: C == sender_hash*G + blinding*H
    let sender_point = ec_mul(G, sender_hash);
    let blinding_point = ec_mul(H, blinding);
    let expected = ec_add(sender_point, blinding_point);

    assert(commitment.x == expected.x);
    assert(commitment.y == expected.y);
}
```

#### 3.2 Signature Verification

```noir
// Verify authorization signature
fn verify_authorization(
    public_key: Point,
    intent_hash: Field,
    signature: Signature
) {
    // Message is the intent hash
    let valid = ecdsa_secp256k1_verify(
        public_key,
        intent_hash,
        signature
    );
    assert(valid);
}
```

#### 3.3 Key-Address Binding

```noir
// Verify public key corresponds to sender address
fn verify_key_address_binding(
    public_key: Point,
    sender_address: Field
) {
    // Derive address from public key (keccak256 for Ethereum)
    let pk_bytes = point_to_bytes(public_key);
    let hash = keccak256(pk_bytes[1..]); // Skip 0x04 prefix
    let derived_address = hash[12..]; // Last 20 bytes

    // Compare with claimed sender address
    assert(field_from_bytes(derived_address) == sender_address);
}
```

#### 3.4 Time Window Validation

```noir
// Verify intent is within validity window
fn verify_time_window(
    timestamp: u64,
    expiry: u64,
    current_time: u64  // Could be constrained externally
) {
    // Intent must not be expired
    assert(timestamp <= expiry);

    // Reasonable timestamp bounds (optional, for additional security)
    // Prevents timestamp manipulation
    assert(timestamp > 0);
    assert(expiry > timestamp);
}
```

#### 3.5 Nullifier Derivation

```noir
// Derive nullifier for double-spend prevention
fn derive_nullifier(
    sender_address: Field,
    intent_hash: Field,
    nonce: Field
) -> Field {
    // Nullifier = hash(sender || intent || nonce)
    sha256([sender_address, intent_hash, nonce])
}
```

### 4. Noir Circuit Implementation

```noir
// validity_proof.nr

use dep::std::ec::secp256k1::{Point, Signature, ecdsa_secp256k1_verify};
use dep::std::hash::{sha256, keccak256};

// Generator points
global G_X: Field = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798;
global G_Y: Field = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8;
global H_X: Field = <implementation_specific>;
global H_Y: Field = <implementation_specific>;

struct ValidityProofPublic {
    intent_hash: Field,
    sender_commitment_x: Field,
    sender_commitment_y: Field,
    timestamp: u64,
    expiry: u64,
    nullifier: Field,
}

struct ValidityProofPrivate {
    sender_address: Field,
    sender_blinding: Field,
    sender_public_key_x: Field,
    sender_public_key_y: Field,
    signature_r: Field,
    signature_s: Field,
    nonce: Field,
}

fn main(
    public: ValidityProofPublic,
    private: ValidityProofPrivate
) {
    // Reconstruct points
    let G = Point { x: G_X, y: G_Y };
    let H = Point { x: H_X, y: H_Y };
    let sender_commitment = Point {
        x: public.sender_commitment_x,
        y: public.sender_commitment_y
    };
    let sender_public_key = Point {
        x: private.sender_public_key_x,
        y: private.sender_public_key_y
    };
    let signature = Signature {
        r: private.signature_r,
        s: private.signature_s
    };

    // 1. Verify sender commitment
    let sender_hash = sha256([private.sender_address]);
    let sender_point = ec_mul(G, sender_hash);
    let blinding_point = ec_mul(H, private.sender_blinding);
    let expected_commitment = ec_add(sender_point, blinding_point);
    assert(sender_commitment.x == expected_commitment.x);
    assert(sender_commitment.y == expected_commitment.y);

    // 2. Verify public key corresponds to sender address
    let pk_uncompressed = decompress_point(sender_public_key);
    let pk_hash = keccak256(pk_uncompressed[1..65]);
    let derived_address = bytes_to_field(pk_hash[12..32]);
    assert(derived_address == private.sender_address);

    // 3. Verify authorization signature
    let valid_sig = ecdsa_secp256k1_verify(
        sender_public_key,
        public.intent_hash,
        signature
    );
    assert(valid_sig);

    // 4. Verify time window
    assert(public.timestamp <= public.expiry);
    assert(public.timestamp > 0);

    // 5. Verify nullifier derivation
    let expected_nullifier = sha256([
        private.sender_address,
        public.intent_hash,
        private.nonce
    ]);
    assert(public.nullifier == expected_nullifier);
}
```

### 5. Constraint Count

| Component | Constraints |
|-----------|-------------|
| Sender commitment verification | ~6,000 |
| EC scalar multiplication (G) | ~3,000 |
| EC scalar multiplication (H) | ~3,000 |
| Key-address binding (keccak256) | ~25,000 |
| ECDSA signature verification | ~30,000 |
| SHA256 hashing (x2) | ~1,000 |
| Time window checks | ~100 |
| Nullifier derivation | ~500 |
| **Total** | **~72,000** |

### 6. Proof Generation

```typescript
interface ValidityProofParams {
  /** Hash of the intent (public) */
  intentHash: HexString

  /** Sender's address (private) */
  senderAddress: string

  /** Blinding factor for sender commitment (private) */
  senderBlinding: Uint8Array

  /** Sender's secret key (private) */
  senderSecret: Uint8Array

  /** Signature authorizing the intent (private) */
  authorizationSignature: Uint8Array

  /** Nonce for nullifier (private) */
  nonce: Uint8Array

  /** Intent timestamp (public) */
  timestamp: number

  /** Intent expiry (public) */
  expiry: number

  /** Optional: sender public key if pre-computed */
  senderPublicKey?: { x: Uint8Array; y: Uint8Array }
}

async function generateValidityProof(
  params: ValidityProofParams
): Promise<ProofResult> {
  // 1. Compute sender commitment
  const senderHash = hash(params.senderAddress)
  const senderCommitment = commit(senderHash, params.senderBlinding)

  // 2. Derive public key from secret
  const publicKey = params.senderPublicKey ??
    secp256k1.getPublicKey(params.senderSecret)

  // 3. Compute nullifier
  const nullifier = hash([
    params.senderAddress,
    params.intentHash,
    params.nonce
  ])

  // 4. Prepare inputs
  const publicInputs = [
    params.intentHash,
    senderCommitment.x,
    senderCommitment.y,
    params.timestamp,
    params.expiry,
    nullifier
  ]

  const privateInputs = {
    senderAddress: params.senderAddress,
    senderBlinding: params.senderBlinding,
    senderPublicKeyX: publicKey.x,
    senderPublicKeyY: publicKey.y,
    signatureR: params.authorizationSignature.slice(0, 32),
    signatureS: params.authorizationSignature.slice(32, 64),
    nonce: params.nonce
  }

  // 5. Generate proof
  const proof = await noir.prove(
    'validity_proof',
    publicInputs,
    privateInputs
  )

  return {
    proof: {
      proofType: 'validity',
      proof: proof.bytes,
      publicInputs: publicInputs.map(toHex),
      verificationKey: proof.vk
    }
  }
}
```

### 7. Nullifier System

#### 7.1 Purpose

Nullifiers prevent:
- Double-spending (same intent used twice)
- Replay attacks (reusing old proofs)

#### 7.2 Properties

```
Nullifier = SHA256(sender_address || intent_hash || nonce)
```

- **Deterministic**: Same inputs always produce same nullifier
- **Unlinkable**: Cannot determine sender from nullifier
- **Unique**: Different nonces produce different nullifiers

#### 7.3 Usage

```typescript
// Track spent nullifiers
const spentNullifiers = new Set<string>()

function checkAndSpendNullifier(proof: ZKProof): boolean {
  const nullifier = proof.publicInputs[5] // Index 5 in our layout

  if (spentNullifiers.has(nullifier)) {
    return false // Already spent
  }

  spentNullifiers.add(nullifier)
  return true
}
```

### 8. Security Considerations

#### 8.1 Signature Malleability

**Risk**: ECDSA signatures can be modified without changing validity.

**Mitigation**: Use low-S normalization. Constrain signature to canonical form.

#### 8.2 Public Key Grinding

**Risk**: Attacker could try different keys to find one producing desired commitment.

**Mitigation**: Commitment includes blinding factor. Finding collision requires solving discrete log.

#### 8.3 Time Manipulation

**Risk**: Block timestamps can be manipulated within bounds.

**Mitigation**: Use reasonable expiry windows (minutes to hours, not seconds).

#### 8.4 Nullifier Collision

**Risk**: Two different intents producing same nullifier.

**Mitigation**: Include intent_hash in nullifier derivation. Random 32-byte nonce provides 256-bit collision resistance.

### 9. Integration

#### 9.1 Creating Signed Intent

```typescript
// 1. Create intent structure
const intentData = {
  input: { /* ... */ },
  output: { /* ... */ },
  privacy: 'shielded'
}

// 2. Hash intent
const intentHash = hash(serializeIntent(intentData))

// 3. Sign intent hash with wallet
const signature = await wallet.signMessage(intentHash)

// 4. Generate validity proof
const proof = await proofProvider.generateValidityProof({
  intentHash,
  senderAddress: wallet.address,
  senderBlinding: randomBytes(32),
  senderSecret: wallet.privateKey,
  authorizationSignature: signature,
  nonce: randomBytes(32),
  timestamp: intentData.createdAt,
  expiry: intentData.expiry
})

// 5. Attach to intent
intent.validityProof = proof.proof
```

### 10. Test Vectors

#### 10.1 Valid Authorization

```
Intent Hash: 0xabcd...1234
Sender Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f...
Timestamp: 1701475200
Expiry: 1701478800 (1 hour later)
Nonce: 0x0123...cdef

Expected: Proof validates successfully
```

#### 10.2 Expired Intent

```
Intent Hash: 0xabcd...1234
Timestamp: 1701475200
Expiry: 1701475200 (same as timestamp)
Current Time: 1701475201 (1 second later)

Expected: Verification fails (time constraint)
```

#### 10.3 Wrong Signature

```
Intent Hash: 0xabcd...1234
Signature: (signed different message)

Expected: Proof generation fails (signature invalid)
```

## Reference Implementation

See `packages/sdk/src/proofs/interface.ts`:
- `ValidityProofParams` - Input parameters
- `ProofProvider.generateValidityProof()` - Generation interface

See `packages/sdk/src/proofs/noir.ts`:
- `NoirProofProvider.generateValidityProof()` - Noir implementation

See `packages/sdk/src/proofs/circuits/validity_proof.nr` (planned):
- Noir circuit implementation

## References

1. [EIP-712: Typed Structured Data Hashing and Signing](https://eips.ethereum.org/EIPS/eip-712)
2. [Noir ECDSA Verification](https://noir-lang.org/docs/noir_stdlib/cryptographic_primitives/ecdsa_secp256k1)
3. [Zcash Nullifiers](https://zips.z.cash/protocol/protocol.pdf)

## Copyright

This specification is released under the MIT License.
