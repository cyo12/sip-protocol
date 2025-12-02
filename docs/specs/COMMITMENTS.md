# COMMITMENTS: SIP Pedersen Commitment Specification

| Field | Value |
|-------|-------|
| **SIP** | 3 |
| **Title** | Pedersen Commitment Scheme |
| **Authors** | SIP Protocol Team |
| **Status** | Draft |
| **Created** | 2024-11-01 |
| **Updated** | 2025-12-02 |
| **Requires** | SIP-1 (SIP-PROTOCOL) |

## Abstract

This specification defines the Pedersen commitment scheme used in SIP to hide transaction amounts while enabling verification. Pedersen commitments provide information-theoretic hiding (amount cannot be determined) and computational binding (cannot open to different value).

## Motivation

Transaction amounts reveal sensitive financial information:
- Portfolio sizes and trading strategies
- Payment amounts between parties
- Input/output relationships that can deanonymize users

Pedersen commitments solve this by allowing:
1. **Amount hiding**: Observers cannot determine the committed value
2. **Verification**: Provers can demonstrate properties (e.g., balance ≥ minimum)
3. **Homomorphic operations**: Commitments can be added/subtracted

## Specification

### 1. Mathematical Foundation

A Pedersen commitment to value `v` with blinding factor `r` is:

```
C = v*G + r*H
```

Where:
- `v` ∈ Z_n (value to commit, 0 ≤ v < n)
- `r` ∈ Z_n (random blinding factor)
- `G` = secp256k1 generator point
- `H` = independent generator (NUMS construction)
- `n` = secp256k1 curve order

### 2. Security Properties

| Property | Guarantee | Assumption |
|----------|-----------|------------|
| **Hiding** | Perfect (information-theoretic) | None |
| **Binding** | Computational | Discrete log of H w.r.t. G unknown |

**Hiding**: For any commitment `C`, all values `v` are equally likely given only `C`.

**Binding**: Cannot find `(v, r)` and `(v', r')` where `v ≠ v'` and both open `C`, unless you can solve discrete log.

### 3. Generator H Construction

H must be generated such that nobody knows `log_G(H)` (the discrete logarithm of H with respect to G). SIP uses the "Nothing-Up-My-Sleeve" (NUMS) method:

```
CONSTANT H_DOMAIN = "SIP-PEDERSEN-GENERATOR-H-v1"

FUNCTION generateH():
  FOR counter = 0 TO 255:
    input = H_DOMAIN + ":" + counter
    hash = SHA256(input)

    // Try to create point with even y-coordinate
    pointBytes = 0x02 || hash  // 33 bytes, compressed with even y

    TRY:
      H = secp256k1.ProjectivePoint.fromHex(pointBytes)
      IF H != ZERO AND H != G:
        RETURN H
    CATCH:
      CONTINUE

  THROW "Failed to generate H"
```

**Rationale**: Using a hash-derived x-coordinate with a public domain separator ensures:
1. No party chose H to know its discrete log
2. The derivation is reproducible and verifiable
3. Counter increments handle invalid x-coordinates

### 4. Commitment Operations

#### 4.1 Creating a Commitment

```
FUNCTION commit(value, blinding=null):
  REQUIRE value >= 0
  REQUIRE value < CURVE_ORDER

  // Generate blinding if not provided
  IF blinding == null:
    blinding = random(32)
  REQUIRE len(blinding) == 32

  // Reduce blinding to valid scalar
  r = bytesToBigInt(blinding) mod CURVE_ORDER
  REQUIRE r != 0  // Zero blinding is insecure

  // C = v*G + r*H
  IF value == 0:
    C = H.multiply(r)
  ELSE:
    vG = G.multiply(value)
    rH = H.multiply(r)
    C = vG.add(rH)

  RETURN {
    commitment: "0x" || hex(C.toRawBytes(compressed=true)),
    blinding: "0x" || hex(blinding)
  }
```

#### 4.2 Verifying an Opening

```
FUNCTION verifyOpening(commitment, value, blinding):
  TRY:
    C = secp256k1.ProjectivePoint.fromHex(commitment)

    // Recompute expected commitment
    r = bytesToBigInt(blinding) mod CURVE_ORDER

    IF value == 0:
      expected = H.multiply(r)
    ELSE:
      vG = G.multiply(value)
      rH = H.multiply(r)
      expected = vG.add(rH)

    RETURN C.equals(expected)
  CATCH:
    RETURN false
```

### 5. Homomorphic Operations

Pedersen commitments support additive homomorphism:

#### 5.1 Addition

```
C(v1, r1) + C(v2, r2) = C(v1 + v2, r1 + r2)
```

```
FUNCTION addCommitments(c1, c2):
  point1 = secp256k1.ProjectivePoint.fromHex(c1)
  point2 = secp256k1.ProjectivePoint.fromHex(c2)

  sum = point1.add(point2)

  RETURN {
    commitment: "0x" || hex(sum.toRawBytes(compressed=true))
  }
```

#### 5.2 Subtraction

```
C(v1, r1) - C(v2, r2) = C(v1 - v2, r1 - r2)
```

```
FUNCTION subtractCommitments(c1, c2):
  point1 = secp256k1.ProjectivePoint.fromHex(c1)
  point2 = secp256k1.ProjectivePoint.fromHex(c2)

  diff = point1.subtract(point2)

  // Handle point at infinity (zero commitment)
  IF diff.equals(ZERO):
    RETURN { commitment: "0x00" }

  RETURN {
    commitment: "0x" || hex(diff.toRawBytes(compressed=true))
  }
```

#### 5.3 Blinding Factor Arithmetic

When performing homomorphic operations, blinding factors must also be combined:

```
FUNCTION addBlindings(b1, b2):
  r1 = bytesToBigInt(hexToBytes(b1))
  r2 = bytesToBigInt(hexToBytes(b2))

  sum = (r1 + r2) mod CURVE_ORDER

  RETURN "0x" || hex(bigIntToBytes(sum, 32))

FUNCTION subtractBlindings(b1, b2):
  r1 = bytesToBigInt(hexToBytes(b1))
  r2 = bytesToBigInt(hexToBytes(b2))

  // Handle underflow with modular arithmetic
  diff = (r1 - r2 + CURVE_ORDER) mod CURVE_ORDER

  RETURN "0x" || hex(bigIntToBytes(diff, 32))
```

### 6. Data Structures

#### 6.1 Commitment Type

```typescript
interface Commitment {
  /** The commitment point C = v*G + r*H (33 bytes compressed) */
  value: HexString

  /** The blinding factor r (32 bytes, must be kept secret) */
  blindingFactor: HexString
}
```

#### 6.2 Public Commitment Point

```typescript
interface CommitmentPoint {
  /** The commitment point only (for public sharing) */
  commitment: HexString
}
```

### 7. Use in SIP Protocol

#### 7.1 Input Amount Commitment

```
When creating a shielded intent:
1. inputCommitment = commit(inputAmount)
2. Store inputCommitment in ShieldedIntent
3. Use inputCommitment.blindingFactor in Funding Proof
```

#### 7.2 Sender Commitment

```
When hiding sender identity:
1. senderHash = SHA256(senderAddress)[0:8]  // Truncate to 64 bits
2. senderCommitment = commit(senderHash)
3. Use in Validity Proof to prove authorization
```

#### 7.3 Balance Proofs

Homomorphic properties enable balance verification:

```
// Prove: inputs >= outputs (no inflation)
inputsCommitment = sum(inputCommitments)
outputsCommitment = sum(outputCommitments)
difference = subtract(inputsCommitment, outputsCommitment)

// If difference == commit(0), then inputs == outputs
// (with knowledge of blinding factor difference)
```

### 8. Generator Points

#### 8.1 G (Base Generator)

Standard secp256k1 generator point:

```
G.x = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
G.y = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8
```

#### 8.2 H (Independent Generator)

SIP's NUMS generator (first valid point from domain separator hash):

```
Domain: "SIP-PEDERSEN-GENERATOR-H-v1"
Counter: <implementation dependent, typically 0-5>

// Result depends on implementation
// Verify by running generateH() with domain separator
```

### 9. Security Considerations

#### 9.1 Blinding Factor Generation

**Risk**: Predictable or reused blinding factors break hiding.

**Mitigation**:
- Use CSPRNG for blinding generation
- Never reuse blinding factors
- Securely wipe blindings after use

#### 9.2 Zero Blinding

**Risk**: Zero blinding reveals the value (C = v*G is deterministic).

**Mitigation**: Reject zero blinding factors during commitment creation.

#### 9.3 Value Range

**Risk**: Values ≥ curve order wrap around, breaking binding.

**Mitigation**: Validate 0 ≤ value < CURVE_ORDER before committing.

#### 9.4 Generator Independence

**Risk**: If someone knows `log_G(H) = k`, they can open any commitment to any value.

**Mitigation**: Use NUMS construction with public domain separator.

### 10. Test Vectors

#### 10.1 Basic Commitment

```
Value: 1000000000000000000 (1 ETH in wei, as bigint)
Blinding: 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

Expected Commitment: 0x02... (verify with implementation)
```

#### 10.2 Zero Value Commitment

```
Value: 0
Blinding: 0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210

// C = 0*G + r*H = r*H
Expected: Point on curve (verify with implementation)
```

#### 10.3 Homomorphic Addition

```
v1 = 100, r1 = random_blinding_1
v2 = 50,  r2 = random_blinding_2

C1 = commit(v1, r1)
C2 = commit(v2, r2)
C_sum = addCommitments(C1.commitment, C2.commitment)

// Verify: C_sum opens to 150 with blinding r1 + r2
r_sum = addBlindings(r1, r2)
verifyOpening(C_sum.commitment, 150, r_sum) == true
```

### 11. Integration with ZK Proofs

Pedersen commitments integrate with Noir circuits through the generator points:

```typescript
// Export generators for circuit use
function getGenerators() {
  return {
    G: { x: G.x, y: G.y },
    H: { x: H.x, y: H.y }
  }
}
```

Circuits can then verify commitments in-circuit by:
1. Taking commitment point as public input
2. Taking value and blinding as private inputs
3. Computing C' = v*G + r*H
4. Asserting C' == C

## Reference Implementation

See `packages/sdk/src/commitment.ts` in the SIP Protocol repository:
- `commit()` - Create a Pedersen commitment
- `verifyOpening()` - Verify a commitment opening
- `addCommitments()` - Homomorphic addition
- `subtractCommitments()` - Homomorphic subtraction
- `addBlindings()` / `subtractBlindings()` - Blinding arithmetic
- `getGenerators()` - Export G and H for ZK circuits

## References

1. [Pedersen, T. (1991). Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing](https://link.springer.com/chapter/10.1007/3-540-46766-1_9)
2. [SEC 2: Recommended Elliptic Curve Domain Parameters](https://www.secg.org/sec2-v2.pdf)
3. [Zcash Protocol Specification - Pedersen Commitment](https://zips.z.cash/protocol/protocol.pdf)

## Copyright

This specification is released under the MIT License.
