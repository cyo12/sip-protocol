# FULFILLMENT-PROOF: SIP Fulfillment Proof Specification

| Field | Value |
|-------|-------|
| **SIP** | 8 |
| **Title** | Fulfillment Proof Circuit Specification |
| **Authors** | SIP Protocol Team |
| **Status** | Draft |
| **Created** | 2024-11-01 |
| **Updated** | 2025-12-02 |
| **Requires** | SIP-1, SIP-2 (STEALTH-ADDRESSES), SIP-3 (COMMITMENTS) |

## Abstract

This specification defines the Fulfillment Proof circuit used in SIP to prove that a solver correctly delivered the output to the recipient without revealing the exact amount delivered. The proof demonstrates `outputAmount >= minOutputAmount` and correct recipient delivery while keeping sensitive details private.

## Motivation

After a solver fulfills an intent, we must verify:
- The correct amount was delivered (meets minimum requirement)
- The output went to the correct recipient (stealth address)
- The fulfillment was timely (before expiry)

Without revealing:
- The exact amount delivered (competitive information)
- The solver's internal operations
- Details that could enable front-running

The Fulfillment Proof enables settlement networks to verify correct execution while maintaining privacy.

## Specification

### 1. Proof Statement

The Fulfillment Proof proves the following statement:

```
Given:
  - Public intent hash H
  - Public output commitment C
  - Public minimum output M
  - Public recipient stealth address A
  - Public solver ID S
  - Private actual output O
  - Private blinding factor r
  - Private oracle attestation T

Prove:
  1. C = O*G + r*H  (output committed correctly)
  2. O >= M         (minimum output met)
  3. Oracle attests delivery to A  (correct recipient)
  4. Delivery was before expiry  (timely)
  5. Solver S authorized the fulfillment  (valid solver)
```

### 2. Circuit Inputs

#### 2.1 Public Inputs

| Input | Type | Description |
|-------|------|-------------|
| `intentHash` | Field | SHA256 hash of original intent |
| `outputCommitment` | Point | Commitment to output amount |
| `minOutputAmount` | u64 | Minimum required output |
| `recipientStealth` | Field | Stealth address (compressed) |
| `solverId` | Field | Solver identifier hash |
| `fulfillmentTime` | u64 | Time of fulfillment |
| `expiry` | u64 | Intent expiry deadline |

#### 2.2 Private Inputs

| Input | Type | Description |
|-------|------|-------------|
| `outputAmount` | u64 | Actual amount delivered |
| `outputBlinding` | Field | Blinding for output commitment |
| `solverSecret` | Field | Solver's authorization key |
| `oracleAttestation` | OracleAttestation | Cross-chain delivery proof |

#### 2.3 Oracle Attestation Structure

```typescript
interface OracleAttestation {
  /** Recipient who received funds */
  recipient: HexString

  /** Amount received */
  amount: bigint

  /** Transaction hash on destination chain */
  txHash: HexString

  /** Block number containing transaction */
  blockNumber: bigint

  /** Oracle signature (threshold signature for multi-oracle) */
  signature: Uint8Array
}
```

### 3. Circuit Constraints

#### 3.1 Output Commitment Verification

```noir
// Verify output commitment opens correctly
fn verify_output_commitment(
    commitment: Point,
    output_amount: u64,
    blinding: Field,
    G: Point,
    H: Point
) {
    let amount_point = ec_mul(G, output_amount as Field);
    let blinding_point = ec_mul(H, blinding);
    let expected = ec_add(amount_point, blinding_point);

    assert(commitment.x == expected.x);
    assert(commitment.y == expected.y);
}
```

#### 3.2 Minimum Output Verification

```noir
// Verify output meets minimum requirement
fn verify_minimum_output(
    output_amount: u64,
    min_output_amount: u64
) {
    assert(output_amount >= min_output_amount);
}
```

#### 3.3 Oracle Attestation Verification

```noir
// Verify oracle attests to correct delivery
fn verify_oracle_attestation(
    recipient_stealth: Field,
    output_amount: u64,
    attestation: OracleAttestation,
    oracle_public_keys: [Point; N]  // Threshold of oracles
) {
    // 1. Verify recipient matches
    assert(attestation.recipient == recipient_stealth);

    // 2. Verify amount matches (or exceeds)
    assert(attestation.amount >= output_amount);

    // 3. Verify oracle signature (threshold signature)
    let message = sha256([
        attestation.recipient,
        attestation.amount,
        attestation.tx_hash,
        attestation.block_number
    ]);

    // For threshold signature, verify k-of-n oracles signed
    let valid = verify_threshold_signature(
        oracle_public_keys,
        message,
        attestation.signature
    );
    assert(valid);
}
```

#### 3.4 Time Window Verification

```noir
// Verify fulfillment was timely
fn verify_time_window(
    fulfillment_time: u64,
    expiry: u64
) {
    assert(fulfillment_time <= expiry);
    assert(fulfillment_time > 0);
}
```

#### 3.5 Solver Authorization

```noir
// Verify solver is authorized
fn verify_solver(
    solver_id: Field,
    solver_secret: Field,
    intent_hash: Field
) {
    // Derive expected solver ID from secret
    let expected_id = sha256([solver_secret]);
    assert(solver_id == expected_id);

    // Verify solver signed intent acceptance (optional)
    // This binds the solver to the specific intent
}
```

### 4. Noir Circuit Implementation

```noir
// fulfillment_proof.nr

use dep::std::ec::secp256k1::{Point, Signature};
use dep::std::hash::sha256;

// Generator points
global G_X: Field = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798;
global G_Y: Field = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8;
global H_X: Field = <implementation_specific>;
global H_Y: Field = <implementation_specific>;

// Oracle public keys (for threshold verification)
global ORACLE_THRESHOLD: u32 = 3;  // Require 3-of-5 oracles
global NUM_ORACLES: u32 = 5;

struct OracleAttestation {
    recipient: Field,
    amount: u64,
    tx_hash: Field,
    block_number: u64,
    // Aggregate signature from threshold of oracles
    signature_r: Field,
    signature_s: Field,
}

struct FulfillmentProofPublic {
    intent_hash: Field,
    output_commitment_x: Field,
    output_commitment_y: Field,
    min_output_amount: u64,
    recipient_stealth: Field,
    solver_id: Field,
    fulfillment_time: u64,
    expiry: u64,
}

struct FulfillmentProofPrivate {
    output_amount: u64,
    output_blinding: Field,
    solver_secret: Field,
    oracle_attestation: OracleAttestation,
}

fn main(
    public: FulfillmentProofPublic,
    private: FulfillmentProofPrivate
) {
    // Reconstruct points
    let G = Point { x: G_X, y: G_Y };
    let H = Point { x: H_X, y: H_Y };
    let output_commitment = Point {
        x: public.output_commitment_x,
        y: public.output_commitment_y
    };

    // 1. Verify output commitment
    let amount_point = ec_mul(G, private.output_amount as Field);
    let blinding_point = ec_mul(H, private.output_blinding);
    let expected_commitment = ec_add(amount_point, blinding_point);
    assert(output_commitment.x == expected_commitment.x);
    assert(output_commitment.y == expected_commitment.y);

    // 2. Verify minimum output met
    assert(private.output_amount >= public.min_output_amount);

    // 3. Verify oracle attestation
    assert(private.oracle_attestation.recipient == public.recipient_stealth);
    assert(private.oracle_attestation.amount >= private.output_amount);

    let attestation_message = sha256([
        private.oracle_attestation.recipient,
        private.oracle_attestation.amount as Field,
        private.oracle_attestation.tx_hash,
        private.oracle_attestation.block_number as Field
    ]);

    // Verify oracle signature (simplified - real impl uses threshold)
    let oracle_signature = Signature {
        r: private.oracle_attestation.signature_r,
        s: private.oracle_attestation.signature_s
    };
    // verify_threshold_signature(oracle_public_keys, attestation_message, oracle_signature);

    // 4. Verify time window
    assert(public.fulfillment_time <= public.expiry);
    assert(public.fulfillment_time > 0);

    // 5. Verify solver authorization
    let expected_solver_id = sha256([private.solver_secret]);
    assert(public.solver_id == expected_solver_id);
}
```

### 5. Constraint Count

| Component | Constraints |
|-----------|-------------|
| Output commitment verification | ~6,000 |
| EC scalar multiplication (G) | ~3,000 |
| EC scalar multiplication (H) | ~3,000 |
| Minimum output comparison | ~200 |
| Oracle signature verification | ~15,000 |
| SHA256 hashing (x3) | ~1,500 |
| Time window checks | ~100 |
| Solver ID derivation | ~500 |
| **Total** | **~22,000** (single oracle) |

**Note**: Multi-oracle threshold verification adds ~15,000 constraints per additional oracle checked.

### 6. Oracle System

#### 6.1 Oracle Role

Oracles provide cross-chain attestations:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Chain A   │     │   Oracles   │     │   Chain B   │
│  (Source)   │     │  (Bridge)   │     │   (Dest)    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ Intent submitted  │                   │
       │ ─────────────────>│                   │
       │                   │                   │
       │                   │   Watch for       │
       │                   │   fulfillment     │
       │                   │ ─────────────────>│
       │                   │                   │
       │                   │<─────────────────│
       │                   │   Delivery tx     │
       │                   │                   │
       │ Signed attestation│                   │
       │<─────────────────│                   │
       │                   │                   │
```

#### 6.2 Threshold Signature

For security, SIP recommends threshold signatures:

```
k-of-n signature scheme where:
- n = total number of oracles
- k = minimum required signatures
- Recommended: 3-of-5 or 5-of-7
```

#### 6.3 Oracle Registration

```typescript
interface OracleConfig {
  /** Oracle identifier */
  id: string

  /** Oracle's secp256k1 public key */
  publicKey: HexString

  /** Supported chains */
  chains: ChainId[]

  /** Reputation score (0-100) */
  reputation: number

  /** Stake amount (for slashing) */
  stake: bigint
}
```

### 7. Proof Generation

```typescript
interface FulfillmentProofParams {
  /** Hash of original intent (public) */
  intentHash: HexString

  /** Actual output amount delivered (private) */
  outputAmount: bigint

  /** Blinding for output commitment (private) */
  outputBlinding: Uint8Array

  /** Minimum required output (public) */
  minOutputAmount: bigint

  /** Recipient's stealth address (public) */
  recipientStealth: HexString

  /** Solver's identifier (public) */
  solverId: string

  /** Solver's secret key (private) */
  solverSecret: Uint8Array

  /** Oracle attestation (private) */
  oracleAttestation: OracleAttestation

  /** Time of fulfillment (public) */
  fulfillmentTime: number

  /** Intent expiry (public) */
  expiry: number
}

async function generateFulfillmentProof(
  params: FulfillmentProofParams
): Promise<ProofResult> {
  // 1. Compute output commitment
  const outputCommitment = commit(
    params.outputAmount,
    params.outputBlinding
  )

  // 2. Prepare public inputs
  const publicInputs = [
    params.intentHash,
    outputCommitment.x,
    outputCommitment.y,
    params.minOutputAmount,
    params.recipientStealth,
    hash(params.solverId),
    params.fulfillmentTime,
    params.expiry
  ]

  // 3. Prepare private inputs
  const privateInputs = {
    outputAmount: params.outputAmount,
    outputBlinding: params.outputBlinding,
    solverSecret: params.solverSecret,
    oracleAttestation: {
      recipient: params.oracleAttestation.recipient,
      amount: params.oracleAttestation.amount,
      txHash: params.oracleAttestation.txHash,
      blockNumber: params.oracleAttestation.blockNumber,
      signatureR: params.oracleAttestation.signature.slice(0, 32),
      signatureS: params.oracleAttestation.signature.slice(32, 64)
    }
  }

  // 4. Generate proof
  const proof = await noir.prove(
    'fulfillment_proof',
    publicInputs,
    privateInputs
  )

  return {
    proof: {
      proofType: 'fulfillment',
      proof: proof.bytes,
      publicInputs: publicInputs.map(toHex),
      verificationKey: proof.vk
    },
    commitment: outputCommitment
  }
}
```

### 8. Security Considerations

#### 8.1 Oracle Collusion

**Risk**: Oracles could collude to attest false deliveries.

**Mitigation**:
- Threshold signatures require multiple independent oracles
- Economic incentives via staking/slashing
- Reputation systems
- Geographic and organizational diversity

#### 8.2 Delivery Timing

**Risk**: Solver could deliver after expiry but backdate attestation.

**Mitigation**:
- Oracle attestation includes block number
- Block numbers are publicly verifiable
- Settlement networks verify block timestamps

#### 8.3 Amount Manipulation

**Risk**: Solver claims higher output than delivered.

**Mitigation**:
- Oracle attestation includes actual amount
- Commitment verified against attestation
- Mismatch causes proof failure

#### 8.4 Recipient Substitution

**Risk**: Solver delivers to different address.

**Mitigation**:
- Stealth address is public input
- Oracle verifies delivery to exact address
- Proof fails if addresses don't match

### 9. Integration

#### 9.1 Solver Fulfillment Flow

```typescript
// 1. Solver executes cross-chain swap
const deliveryTx = await executeSwap(
  intent.recipientStealth,
  quoteAmount
)

// 2. Wait for oracle attestation
const attestation = await waitForOracleAttestation(
  intent.intentId,
  deliveryTx.hash
)

// 3. Generate fulfillment proof
const proof = await proofProvider.generateFulfillmentProof({
  intentHash: intent.intentId,
  outputAmount: quoteAmount,
  outputBlinding: randomBytes(32),
  minOutputAmount: intent.minOutputAmount,
  recipientStealth: intent.recipientStealth.address,
  solverId: solver.id,
  solverSecret: solver.privateKey,
  oracleAttestation: attestation,
  fulfillmentTime: Date.now() / 1000,
  expiry: intent.expiry
})

// 4. Submit proof for settlement
await settlementNetwork.submitFulfillment(
  intent.intentId,
  proof.proof
)
```

#### 9.2 Settlement Verification

```typescript
// Settlement network verifies proof
async function verifyFulfillment(
  intentId: string,
  proof: ZKProof
): Promise<boolean> {
  // 1. Verify proof cryptographically
  const isValid = await proofProvider.verifyProof(proof)
  if (!isValid) return false

  // 2. Verify intent hash matches
  const [proofIntentHash] = proof.publicInputs
  if (proofIntentHash !== intentId) return false

  // 3. Verify fulfillment time
  const [, , , , , , fulfillmentTime, expiry] = proof.publicInputs
  if (fulfillmentTime > expiry) return false

  return true
}
```

### 10. Test Vectors

#### 10.1 Valid Fulfillment

```
Intent Hash: 0xabcd...1234
Output Amount: 10000000000 (10 SOL)
Min Output: 9500000000 (9.5 SOL)
Recipient Stealth: 0x02abc...def
Fulfillment Time: 1701475200
Expiry: 1701478800

Oracle Attestation:
  recipient: 0x02abc...def (matches)
  amount: 10000000000 (matches)
  txHash: 0x9876...5432
  blockNumber: 12345678

Expected: Proof validates successfully
```

#### 10.2 Insufficient Output

```
Output Amount: 9000000000 (9 SOL)
Min Output: 9500000000 (9.5 SOL)

Expected: Proof generation fails (output < minimum)
```

#### 10.3 Wrong Recipient

```
Recipient Stealth: 0x02abc...def
Oracle Attestation.recipient: 0x03xyz...789 (different)

Expected: Proof generation fails (recipient mismatch)
```

## Reference Implementation

See `packages/sdk/src/proofs/interface.ts`:
- `FulfillmentProofParams` - Input parameters
- `OracleAttestation` - Oracle attestation structure
- `ProofProvider.generateFulfillmentProof()` - Generation interface

See `packages/sdk/src/proofs/noir.ts`:
- `NoirProofProvider.generateFulfillmentProof()` - Noir implementation

See `packages/sdk/src/proofs/circuits/fulfillment_proof.nr` (planned):
- Noir circuit implementation

## References

1. [Cross-chain Bridge Security](https://blog.chain.link/cross-chain-interoperability/)
2. [Threshold Signatures](https://eprint.iacr.org/2020/540.pdf)
3. [Oracle Problem in Blockchain](https://ethereum.org/en/developers/docs/oracles/)

## Copyright

This specification is released under the MIT License.
