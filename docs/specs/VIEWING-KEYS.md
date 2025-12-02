# VIEWING-KEYS: SIP Viewing Key Specification

| Field | Value |
|-------|-------|
| **SIP** | 4 |
| **Title** | Viewing Key Hierarchy and Disclosure Protocol |
| **Authors** | SIP Protocol Team |
| **Status** | Draft |
| **Created** | 2024-11-01 |
| **Updated** | 2025-12-02 |
| **Requires** | SIP-1 (SIP-PROTOCOL) |

## Abstract

This specification defines the viewing key system used in SIP for selective disclosure of transaction details. Viewing keys enable "compliant privacy" where transactions are hidden by default but can be revealed to authorized parties (auditors, regulators, tax authorities) when required.

## Motivation

Full privacy creates compliance challenges:
- Regulators require audit trails for financial transactions
- Institutions need internal controls and reporting
- Tax authorities require transaction visibility
- AML/KYC regulations mandate certain disclosures

SIP's viewing key system solves this by enabling:
1. **Default privacy**: Transactions hidden without viewing key
2. **Selective disclosure**: Authorized parties can decrypt
3. **Hierarchical keys**: Master keys derive child keys for different scopes
4. **Cryptographic proof**: Key holders can prove they have access rights

## Specification

### 1. Key Structure

A viewing key consists of:

```typescript
interface ViewingKey {
  /** The key material (32 bytes) */
  key: HexString

  /** Hierarchical derivation path (e.g., "m/0/auditor") */
  path: string

  /** SHA256 hash of key for identification */
  hash: Hash
}
```

### 2. Key Generation

#### 2.1 Master Key Generation

```
FUNCTION generateViewingKey(path = "m/0"):
  // Generate random 32-byte key
  keyBytes = random(32)

  // Compute identification hash
  hashBytes = SHA256(keyBytes)

  RETURN {
    key: "0x" || hex(keyBytes),
    path: path,
    hash: "0x" || hex(hashBytes)
  }

  // Securely wipe keyBytes after conversion
```

#### 2.2 Child Key Derivation

SIP uses HMAC-SHA512 for BIP32-style hierarchical derivation:

```
FUNCTION deriveViewingKey(masterKey, childPath):
  // Extract master key bytes
  masterKeyBytes = hexToBytes(masterKey.key)

  // Encode child path
  childPathBytes = utf8ToBytes(childPath)

  // HMAC-SHA512 derivation
  derived = HMAC-SHA512(key=masterKeyBytes, data=childPathBytes)

  // Take first 32 bytes as child key
  childKeyBytes = derived[0:32]

  // Compute child hash
  childHash = SHA256(childKeyBytes)

  RETURN {
    key: "0x" || hex(childKeyBytes),
    path: masterKey.path + "/" + childPath,
    hash: "0x" || hex(childHash)
  }

  // Securely wipe intermediate values
```

### 3. Key Hierarchy

SIP recommends the following hierarchical structure:

```
Master Key (m/0)
├── Auditor Keys
│   ├── m/0/auditor/external     (External auditors)
│   ├── m/0/auditor/internal     (Internal audit team)
│   └── m/0/auditor/compliance   (Compliance officers)
├── Regulatory Keys
│   ├── m/0/regulatory/tax       (Tax authorities)
│   ├── m/0/regulatory/aml       (AML investigators)
│   └── m/0/regulatory/sec       (Securities regulators)
├── Temporal Keys
│   ├── m/0/year/2024            (2024 transactions)
│   ├── m/0/year/2025            (2025 transactions)
│   └── m/0/quarter/2024-Q1      (Quarterly scopes)
└── Purpose Keys
    ├── m/0/purpose/treasury     (Treasury operations)
    ├── m/0/purpose/payroll      (Payroll transactions)
    └── m/0/purpose/vendor       (Vendor payments)
```

### 4. Encryption

SIP uses XChaCha20-Poly1305 for authenticated encryption:

#### 4.1 Key Derivation for Encryption

```
CONSTANT ENCRYPTION_DOMAIN = "SIP-VIEWING-KEY-ENCRYPTION-V1"
CONSTANT NONCE_SIZE = 24  // XChaCha20 uses 24-byte nonce

FUNCTION deriveEncryptionKey(viewingKey):
  keyBytes = hexToBytes(viewingKey.key)
  salt = utf8ToBytes(ENCRYPTION_DOMAIN)
  info = utf8ToBytes(viewingKey.path)

  // HKDF-SHA256 key derivation
  encryptionKey = HKDF(SHA256, ikm=keyBytes, salt=salt, info=info, length=32)

  RETURN encryptionKey

  // Caller must wipe after use
```

#### 4.2 Encryption

```
FUNCTION encryptForViewing(data, viewingKey):
  // Derive encryption key
  key = deriveEncryptionKey(viewingKey)

  // Generate random nonce
  nonce = random(NONCE_SIZE)

  // Serialize data
  plaintext = utf8ToBytes(JSON.stringify(data))

  // Encrypt with XChaCha20-Poly1305
  cipher = XChaCha20Poly1305(key, nonce)
  ciphertext = cipher.encrypt(plaintext)

  // Wipe key after use
  secureWipe(key)

  RETURN {
    ciphertext: "0x" || hex(ciphertext),
    nonce: "0x" || hex(nonce),
    viewingKeyHash: viewingKey.hash
  }
```

#### 4.3 Decryption

```
FUNCTION decryptWithViewing(encrypted, viewingKey):
  // Verify key hash matches
  IF encrypted.viewingKeyHash != viewingKey.hash:
    THROW "Viewing key hash mismatch"

  // Derive encryption key
  key = deriveEncryptionKey(viewingKey)

  // Parse inputs
  nonce = hexToBytes(encrypted.nonce)
  ciphertext = hexToBytes(encrypted.ciphertext)

  // Decrypt with XChaCha20-Poly1305
  cipher = XChaCha20Poly1305(key, nonce)
  TRY:
    plaintext = cipher.decrypt(ciphertext)
  CATCH:
    THROW "Decryption failed - wrong key or tampered data"
  FINALLY:
    secureWipe(key)

  // Validate size (prevent DoS)
  CONST MAX_SIZE = 1024 * 1024  // 1MB
  IF len(plaintext) > MAX_SIZE:
    THROW "Decrypted data exceeds maximum size"

  // Parse JSON
  data = JSON.parse(utf8Decode(plaintext))

  // Validate structure
  REQUIRE typeof data.sender == "string"
  REQUIRE typeof data.recipient == "string"
  REQUIRE typeof data.amount == "string"
  REQUIRE typeof data.timestamp == "number"

  RETURN data
```

### 5. Transaction Data Structure

```typescript
interface TransactionData {
  /** Sender address */
  sender: string

  /** Recipient address */
  recipient: string

  /** Amount (as decimal string for precision) */
  amount: string

  /** Unix timestamp */
  timestamp: number
}

interface EncryptedTransaction {
  /** Encrypted data (includes auth tag) */
  ciphertext: HexString

  /** 24-byte nonce */
  nonce: HexString

  /** Hash identifying which key can decrypt */
  viewingKeyHash: Hash
}
```

### 6. Hash Computation

The viewing key hash is computed from the raw key bytes:

```
FUNCTION computeViewingKeyHash(viewingKey):
  // Remove 0x prefix and convert to bytes
  keyHex = viewingKey.key.startsWith("0x")
    ? viewingKey.key.slice(2)
    : viewingKey.key
  keyBytes = hexToBytes(keyHex)

  // Hash the raw bytes (NOT the hex string)
  hashBytes = SHA256(keyBytes)

  RETURN "0x" || hex(hashBytes)
```

**Important**: Always hash the raw key bytes, not the hex string representation.

### 7. Validation

```
FUNCTION validateViewingKey(viewingKey):
  // Check key format
  IF NOT isValidHex(viewingKey.key):
    RETURN false
  IF len(hexToBytes(viewingKey.key)) != 32:
    RETURN false

  // Check path format
  IF NOT viewingKey.path.startsWith("m/"):
    RETURN false

  // Verify hash matches key
  expectedHash = computeViewingKeyHash(viewingKey)
  IF viewingKey.hash != expectedHash:
    RETURN false

  RETURN true
```

### 8. Integration with Shielded Intents

#### 8.1 Creating Compliant Intent

```
FUNCTION createCompliantIntent(params, viewingKey):
  // Validate viewing key is provided
  REQUIRE viewingKey != null

  // Create shielded intent
  intent = createShieldedIntent(params)

  // Attach viewing key hash for identification
  intent.viewingKeyHash = viewingKey.hash

  // Encrypt transaction data
  transactionData = {
    sender: params.input.sourceAddress,
    recipient: params.recipientMetaAddress,
    amount: params.input.amount.toString(),
    timestamp: Date.now() / 1000
  }
  intent.encryptedData = encryptForViewing(transactionData, viewingKey)

  RETURN intent
```

#### 8.2 Disclosing Transaction

```
FUNCTION discloseTransaction(encryptedData, viewingKey):
  // Verify authorization
  IF encryptedData.viewingKeyHash != viewingKey.hash:
    THROW "Unauthorized - viewing key does not match"

  // Decrypt and return
  RETURN decryptWithViewing(encryptedData, viewingKey)
```

### 9. Security Considerations

#### 9.1 Key Storage

**Risk**: Compromised viewing keys expose all associated transactions.

**Mitigation**:
- Store master keys in HSM or secure enclave
- Use derived keys with limited scope for daily operations
- Implement key rotation policies

#### 9.2 Key Distribution

**Risk**: Viewing keys transmitted insecurely may be intercepted.

**Mitigation**:
- Exchange keys out-of-band or via secure channels
- Use key escrow for regulatory keys
- Implement access logging

#### 9.3 Scope Limitation

**Risk**: Overly broad viewing keys expose too much information.

**Mitigation**:
- Derive purpose-specific keys (temporal, categorical)
- Apply principle of least privilege
- Audit key usage

#### 9.4 Forward Secrecy

**Risk**: Future key compromise exposes past transactions.

**Mitigation**:
- Rotate keys periodically
- Use temporal key hierarchy (per-year, per-quarter)
- Consider key ratcheting for high-security applications

### 10. Compliance Use Cases

#### 10.1 Tax Reporting

```
// Create year-specific viewing key
taxKey2024 = deriveViewingKey(masterKey, "year/2024")

// Disclose to tax authority
disclose all transactions where:
  - viewingKeyHash == taxKey2024.hash
  - timestamp within 2024
```

#### 10.2 External Audit

```
// Create audit-scope key
auditKey = deriveViewingKey(masterKey, "auditor/external/2024-annual")

// Provide to auditor with limited scope
// Auditor can decrypt only matching transactions
```

#### 10.3 Regulatory Investigation

```
// Create regulator-specific key
amlKey = deriveViewingKey(masterKey, "regulatory/aml")

// Provide under legal process
// All AML-scope transactions become visible
```

### 11. Test Vectors

#### 11.1 Key Generation

```
Random bytes: 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

Expected hash: SHA256(bytes) = 0x... (verify with implementation)
```

#### 11.2 Key Derivation

```
Master key: 0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
Master path: "m/0"
Child path: "auditor"

Derivation: HMAC-SHA512(masterKey, "auditor")[0:32]
Expected child key: 0x... (verify with implementation)
Expected child path: "m/0/auditor"
```

#### 11.3 Encryption/Decryption

```
Transaction data:
{
  sender: "0x1234...5678",
  recipient: "sip:ethereum:0x02...:0x03...",
  amount: "1000000000000000000",
  timestamp: 1701475200
}

Viewing key: (from 11.1)
Nonce: random(24)

// Encrypt and verify decryption returns original data
encrypted = encryptForViewing(data, viewingKey)
decrypted = decryptWithViewing(encrypted, viewingKey)
assert(decrypted == data)
```

## Reference Implementation

See `packages/sdk/src/privacy.ts` in the SIP Protocol repository:
- `generateViewingKey()` - Create new viewing key
- `deriveViewingKey()` - Hierarchical key derivation
- `encryptForViewing()` - Encrypt transaction data
- `decryptWithViewing()` - Decrypt with viewing key

## References

1. [BIP-32: Hierarchical Deterministic Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
2. [RFC 5869: HKDF](https://datatracker.ietf.org/doc/html/rfc5869)
3. [RFC 8439: ChaCha20 and Poly1305](https://datatracker.ietf.org/doc/html/rfc8439)
4. [XChaCha20-Poly1305](https://datatracker.ietf.org/doc/draft-irtf-cfrg-xchacha/)

## Copyright

This specification is released under the MIT License.
