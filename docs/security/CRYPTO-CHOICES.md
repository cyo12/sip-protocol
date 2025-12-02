# Cryptographic Primitive Justification

> **Purpose**: Document the rationale for all cryptographic choices in SIP Protocol.
> **Audience**: Security auditors, judges, contributors, and integrators.
> **Last Updated**: 2025-12-02

---

## Executive Summary

SIP Protocol's cryptographic stack is designed for **cross-chain privacy** with **regulatory compliance**. Each primitive was selected based on:

1. **Security**: Proven cryptographic hardness assumptions
2. **Interoperability**: Native support across target chains
3. **Performance**: Practical for real-world transactions
4. **Auditability**: Selective disclosure for compliance

| Component | Choice | Primary Justification |
|-----------|--------|----------------------|
| **Curves** | secp256k1 + ed25519 | Native to target chains |
| **Commitments** | Pedersen | Homomorphic, constant size |
| **Encryption** | XChaCha20-Poly1305 | Nonce-misuse resistance |
| **Proving System** | Noir/Barretenberg | Developer ergonomics + UltraHonk |

---

## 1. Curve Selection

### 1.1 Dual-Curve Strategy

SIP uses a **dual-curve architecture** rather than forcing a single curve:

| Curve | Key Size | Use Case | Native Chains |
|-------|----------|----------|---------------|
| **secp256k1** | 33 bytes (compressed) | EVM, Bitcoin, Zcash | Ethereum, Polygon, Arbitrum, Base, Zcash |
| **ed25519** | 32 bytes | Non-EVM chains | Solana, NEAR, Cosmos ecosystem |

**Why not a single curve?**

```
Single Curve Approach:
┌────────────────┐     ┌────────────────┐
│ Application    │────▶│ Convert keys   │────▶ High gas costs
│ (ed25519 chain)│     │ to secp256k1   │      Poor UX
└────────────────┘     └────────────────┘      Bridge security risk

SIP Dual-Curve Approach:
┌────────────────┐     ┌────────────────┐
│ Application    │────▶│ Use native     │────▶ Optimal gas
│ (any chain)    │     │ curve directly │      Native security
└────────────────┘     └────────────────┘
```

### 1.2 secp256k1 Justification

**Selection Rationale:**

| Factor | Details |
|--------|---------|
| **Security Level** | 128-bit (NIST-equivalent) |
| **Hardness Assumption** | ECDLP (Elliptic Curve Discrete Logarithm) |
| **Attack Resistance** | No known attacks below 2^128 operations |
| **Standards Compliance** | SEC 2, used by Bitcoin since 2009 |

**Technical Properties:**

```
Curve: y² = x³ + 7 (mod p)
p = 2²⁵⁶ - 2³² - 977 (Koblitz prime)
n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
G = (0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798,
     0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8)
```

**Why secp256k1 over P-256 (secp256r1)?**

| Criterion | secp256k1 | P-256 |
|-----------|-----------|-------|
| EVM precompile | `ecrecover` (2000 gas) | EIP-7212 (not universal) |
| Bitcoin/Zcash | Native | Not supported |
| NIST backdoor concerns | None (Koblitz) | Some (NSA involvement) |
| Crypto community trust | Very high | Moderate |

### 1.3 ed25519 Justification

**Selection Rationale:**

| Factor | Details |
|--------|---------|
| **Security Level** | 128-bit |
| **Hardness Assumption** | ECDLP on Curve25519 |
| **Design** | SafeCurves compliant, constant-time |
| **Standards** | RFC 8032, widely adopted |

**Technical Properties:**

```
Curve: -x² + y² = 1 + dx²y² (twisted Edwards)
d = -121665/121666
Base point order: 2²⁵² + 27742317777372353535851937790883648493
Key size: 32 bytes (public), 64 bytes (signature)
```

**Why ed25519 for Solana/NEAR?**

| Chain | Native Curve | SIP Benefit |
|-------|--------------|-------------|
| Solana | ed25519 | Direct address derivation, no conversion |
| NEAR | ed25519 | Implicit account compatibility |
| Cosmos | ed25519 | Tendermint native keys |

### 1.4 Implementation: @noble/curves

We use **@noble/curves** by Paul Miller:

| Criterion | Assessment |
|-----------|------------|
| **Audits** | Trail of Bits (2022), cure53 (2023) |
| **Timing Safety** | Constant-time scalar multiplication |
| **Side Channels** | No secret-dependent branches |
| **Dependencies** | Zero external dependencies |
| **TypeScript** | First-class TypeScript support |

**Code Reference:**
```typescript
// packages/sdk/src/stealth.ts:15-16
import { secp256k1 } from '@noble/curves/secp256k1'
import { ed25519 } from '@noble/curves/ed25519'
```

### 1.5 Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| **BLS12-381** | Not native to EVM/Solana, larger keys (48 bytes) |
| **secp256r1 only** | Not supported by Bitcoin/Zcash ecosystem |
| **Curve25519 only** | No EVM precompile support |
| **BN254** | Security concerns (110-bit actual security) |

---

## 2. Commitment Scheme: Pedersen Commitments

### 2.1 Why Pedersen?

Pedersen commitments provide **information-theoretic hiding** with **computational binding**:

```
C = v·G + r·H

Where:
- v = value (amount)
- r = blinding factor (random)
- G = base generator
- H = independent generator (NUMS)
```

| Property | Guarantee | Importance |
|----------|-----------|------------|
| **Hiding** | Perfect (information-theoretic) | Amount cannot be learned from commitment |
| **Binding** | Computational (ECDLP) | Cannot open to different amount |
| **Homomorphic** | Additive | Enables balance proofs |
| **Size** | Constant (33 bytes) | Chain-efficient |

### 2.2 Generator H Construction

**Nothing-Up-My-Sleeve (NUMS) Method:**

```typescript
// packages/sdk/src/commitment.ts:63-64
const H_DOMAIN = 'SIP-PEDERSEN-GENERATOR-H-v1'
const G = secp256k1.ProjectivePoint.BASE
```

**Algorithm:**
```
for counter = 0 to 255:
    candidate = SHA256("SIP-PEDERSEN-GENERATOR-H-v1:" || counter)
    if candidate is valid x-coordinate on secp256k1:
        H = lift_x(candidate)
        break
```

**Security Property**: Nobody knows `log_G(H)`. If anyone did, they could break binding.

### 2.3 Homomorphic Properties

**Additive Homomorphism:**
```
C(v1, r1) + C(v2, r2) = C(v1 + v2, r1 + r2)
```

**Use Case**: Balance proofs
```
inputs - outputs = 0  ⟹  ∑C_in - ∑C_out = C(0, r_diff)
```

This allows verifying transaction balance without revealing amounts.

### 2.4 Why Not Bulletproofs?

| Criterion | Pedersen | Bulletproofs |
|-----------|----------|--------------|
| **Commitment size** | 33 bytes | 33 bytes |
| **Range proof size** | Separate (~700 bytes) | Integrated (~700 bytes) |
| **Verification time** | O(1) | O(n log n) |
| **Aggregation** | Manual | Built-in |
| **Complexity** | Simple | Complex |
| **Use case** | Commitments only | Commitments + range proofs |

**Decision**: Pedersen for commitments, external ZK circuit for range proofs.

**Rationale**: Separation of concerns. Pedersen handles amount hiding. Noir circuits handle range proofs and complex predicates. This allows:
1. Simpler auditing (each component is smaller)
2. Flexibility in proof systems
3. Potential circuit upgrades without commitment changes

### 2.5 Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| **SHA256 commitments** | Not homomorphic, no balance proofs |
| **ElGamal** | Larger size (66 bytes), decrypt vs. verify |
| **Bulletproofs** | Overkill for commitment-only use case |
| **Kate commitments** | Requires trusted setup, pairing-based |

---

## 3. Encryption: XChaCha20-Poly1305

### 3.1 Why XChaCha20-Poly1305?

SIP encrypts transaction metadata for viewing key holders:

```typescript
// packages/sdk/src/privacy.ts:26
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
```

| Property | XChaCha20-Poly1305 | AES-256-GCM |
|----------|-------------------|-------------|
| **Nonce size** | 24 bytes | 12 bytes |
| **Nonce-misuse resistance** | High | Low |
| **Hardware acceleration** | Software | AES-NI |
| **Key schedule attacks** | Immune | Theoretical concerns |
| **Side channel risk** | Low (no tables) | Higher (S-box) |

### 3.2 Nonce Size Consideration

**The 12-byte Problem:**
```
12-byte nonce (AES-GCM):
- 2^48 messages before 50% collision probability
- ~280 trillion messages
- Sounds safe, but...
  - Multi-tenant systems
  - High-volume applications
  - Random nonce generation
  → Collision more likely than expected
```

**The 24-byte Solution:**
```
24-byte nonce (XChaCha20):
- 2^96 messages before collision concern
- Effectively unlimited for any realistic system
- Can safely use random nonces
```

### 3.3 AEAD Properties

**Authenticated Encryption with Associated Data:**

```
Encrypt: (key, nonce, plaintext, aad) → (ciphertext, tag)
Decrypt: (key, nonce, ciphertext, tag, aad) → plaintext OR error
```

| Property | Guarantee |
|----------|-----------|
| **Confidentiality** | Plaintext hidden without key |
| **Integrity** | Tampering detected |
| **Authenticity** | Message origin verified |
| **Associated Data** | Metadata authenticated but not encrypted |

### 3.4 Key Derivation

**HKDF with domain separation:**

```typescript
// packages/sdk/src/privacy.ts:178
const ENCRYPTION_DOMAIN = 'SIP-VIEWING-KEY-ENCRYPTION-V1'

// packages/sdk/src/privacy.ts:204-208
const salt = utf8ToBytes(ENCRYPTION_DOMAIN)
const info = utf8ToBytes(viewingKey.path)
return hkdf(sha256, keyBytes, salt, info, 32)
```

**Why HKDF?**
- RFC 5869 standard
- Extract-then-expand paradigm
- Domain separation prevents key reuse attacks

### 3.5 Viewing Key Architecture

```
Master Viewing Key
       │
       ├── derive("intent/1") ──► Transaction 1 key
       ├── derive("intent/2") ──► Transaction 2 key
       └── derive("auditor")  ──► Auditor disclosure key
```

**Hierarchical derivation** (BIP32-style):
```typescript
// packages/sdk/src/privacy.ts:146
const derivedFull = hmac(sha512, masterKeyBytes, childPathBytes)
```

### 3.6 Alternatives Considered

| Alternative | Reason Rejected |
|-------------|-----------------|
| **AES-256-GCM** | Nonce size, side channels in software |
| **AES-256-SIV** | Slower, less common |
| **ChaCha20-Poly1305** | 12-byte nonce (use extended version) |
| **Salsa20** | Older, XChaCha20 is strictly better |
| **AES-256-CTR + HMAC** | Composition risks, not AEAD |

---

## 4. Proving System: Noir + Barretenberg

### 4.1 Why Noir?

| Criterion | Noir | Circom | Halo2 | Leo (Aleo) |
|-----------|------|--------|-------|------------|
| **Language** | Rust-like | JS-like DSL | Rust | Rust-like |
| **Learning curve** | Medium | Medium | Steep | Medium |
| **Debugging** | Good (Rust tooling) | Limited | Limited | Good |
| **Trusted setup** | None (UltraHonk) | Per-circuit | None | Universal |
| **Ecosystem** | Growing (Aztec) | Mature | Mature | Growing |
| **TypeScript SDK** | First-class | Third-party | Third-party | Limited |

### 4.2 Backend: Barretenberg (UltraHonk)

**Why UltraHonk over Groth16?**

| Property | UltraHonk | Groth16 |
|----------|-----------|---------|
| **Trusted setup** | None | Required (toxic waste) |
| **Proof size** | ~2 KB | ~200 bytes |
| **Verification gas** | ~500K | ~200K |
| **Prover time** | Fast | Very fast |
| **Upgrade path** | Easy | New ceremony per circuit |

**Trade-off accepted**: Larger proofs for no trusted setup.

**Rationale**: Trusted setup ceremonies are operational complexity. For a cross-chain privacy protocol:
- New circuits = new ceremony (unacceptable)
- Universal setup = single point of failure
- No setup = maximum trust minimization

### 4.3 Circuit Complexity

From `docs/circuits/CONSTRAINT-ANALYSIS.md`:

| Circuit | ACIR Opcodes | Primary Operations |
|---------|--------------|-------------------|
| **Funding Proof** | 972 | Pedersen, range check, ECDSA |
| **Validity Proof** | 1,113 | Stealth derivation, signature |
| **Fulfillment Proof** | 1,691 | Hash chain, oracle signature |
| **Total** | 3,776 | - |

### 4.4 Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  SDK (TypeScript)                                            │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │ ProofProvider   │  │ @noir-lang/noir_js               │  │
│  │ interface.ts    │─▶│ @aztec/bb.js (Barretenberg WASM) │  │
│  └─────────────────┘  └──────────────────────────────────┘  │
│           │                        │                         │
│           ▼                        ▼                         │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │ NoirProvider    │  │ Compiled Circuits (JSON)          │  │
│  │ noir.ts         │  │ - funding_proof.json              │  │
│  │                 │  │ - validity_proof.json             │  │
│  │                 │  │ - fulfillment_proof.json          │  │
│  └─────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 Alternatives Considered

| System | Reason Rejected |
|--------|-----------------|
| **Circom + snarkjs** | Trusted setup required, JS ecosystem concerns |
| **Halo2** | Steep learning curve, limited tooling |
| **Mina (Kimchi)** | Different chain integration model |
| **SP1 (zkVM)** | Overkill for fixed circuits, higher proving cost |
| **RISC Zero** | Same as SP1 |
| **Gnark** | Go-only, no TypeScript integration |

### 4.6 Future Considerations

**Proof Composition (M13-M14):**
```
Future architecture:
┌──────────┐   ┌──────────┐   ┌──────────┐
│ Zcash    │   │ Mina     │   │ Noir     │
│ (Halo2)  │   │ (Kimchi) │   │ (UltraH) │
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     └──────────────┼──────────────┘
                    │
              ┌─────▼─────┐
              │ Composed  │
              │ Proof     │
              └───────────┘
```

Noir/UltraHonk enables this future by using similar algebraic structures to other modern proving systems.

---

## 5. Hash Functions

### 5.1 SHA-256

**Usage:**
- Commitment blinding derivation
- Viewing key hashing
- Stealth address derivation

**Justification:**
- Universal support (all chains)
- Hardware acceleration available
- Conservative security margin (128-bit collision resistance)
- No length extension attacks (unlike SHA-1)

### 5.2 SHA-512

**Usage:**
- HMAC for key derivation
- ed25519 key expansion

**Justification:**
- Required by ed25519 spec (RFC 8032)
- 256-bit security level
- Efficient on 64-bit platforms

### 5.3 Keccak-256

**Usage:**
- Ethereum address derivation from public keys
- EIP-55 checksum

**Justification:**
- Required for EVM compatibility
- `publicKeyToEthAddress()` function

**Code Reference:**
```typescript
// packages/sdk/src/stealth.ts:19
import { keccak_256 } from '@noble/hashes/sha3'
```

### 5.4 Why Not BLAKE3?

| Criterion | SHA-256 | BLAKE3 |
|-----------|---------|--------|
| **Speed** | ~500 MB/s | ~7 GB/s |
| **Universal support** | Yes | Limited |
| **Hardware acceleration** | SHA-NI | None |
| **Chain compatibility** | All | None |

**Decision**: Interoperability > raw speed for our use case.

---

## 6. Random Number Generation

### 6.1 Source: @noble/hashes/utils

```typescript
// packages/sdk/src/privacy.ts:25
import { randomBytes } from '@noble/hashes/utils'
```

**Backend Resolution:**
- Node.js: `crypto.randomBytes()` (OpenSSL CSPRNG)
- Browser: `crypto.getRandomValues()` (Web Crypto API)
- React Native: Polyfilled via `react-native-get-random-values`

### 6.2 Entropy Requirements

| Use Case | Bytes | Purpose |
|----------|-------|---------|
| Private keys | 32 | Key generation |
| Blinding factors | 32 | Pedersen commitments |
| Encryption nonces | 24 | XChaCha20 |
| Intent IDs | 16 | Unique identifiers |

### 6.3 Security Properties

| Property | Guarantee |
|----------|-----------|
| **Unpredictability** | Output indistinguishable from random |
| **Backtrack resistance** | Past outputs cannot be computed |
| **Forward secrecy** | Future outputs cannot be predicted |

---

## 7. Memory Security

### 7.1 Secure Wiping

```typescript
// packages/sdk/src/secure-memory.ts
export function secureWipe(buffer: Uint8Array): void
export function secureWipeAll(...buffers: Uint8Array[]): void
```

**Usage Pattern:**
```typescript
// packages/sdk/src/stealth.ts:84-88
} finally {
  // Securely wipe private key buffers
  secureWipeAll(spendingPrivateKey, viewingPrivateKey)
}
```

### 7.2 Limitations

| Threat | Mitigation | Limitation |
|--------|------------|------------|
| **Memory reads** | Immediate wiping | GC may create copies |
| **Cold boot** | N/A | Hardware-level attack |
| **Core dumps** | Wiping | Process may be killed |
| **Swap files** | N/A | OS-level concern |

**Recommendation**: For high-security deployments, use hardware security modules (HSMs) for key storage.

---

## 8. Security Assumptions Summary

| Assumption | Primitive | Breaking Consequence |
|------------|-----------|---------------------|
| **ECDLP hardness** | secp256k1, ed25519 | Key recovery |
| **CDH hardness** | Stealth addresses | Link transactions |
| **Pedersen binding** | Commitments | Forge balances |
| **XChaCha security** | Encryption | Reveal metadata |
| **SHA-256 collision** | Hashing | Multiple attacks |
| **RNG quality** | All | Total compromise |

---

## 9. Compliance Considerations

### 9.1 Export Restrictions

All cryptographic primitives used are:
- Publicly available
- Not classified
- No export license required (EAR 740.17(b)(1) - publicly available)

### 9.2 Patent Status

| Primitive | Patent Status |
|-----------|---------------|
| secp256k1 | No known patents |
| ed25519 | Public domain |
| Pedersen commitments | No known patents |
| ChaCha20-Poly1305 | Public domain |
| SHA-256 | Public domain |
| Noir/UltraHonk | Open source (MIT/Apache) |

### 9.3 Regulatory Notes

- **Viewing keys** enable selective disclosure for AML/KYC compliance
- **Transaction metadata** can be revealed to authorized parties
- **No absolute privacy** - compliance pathway always exists

---

## 10. Implementation Checklist

For security auditors:

- [ ] Verify @noble/curves audit reports
- [ ] Verify @noble/ciphers audit reports
- [ ] Check Barretenberg audit status
- [ ] Confirm NUMS generator derivation
- [ ] Test randomness quality on target platforms
- [ ] Verify constant-time operations
- [ ] Check secure memory wiping effectiveness
- [ ] Validate domain separation strings

---

## References

1. **SEC 2**: [Recommended Elliptic Curve Domain Parameters](https://www.secg.org/sec2-v2.pdf)
2. **RFC 8032**: [Edwards-Curve Digital Signature Algorithm (EdDSA)](https://tools.ietf.org/html/rfc8032)
3. **RFC 8439**: [ChaCha20 and Poly1305 for IETF Protocols](https://tools.ietf.org/html/rfc8439)
4. **RFC 5869**: [HMAC-based Extract-and-Expand Key Derivation Function (HKDF)](https://tools.ietf.org/html/rfc5869)
5. **EIP-5564**: [Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
6. **@noble/curves audit**: [Trail of Bits Report](https://github.com/paulmillr/noble-curves/blob/main/audit/2022-12-trailofbits.pdf)
7. **Noir documentation**: [noir-lang.org](https://noir-lang.org/)
8. **Barretenberg**: [github.com/AztecProtocol/aztec-packages](https://github.com/AztecProtocol/aztec-packages)

---

**Document Status**: Complete
**Next Review**: After M8 completion or external audit
