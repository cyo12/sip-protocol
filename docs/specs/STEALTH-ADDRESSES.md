# STEALTH-ADDRESSES: SIP Stealth Address Specification

| Field | Value |
|-------|-------|
| **SIP** | 2 |
| **Title** | Stealth Address Generation and Scanning |
| **Authors** | SIP Protocol Team |
| **Status** | Draft |
| **Created** | 2024-11-01 |
| **Updated** | 2025-12-02 |
| **Requires** | SIP-1 (SIP-PROTOCOL) |

## Abstract

This specification defines the stealth address scheme used in SIP for recipient privacy. Stealth addresses are one-time addresses that cannot be linked to the recipient's public identity, providing unlinkability for cross-chain transactions.

SIP supports two elliptic curves:
- **secp256k1**: For EVM-compatible chains (Ethereum, Polygon, Arbitrum, etc.)
- **ed25519**: For Solana and NEAR

## Motivation

Standard blockchain addresses are reusable and publicly visible, creating several privacy issues:

1. **Linkability**: All transactions to an address can be correlated
2. **Balance exposure**: Anyone can see the recipient's total balance
3. **Transaction graph**: Payment networks can be reconstructed
4. **Targeted attacks**: High-value addresses become targets

Stealth addresses solve these issues by generating a unique, one-time address for each transaction that only the intended recipient can spend from.

## Specification

### 1. Overview

SIP implements the Dual-Key Stealth Address Protocol (DKSAP), adapted from EIP-5564:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    STEALTH ADDRESS PROTOCOL                               │
└──────────────────────────────────────────────────────────────────────────┘

Recipient Setup (once):
┌─────────────────────┐
│ Generate Keypairs   │
│ p, q ← random       │
│ P = p*G (spending)  │
│ Q = q*G (viewing)   │
│ Publish (P, Q)      │
└─────────────────────┘

Sender (per transaction):
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ Generate Ephemeral  │ --> │ Compute Shared      │ --> │ Derive Stealth      │
│ r ← random          │     │ Secret              │     │ Address             │
│ R = r*G             │     │ S = r*P             │     │ A = Q + H(S)*G      │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘

Recipient (scanning):
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│ For each R on chain │ --> │ Compute Shared      │ --> │ Check if A matches  │
│                     │     │ Secret              │     │ a = q + H(S)        │
│                     │     │ S = p*R             │     │ a*G == A ?          │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

### 2. Key Generation

#### 2.1 secp256k1 (EVM chains)

```
FUNCTION generateStealthMetaAddress(chain):
  REQUIRE chain IN {ethereum, polygon, arbitrum, optimism, base, zcash}

  // Generate random 32-byte private keys
  spending_private ← random(32)
  viewing_private  ← random(32)

  // Derive compressed public keys (33 bytes)
  spending_public ← secp256k1.getPublicKey(spending_private, compressed=true)
  viewing_public  ← secp256k1.getPublicKey(viewing_private, compressed=true)

  RETURN {
    metaAddress: {
      spendingKey: "0x" || hex(spending_public),
      viewingKey:  "0x" || hex(viewing_public),
      chain: chain
    },
    spendingPrivateKey: "0x" || hex(spending_private),
    viewingPrivateKey:  "0x" || hex(viewing_private)
  }
```

**Key format (secp256k1 compressed):**
- Length: 33 bytes
- Prefix: `0x02` (even y) or `0x03` (odd y)
- Body: 32-byte x-coordinate

#### 2.2 ed25519 (Solana, NEAR)

```
FUNCTION generateEd25519StealthMetaAddress(chain):
  REQUIRE chain IN {solana, near}

  // Generate random 32-byte seeds
  spending_seed ← random(32)
  viewing_seed  ← random(32)

  // Derive public keys (32 bytes each)
  spending_public ← ed25519.getPublicKey(spending_seed)
  viewing_public  ← ed25519.getPublicKey(viewing_seed)

  RETURN {
    metaAddress: {
      spendingKey: "0x" || hex(spending_public),
      viewingKey:  "0x" || hex(viewing_public),
      chain: chain
    },
    spendingPrivateKey: "0x" || hex(spending_seed),
    viewingPrivateKey:  "0x" || hex(viewing_seed)
  }
```

**Key format (ed25519):**
- Length: 32 bytes
- No prefix (raw public key point)

### 3. Stealth Address Generation

#### 3.1 secp256k1 Generation

```
FUNCTION generateStealthAddress(recipientMetaAddress):
  P ← recipientMetaAddress.spendingKey  // Spending public key
  Q ← recipientMetaAddress.viewingKey   // Viewing public key

  // Generate ephemeral keypair
  r ← random(32)
  R ← secp256k1.getPublicKey(r, compressed=true)

  // Compute shared secret (ECDH)
  S_point ← secp256k1.getSharedSecret(r, P)  // S = r*P

  // Hash shared secret to scalar
  S_hash ← SHA256(S_point)

  // Derive stealth address: A = Q + H(S)*G
  H_G ← secp256k1.getPublicKey(S_hash, compressed=true)  // H(S)*G
  Q_point ← secp256k1.ProjectivePoint.fromHex(Q)
  H_G_point ← secp256k1.ProjectivePoint.fromHex(H_G)
  A_point ← Q_point.add(H_G_point)
  A ← A_point.toRawBytes(compressed=true)

  // View tag for efficient scanning
  viewTag ← S_hash[0]  // First byte (0-255)

  RETURN {
    stealthAddress: {
      address: "0x" || hex(A),
      ephemeralPublicKey: "0x" || hex(R),
      viewTag: viewTag
    },
    sharedSecret: "0x" || hex(S_hash)
  }
```

#### 3.2 ed25519 Generation

```
FUNCTION generateEd25519StealthAddress(recipientMetaAddress):
  P ← recipientMetaAddress.spendingKey  // Spending public key (32 bytes)
  Q ← recipientMetaAddress.viewingKey   // Viewing public key (32 bytes)

  // Generate ephemeral keypair
  r_seed ← random(32)
  R ← ed25519.getPublicKey(r_seed)

  // Get ephemeral scalar (ed25519 key derivation)
  r_scalar ← getEd25519Scalar(r_seed) mod L

  // Compute shared secret: S = r_scalar * P
  P_point ← ed25519.ExtendedPoint.fromHex(P)
  S_point ← P_point.multiply(r_scalar)

  // Hash shared secret to scalar
  S_hash ← SHA256(S_point.toRawBytes())
  h_scalar ← bytesToBigInt(S_hash) mod L

  // Derive stealth address: A = Q + h*G
  h_G ← ed25519.ExtendedPoint.BASE.multiply(h_scalar)
  Q_point ← ed25519.ExtendedPoint.fromHex(Q)
  A_point ← Q_point.add(h_G)
  A ← A_point.toRawBytes()

  // View tag
  viewTag ← S_hash[0]

  RETURN {
    stealthAddress: {
      address: "0x" || hex(A),
      ephemeralPublicKey: "0x" || hex(R),
      viewTag: viewTag
    },
    sharedSecret: "0x" || hex(S_hash)
  }

FUNCTION getEd25519Scalar(seed):
  // ed25519 key derivation per RFC 8032
  hash ← SHA512(seed)
  scalar ← hash[0:32]

  // Clamp scalar
  scalar[0] &= 248
  scalar[31] &= 127
  scalar[31] |= 64

  RETURN bytesToBigIntLE(scalar)
```

**ed25519 Curve Order:**
```
L = 2^252 + 27742317777372353535851937790883648493
```

### 4. Address Recovery (Recipient)

#### 4.1 secp256k1 Recovery

```
FUNCTION deriveStealthPrivateKey(stealthAddress, spendingPrivKey, viewingPrivKey):
  R ← stealthAddress.ephemeralPublicKey

  // Compute shared secret: S = p*R (spending private * ephemeral public)
  S_point ← secp256k1.getSharedSecret(spendingPrivKey, R)
  S_hash ← SHA256(S_point)

  // Derive stealth private key: a = q + H(S) mod n
  q ← bytesToBigInt(viewingPrivKey)
  h ← bytesToBigInt(S_hash)
  a ← (q + h) mod secp256k1.CURVE.n

  RETURN {
    stealthAddress: stealthAddress.address,
    ephemeralPublicKey: R,
    privateKey: "0x" || hex(bigIntToBytes(a, 32))
  }
```

#### 4.2 ed25519 Recovery

```
FUNCTION deriveEd25519StealthPrivateKey(stealthAddress, spendingPrivKey, viewingPrivKey):
  R ← stealthAddress.ephemeralPublicKey

  // Get scalars from private keys
  p_scalar ← getEd25519Scalar(spendingPrivKey) mod L
  q_scalar ← getEd25519Scalar(viewingPrivKey) mod L

  // Compute shared secret: S = p_scalar * R
  R_point ← ed25519.ExtendedPoint.fromHex(R)
  S_point ← R_point.multiply(p_scalar)
  S_hash ← SHA256(S_point.toRawBytes())

  // Derive stealth private scalar: a = q_scalar + H(S) mod L
  h_scalar ← bytesToBigInt(S_hash) mod L
  a_scalar ← (q_scalar + h_scalar) mod L

  // IMPORTANT: Return raw scalar, NOT ed25519 seed
  RETURN {
    stealthAddress: stealthAddress.address,
    ephemeralPublicKey: R,
    privateKey: "0x" || hex(bigIntToBytesLE(a_scalar, 32))
  }
```

**Critical Note for ed25519:**

The derived private key is a **raw scalar**, not a standard ed25519 seed. To compute the corresponding public key:

```typescript
// CORRECT: Direct scalar multiplication
const scalar = bytesToBigIntLE(hexToBytes(privateKey.slice(2)))
const publicKey = ed25519.ExtendedPoint.BASE.multiply(scalar)

// WRONG: Do NOT use getPublicKey() - it hashes the input
// const publicKey = ed25519.getPublicKey(privateKey) // INCORRECT!
```

### 5. Address Scanning (View Tag Optimization)

The view tag enables efficient scanning by allowing quick rejection of non-matching addresses:

```
FUNCTION checkStealthAddress(stealthAddress, spendingPrivKey, viewingPrivKey):
  R ← stealthAddress.ephemeralPublicKey

  // Quick check: compute shared secret and verify view tag
  S_point ← computeSharedSecret(spendingPrivKey, R)
  S_hash ← SHA256(S_point)

  // View tag check (97% rejection rate for non-matching)
  IF S_hash[0] != stealthAddress.viewTag:
    RETURN false

  // Full derivation check
  expected_address ← deriveStealthAddress(viewingPrivKey, S_hash)

  RETURN expected_address == stealthAddress.address
```

**Scanning Complexity:**
- Without view tag: O(n) full derivations
- With view tag: O(n/256) full derivations + O(n) hash + compare

### 6. Encoding Format

#### 6.1 Stealth Meta-Address String

```
Format: sip:<chain>:<spendingKey>:<viewingKey>

BNF:
<meta-address> ::= "sip:" <chain> ":" <hex-key> ":" <hex-key>
<chain>        ::= "ethereum" | "solana" | "near" | "polygon" | "arbitrum" | "optimism" | "base" | "zcash"
<hex-key>      ::= "0x" <hex-chars>
<hex-chars>    ::= 66 hex digits (secp256k1) | 64 hex digits (ed25519)
```

**Examples:**

```
# Ethereum (secp256k1, 33-byte compressed keys)
sip:ethereum:0x02abc123...789:0x03def456...012

# Solana (ed25519, 32-byte keys)
sip:solana:0xabc123...789:0xdef456...012

# NEAR (ed25519, 32-byte keys)
sip:near:0x123abc...def:0x456def...abc
```

#### 6.2 Chain-Native Address Derivation

**Ethereum Address:**
```
FUNCTION publicKeyToEthAddress(publicKey):
  // Decompress if needed
  IF len(publicKey) == 33:
    uncompressed ← secp256k1.decompress(publicKey)
  ELSE:
    uncompressed ← publicKey

  // Remove 0x04 prefix, keccak256 hash, take last 20 bytes
  pubKeyNoPrefix ← uncompressed[1:]
  hash ← keccak256(pubKeyNoPrefix)
  address ← hash[-20:]

  RETURN toChecksumAddress("0x" || hex(address))
```

**Solana Address:**
```
FUNCTION ed25519PublicKeyToSolanaAddress(publicKey):
  // Solana addresses are base58-encoded 32-byte public keys
  RETURN base58Encode(publicKey)
```

**NEAR Address:**
```
FUNCTION ed25519PublicKeyToNearAddress(publicKey):
  // NEAR implicit accounts are lowercase hex (no 0x prefix)
  RETURN hex(publicKey).toLowerCase()
```

### 7. Validation

#### 7.1 secp256k1 Public Key Validation

```
FUNCTION isValidCompressedPublicKey(key):
  IF NOT isValidHex(key): RETURN false
  IF len(hexToBytes(key)) != 33: RETURN false

  prefix ← key[2:4]
  IF prefix NOT IN {"02", "03"}: RETURN false

  TRY:
    secp256k1.ProjectivePoint.fromHex(key)
    RETURN true
  CATCH:
    RETURN false
```

#### 7.2 ed25519 Public Key Validation

```
FUNCTION isValidEd25519PublicKey(key):
  IF NOT isValidHex(key): RETURN false
  IF len(hexToBytes(key)) != 32: RETURN false

  TRY:
    ed25519.ExtendedPoint.fromHex(key)
    RETURN true
  CATCH:
    RETURN false
```

#### 7.3 Chain Validation

```
FUNCTION getCurveForChain(chain):
  IF chain IN {solana, near}:
    RETURN "ed25519"
  ELSE:
    RETURN "secp256k1"
```

### 8. Security Considerations

#### 8.1 Key Reuse

**Risk:** Reusing the same stealth meta-address indefinitely may leak information through statistical analysis.

**Mitigation:** Rotate stealth meta-addresses periodically. Publish multiple concurrent meta-addresses.

#### 8.2 Ephemeral Key Security

**Risk:** Reusing ephemeral keys breaks unlinkability.

**Mitigation:** Generate fresh ephemeral keys for every transaction. Use CSPRNG.

#### 8.3 View Tag Leakage

**Risk:** View tag reveals 8 bits of the shared secret.

**Mitigation:** View tag is hash output, not raw secret. Provides efficiency without meaningful security degradation.

#### 8.4 Timing Attacks

**Risk:** Scanning time may reveal which addresses belong to recipient.

**Mitigation:** Implement constant-time comparison. Scan all addresses uniformly.

### 9. Test Vectors

#### 9.1 secp256k1 Test Vector

```
Spending Private Key:
0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

Viewing Private Key:
0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210

Expected Spending Public Key:
0x034646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff

Expected Viewing Public Key:
0x031b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f

Encoded Meta-Address:
sip:ethereum:0x034646ae5047316b4230d0086c8acec687f00b1cd9d1dc634f6cb358ac0a9a8fff:0x031b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f
```

#### 9.2 ed25519 Test Vector

```
Spending Seed:
0x9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60

Viewing Seed:
0x4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb

Expected Spending Public Key:
0xd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a

Expected Viewing Public Key:
0x3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c

Encoded Meta-Address:
sip:solana:0xd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a:0x3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c
```

## Reference Implementation

See `packages/sdk/src/stealth.ts` in the SIP Protocol repository:
- `generateStealthMetaAddress()` - secp256k1 key generation
- `generateEd25519StealthMetaAddress()` - ed25519 key generation
- `generateStealthAddress()` - secp256k1 address derivation
- `generateEd25519StealthAddress()` - ed25519 address derivation
- `deriveStealthPrivateKey()` - secp256k1 recovery
- `deriveEd25519StealthPrivateKey()` - ed25519 recovery
- `checkStealthAddress()` - secp256k1 scanning
- `checkEd25519StealthAddress()` - ed25519 scanning

## References

1. [EIP-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
2. [Vitalik Buterin: An incomplete guide to stealth addresses](https://vitalik.ca/general/2023/01/20/stealth.html)
3. [RFC 8032: Edwards-Curve Digital Signature Algorithm (EdDSA)](https://datatracker.ietf.org/doc/html/rfc8032)
4. [SEC 2: Recommended Elliptic Curve Domain Parameters](https://www.secg.org/sec2-v2.pdf)

## Copyright

This specification is released under the MIT License.
