# ORACLE-ATTESTATION: SIP Oracle Attestation Specification

| Field | Value |
|-------|-------|
| **SIP** | 9 |
| **Title** | Oracle Attestation Protocol |
| **Authors** | SIP Protocol Team |
| **Status** | Draft |
| **Created** | 2025-12-02 |
| **Updated** | 2025-12-02 |
| **Requires** | SIP-8 (FULFILLMENT-PROOF) |

## Abstract

This specification defines the Oracle Attestation protocol used in SIP to provide cryptographic proof of cross-chain delivery. Oracles observe destination chains and produce signed attestations that are verified within ZK circuits to prove fulfillment.

## Motivation

Cross-chain intents require trustworthy proof that:
1. Funds were delivered to the correct recipient
2. The correct amount was transferred
3. Delivery occurred within the validity window

Without a standardized oracle attestation protocol:
- Solvers could claim false fulfillments
- Verifiers couldn't validate cross-chain delivery
- The system would be vulnerable to fraud

## Specification

### 1. Design Decisions

#### 1.1 Signature Scheme: EdDSA on ed25519

**Choice**: EdDSA (Ed25519) over ECDSA (secp256k1) or Schnorr

**Rationale**:

| Factor | Ed25519 | secp256k1 ECDSA | Schnorr |
|--------|---------|-----------------|---------|
| **Solana/NEAR native** | Yes | No | No |
| **Verification cost** | ~4,000 constraints | ~30,000 constraints | ~5,000 constraints |
| **Batch verification** | Efficient | Complex | Efficient |
| **Signature size** | 64 bytes | 64-65 bytes | 64 bytes |
| **Deterministic** | Yes | With RFC6979 | Yes |
| **Implementation maturity** | High | High | Medium |

**Winner**: Ed25519 for lower circuit cost and native chain compatibility.

#### 1.2 Threshold Scheme: Multi-signature (Not Threshold)

**Choice**: k-of-n multi-signature over threshold signature (TSS)

**Rationale**:
- Simpler implementation
- No DKG ceremony required
- Each oracle maintains independent keys
- Signatures verifiable individually

**Trade-off**: Larger proof size (k signatures vs 1 aggregate), but simpler trusted setup.

#### 1.3 Recommended Configuration

```
Default: 3-of-5 multi-signature
- n = 5 total oracles
- k = 3 required signatures
- Fault tolerance: Can lose 2 oracles
```

### 2. Message Format

#### 2.1 Attestation Message Structure

The canonical message format that oracles sign:

```
OracleAttestationMessage = {
  version: u8,              // Protocol version (1)
  chainId: u32,             // Destination chain ID
  intentHash: bytes32,      // Hash of original intent
  recipient: bytes32,       // Recipient address (normalized)
  amount: u128,             // Amount delivered (in smallest unit)
  assetId: bytes32,         // Asset identifier hash
  txHash: bytes32,          // Transaction hash on destination
  blockNumber: u64,         // Block containing transaction
  blockHash: bytes32,       // Block hash for finality
  timestamp: u64            // Unix timestamp of attestation
}
```

#### 2.2 Canonical Serialization

For deterministic signing, the message is serialized as:

```typescript
function serializeAttestationMessage(msg: OracleAttestationMessage): Uint8Array {
  const buffer = new Uint8Array(1 + 4 + 32 + 32 + 16 + 32 + 32 + 8 + 32 + 8)
  let offset = 0

  // version (1 byte)
  buffer[offset++] = msg.version

  // chainId (4 bytes, big-endian)
  new DataView(buffer.buffer).setUint32(offset, msg.chainId, false)
  offset += 4

  // intentHash (32 bytes)
  buffer.set(msg.intentHash, offset)
  offset += 32

  // recipient (32 bytes, zero-padded)
  buffer.set(normalizeAddress(msg.recipient), offset)
  offset += 32

  // amount (16 bytes, big-endian u128)
  buffer.set(bigintToBytes(msg.amount, 16), offset)
  offset += 16

  // assetId (32 bytes)
  buffer.set(msg.assetId, offset)
  offset += 32

  // txHash (32 bytes)
  buffer.set(msg.txHash, offset)
  offset += 32

  // blockNumber (8 bytes, big-endian)
  new DataView(buffer.buffer).setBigUint64(offset, BigInt(msg.blockNumber), false)
  offset += 8

  // blockHash (32 bytes)
  buffer.set(msg.blockHash, offset)
  offset += 32

  // timestamp (8 bytes, big-endian)
  new DataView(buffer.buffer).setBigUint64(offset, BigInt(msg.timestamp), false)

  return buffer
}
```

**Total message size**: 197 bytes

#### 2.3 Signing Process

```typescript
function signAttestation(
  message: OracleAttestationMessage,
  privateKey: Uint8Array
): OracleSignature {
  // 1. Serialize message canonically
  const messageBytes = serializeAttestationMessage(message)

  // 2. Hash with domain separator
  const domain = utf8ToBytes('SIP-ORACLE-ATTESTATION-V1')
  const toSign = sha256(concat(domain, messageBytes))

  // 3. Sign with Ed25519
  const signature = ed25519.sign(toSign, privateKey)

  return {
    oracleId: deriveOracleId(privateKey),
    signature: signature,
    message: message
  }
}
```

### 3. Oracle Registry

#### 3.1 Registry Structure

```typescript
interface OracleRegistry {
  /** Registered oracles indexed by ID */
  oracles: Map<OracleId, OracleInfo>

  /** Required signature threshold */
  threshold: number

  /** Registry version (for upgrades) */
  version: number

  /** Last update timestamp */
  lastUpdated: number
}

interface OracleInfo {
  /** Unique oracle identifier (hash of public key) */
  id: OracleId

  /** Oracle's Ed25519 public key (32 bytes) */
  publicKey: Uint8Array

  /** Human-readable name */
  name: string

  /** Supported destination chains */
  supportedChains: ChainId[]

  /** Oracle endpoint URL */
  endpoint: string

  /** Registration timestamp */
  registeredAt: number

  /** Current status */
  status: 'active' | 'suspended' | 'removed'

  /** Reputation score (0-100) */
  reputation: number

  /** Staked amount (for slashing) */
  stake: bigint
}

type OracleId = HexString // 32-byte hash of public key
```

#### 3.2 Oracle ID Derivation

```typescript
function deriveOracleId(publicKey: Uint8Array): OracleId {
  // Oracle ID = SHA256(public key)
  const hash = sha256(publicKey)
  return `0x${bytesToHex(hash)}` as OracleId
}
```

#### 3.3 Registry Operations

```typescript
interface OracleRegistryOperations {
  /** Register a new oracle (governance action) */
  registerOracle(info: OracleInfo): Promise<void>

  /** Update oracle status */
  updateOracleStatus(id: OracleId, status: OracleStatus): Promise<void>

  /** Get active oracles for a chain */
  getActiveOracles(chain: ChainId): OracleInfo[]

  /** Verify oracle is valid and active */
  isValidOracle(id: OracleId): boolean

  /** Get current threshold */
  getThreshold(): number
}
```

### 4. Attestation Verification

#### 4.1 Off-Chain Verification (TypeScript)

```typescript
interface OracleAttestation {
  /** The signed message */
  message: OracleAttestationMessage

  /** Array of oracle signatures (k-of-n) */
  signatures: OracleSignature[]
}

interface OracleSignature {
  /** Oracle that produced this signature */
  oracleId: OracleId

  /** Ed25519 signature (64 bytes) */
  signature: Uint8Array
}

function verifyAttestation(
  attestation: OracleAttestation,
  registry: OracleRegistry
): boolean {
  const { message, signatures } = attestation

  // 1. Check we have enough signatures
  if (signatures.length < registry.threshold) {
    return false
  }

  // 2. Serialize message for verification
  const messageBytes = serializeAttestationMessage(message)
  const domain = utf8ToBytes('SIP-ORACLE-ATTESTATION-V1')
  const toVerify = sha256(concat(domain, messageBytes))

  // 3. Verify each signature
  let validCount = 0
  const seenOracles = new Set<OracleId>()

  for (const sig of signatures) {
    // Check for duplicate oracles
    if (seenOracles.has(sig.oracleId)) {
      continue
    }
    seenOracles.add(sig.oracleId)

    // Get oracle from registry
    const oracle = registry.oracles.get(sig.oracleId)
    if (!oracle || oracle.status !== 'active') {
      continue
    }

    // Verify Ed25519 signature
    const isValid = ed25519.verify(sig.signature, toVerify, oracle.publicKey)
    if (isValid) {
      validCount++
    }
  }

  // 4. Check threshold met
  return validCount >= registry.threshold
}
```

#### 4.2 In-Circuit Verification (Noir)

```noir
// oracle_verification.nr

use dep::std::hash::sha256;
use dep::std::eddsa::eddsa_poseidon_verify;

// Domain separator hash (precomputed)
global DOMAIN_HASH: Field = 0x...; // SHA256("SIP-ORACLE-ATTESTATION-V1")

// Oracle public keys (hardcoded or passed as public inputs)
global ORACLE_THRESHOLD: u32 = 3;

struct OraclePublicKey {
    x: Field,
    y: Field,
}

struct OracleSignature {
    r_x: Field,
    r_y: Field,
    s: Field,
}

struct AttestationMessage {
    chain_id: u32,
    intent_hash: Field,
    recipient: Field,
    amount: u64,
    asset_id: Field,
    tx_hash: Field,
    block_number: u64,
    timestamp: u64,
}

/// Verify that k-of-n oracles signed the attestation
fn verify_oracle_attestation(
    message: AttestationMessage,
    oracle_public_keys: [OraclePublicKey; 5],
    signatures: [OracleSignature; 5],
    signature_mask: [bool; 5],  // Which signatures are provided
) {
    // 1. Hash the attestation message
    let message_hash = hash_attestation_message(message);

    // 2. Count valid signatures
    let mut valid_count: u32 = 0;

    for i in 0..5 {
        if signature_mask[i] {
            // Verify this signature
            let is_valid = eddsa_poseidon_verify(
                oracle_public_keys[i].x,
                oracle_public_keys[i].y,
                signatures[i].s,
                signatures[i].r_x,
                signatures[i].r_y,
                message_hash
            );

            if is_valid {
                valid_count += 1;
            }
        }
    }

    // 3. Ensure threshold met
    assert(valid_count >= ORACLE_THRESHOLD);
}

/// Hash attestation message for signing
fn hash_attestation_message(msg: AttestationMessage) -> Field {
    // Serialize and hash all fields
    sha256([
        msg.chain_id as Field,
        msg.intent_hash,
        msg.recipient,
        msg.amount as Field,
        msg.asset_id,
        msg.tx_hash,
        msg.block_number as Field,
        msg.timestamp as Field,
    ])
}
```

### 5. Circuit Integration

#### 5.1 Fulfillment Proof with Oracle Verification

```noir
// fulfillment_proof_with_oracle.nr

struct FulfillmentPublic {
    intent_hash: Field,
    output_commitment_x: Field,
    output_commitment_y: Field,
    min_output_amount: u64,
    recipient_stealth: Field,
    oracle_public_keys: [OraclePublicKey; 5],
}

struct FulfillmentPrivate {
    output_amount: u64,
    output_blinding: Field,
    attestation: AttestationMessage,
    signatures: [OracleSignature; 5],
    signature_mask: [bool; 5],
}

fn main(public: FulfillmentPublic, private: FulfillmentPrivate) {
    // 1. Verify output commitment (same as before)
    verify_output_commitment(
        public.output_commitment_x,
        public.output_commitment_y,
        private.output_amount,
        private.output_blinding
    );

    // 2. Verify minimum output met
    assert(private.output_amount >= public.min_output_amount);

    // 3. Verify oracle attestation
    verify_oracle_attestation(
        private.attestation,
        public.oracle_public_keys,
        private.signatures,
        private.signature_mask
    );

    // 4. Verify attestation matches intent
    assert(private.attestation.intent_hash == public.intent_hash);
    assert(private.attestation.recipient == public.recipient_stealth);
    assert(private.attestation.amount >= private.output_amount);
}
```

#### 5.2 Constraint Counts

| Component | Constraints |
|-----------|-------------|
| Ed25519 signature verification (per oracle) | ~4,000 |
| Message hashing | ~500 |
| Comparison operations | ~100 |
| **Per-oracle total** | ~4,600 |
| **3-of-5 verification** | ~23,000 |
| **Full fulfillment proof** | ~45,000 |

### 6. Trust Model

#### 6.1 Trust Assumptions

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRUST ASSUMPTIONS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TRUSTED:                                                        │
│  ├── Ed25519 cryptographic security                              │
│  ├── SHA256 collision resistance                                 │
│  ├── At least k-of-n oracles are honest                          │
│  └── Block finality on destination chain                         │
│                                                                  │
│  NOT TRUSTED:                                                    │
│  ├── Individual oracles (may be compromised)                     │
│  ├── Network between oracles and chains                          │
│  ├── Solvers (may attempt fraud)                                 │
│  └── Timing (oracles may be slow)                                │
│                                                                  │
│  SECURITY PROPERTIES:                                            │
│  ├── Soundness: Forging requires breaking Ed25519 or             │
│  │              compromising k oracles                           │
│  ├── Liveness: System works if n-k+1 oracles operational         │
│  └── Privacy: Attestation reveals delivery details (by design)   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2 Threat Analysis

| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| **Single oracle compromise** | Threshold (k-of-n) | Low |
| **Collusion (k oracles)** | Diverse operators, staking | Medium |
| **Replay attack** | Intent hash in message | None |
| **Amount manipulation** | Signed amount verified | None |
| **Recipient substitution** | Recipient in signed message | None |
| **Timing attack** | Block number verified | Low |
| **Eclipse attack on oracle** | Multiple oracles | Low |

#### 6.3 Slashing Conditions

Oracles can be slashed for:

1. **False attestation**: Signing delivery that didn't occur
2. **Double attestation**: Signing conflicting attestations
3. **Unavailability**: Extended downtime (soft slash)
4. **Key compromise**: Not reporting compromised keys

### 7. Oracle Operations

#### 7.1 Oracle Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Application │ ──> │  Staking    │ ──> │   Active    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┼──────────────┐
                    │                          │              │
                    ▼                          ▼              ▼
            ┌─────────────┐          ┌─────────────┐  ┌─────────────┐
            │  Suspended  │          │   Removed   │  │   Slashed   │
            └─────────────┘          └─────────────┘  └─────────────┘
```

#### 7.2 Attestation Request Flow

```typescript
// Oracle receives attestation request
interface AttestationRequest {
  intentHash: HexString
  destinationChain: ChainId
  expectedRecipient: HexString
  expectedAsset: HexString
  minAmount: bigint
  deadline: number
}

// Oracle produces attestation
async function produceAttestation(
  request: AttestationRequest,
  oraclePrivateKey: Uint8Array
): Promise<OracleSignature | null> {
  // 1. Query destination chain for fulfillment
  const tx = await findFulfillmentTx(
    request.destinationChain,
    request.expectedRecipient,
    request.expectedAsset,
    request.intentHash
  )

  if (!tx) {
    return null // Fulfillment not found
  }

  // 2. Verify transaction meets requirements
  if (tx.amount < request.minAmount) {
    return null // Insufficient amount
  }

  if (tx.blockTimestamp > request.deadline) {
    return null // Too late
  }

  // 3. Wait for finality
  await waitForFinality(request.destinationChain, tx.blockNumber)

  // 4. Construct and sign attestation
  const message: OracleAttestationMessage = {
    version: 1,
    chainId: getChainNumericId(request.destinationChain),
    intentHash: hexToBytes(request.intentHash),
    recipient: normalizeAddress(tx.recipient),
    amount: tx.amount,
    assetId: hashAsset(request.expectedAsset),
    txHash: hexToBytes(tx.hash),
    blockNumber: tx.blockNumber,
    blockHash: hexToBytes(tx.blockHash),
    timestamp: Math.floor(Date.now() / 1000)
  }

  return signAttestation(message, oraclePrivateKey)
}
```

### 8. Security Recommendations

#### 8.1 For Oracle Operators

1. **Key management**: Use HSM or secure enclave for private keys
2. **Infrastructure**: Run redundant nodes for each monitored chain
3. **Monitoring**: Alert on signing failures or chain reorgs
4. **Updates**: Keep oracle software and chain clients updated

#### 8.2 For Integrators

1. **Verify registry**: Only accept signatures from registered oracles
2. **Check finality**: Wait for appropriate block confirmations
3. **Timeout handling**: Implement deadlines for attestation requests
4. **Fallback**: Have dispute resolution for edge cases

#### 8.3 For Users

1. **Verify proofs**: Check fulfillment proofs before releasing funds
2. **Monitor intents**: Track intent status through the protocol
3. **Report fraud**: Flag suspicious oracle behavior

### 9. Test Vectors

#### 9.1 Valid Attestation

```
Message:
  version: 1
  chainId: 1 (Ethereum)
  intentHash: 0xabcd...1234
  recipient: 0x742d35Cc6634C0532925a3b844Bc9e7595f...
  amount: 1000000000000000000 (1 ETH)
  assetId: 0x0000...0000 (native ETH)
  txHash: 0x9876...5432
  blockNumber: 18500000
  blockHash: 0xfedc...ba98
  timestamp: 1701475200

Serialized (hex): 0x01...

Domain + Message Hash: 0x5678...abcd

Oracle Keys (example):
  Oracle 1: 0x02abc...
  Oracle 2: 0x03def...
  Oracle 3: 0x02ghi...

Signatures:
  Oracle 1: 0x1234...5678
  Oracle 2: 0x2345...6789
  Oracle 3: 0x3456...789a

Expected: Verification succeeds (3-of-5)
```

#### 9.2 Invalid - Insufficient Signatures

```
Same message as above
Signatures: Only 2 provided

Expected: Verification fails (threshold not met)
```

#### 9.3 Invalid - Duplicate Oracle

```
Same message as above
Signatures: 3 signatures, but 2 from same oracle

Expected: Verification fails (only 2 unique oracles)
```

## Reference Implementation

See:
- `packages/sdk/src/proofs/interface.ts` - TypeScript interfaces
- `packages/sdk/src/oracle/` - Oracle client implementation
- `circuits/fulfillment_proof/` - Noir circuit

## References

1. [Ed25519 Specification (RFC 8032)](https://tools.ietf.org/html/rfc8032)
2. [Threshold Cryptography](https://en.wikipedia.org/wiki/Threshold_cryptosystem)
3. [Oracle Problem in Blockchain](https://ethereum.org/en/developers/docs/oracles/)
4. [Cross-chain Bridge Security](https://blog.chain.link/cross-chain-interoperability/)

## Copyright

This specification is released under the MIT License.
