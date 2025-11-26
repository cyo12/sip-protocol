# SIP Protocol Roadmap

> Shielded Intents Protocol — A standard for privacy in intent-based cross-chain systems

---

## Vision

SIP aims to become the universal privacy standard for intent-based cross-chain transactions, providing:

- **Stealth Addresses**: One-time recipient addresses preventing linkability
- **Shielded Intents**: Hidden sender/amount with verifiable output requirements
- **Viewing Keys**: Selective disclosure for compliance and auditing
- **Production-Grade Cryptography**: Real ZK proofs, not simulations

---

## Milestones

### M1: Architecture & Specification 🔄 In Progress

Foundational decisions and formal protocol specifications.

| Issue | Description | Status |
|-------|-------------|--------|
| [#2](../../issues/2) | ZK proof architecture selection | 🔲 Open |
| [#3](../../issues/3) | Funding Proof specification | 🔲 Open |
| [#4](../../issues/4) | Validity Proof specification | 🔲 Open |
| [#5](../../issues/5) | Fulfillment Proof specification | 🔲 Open |
| [#6](../../issues/6) | SIP-SPEC.md production update | 🔲 Open |
| [#7](../../issues/7) | Stealth address protocol spec | 🔲 Open |
| [#8](../../issues/8) | Viewing key specification | 🔲 Open |
| [#9](../../issues/9) | Privacy levels formal spec | 🔲 Open |

**Goal**: Mathematically rigorous specifications ready for implementation.

---

### M2: Cryptographic Core 📋 Planned

Real cryptographic implementations, no mocks.

| Issue | Description | Status |
|-------|-------------|--------|
| [#10](../../issues/10) | [EPIC] Cryptographic Core | 🔲 Open |
| [#11](../../issues/11) | Remove mocked proofs from SDK | 🔲 Open |
| [#12](../../issues/12) | Define ProofProvider interface | 🔲 Open |
| [#13](../../issues/13) | Implement real Pedersen commitments | 🔲 Open |
| [#14](../../issues/14) | Implement Funding Proof circuit | 🔲 Open |
| [#15](../../issues/15) | Implement Validity Proof circuit | 🔲 Open |
| [#16](../../issues/16) | Implement Fulfillment Proof circuit | 🔲 Open |
| [#17](../../issues/17) | Cryptographic test suite | 🔲 Open |
| [#18](../../issues/18) | Proof benchmarking | 🔲 Open |

**Goal**: Production-ready cryptographic primitives.

---

### M3: SDK Production 📋 Planned

Production-quality SDK refactoring.

| Issue | Description | Status |
|-------|-------------|--------|
| [#19](../../issues/19) | [EPIC] SDK Production Refactoring | 🔲 Open |
| [#20](../../issues/20) | Refactor crypto.ts with real primitives | 🔲 Open |
| [#21](../../issues/21) | Refactor intent.ts to use proof interface | 🔲 Open |
| [#22](../../issues/22) | Refactor privacy.ts with real encryption | 🔲 Open |
| [#23](../../issues/23) | Add comprehensive input validation | 🔲 Open |
| [#24](../../issues/24) | Implement proper error handling | 🔲 Open |
| [#25](../../issues/25) | Add SDK unit tests (90%+ coverage) | 🔲 Open |
| [#26](../../issues/26) | Add SDK integration tests | 🔲 Open |
| [#27](../../issues/27) | Performance benchmarking | 🔲 Open |

**Goal**: SDK ready for developer adoption.

---

### M4: Network Integration 📋 Planned

Connect to real blockchain networks.

| Issue | Description | Status |
|-------|-------------|--------|
| [#28](../../issues/28) | [EPIC] Network Integration | 🔲 Open |
| [#29](../../issues/29) | Research NEAR 1Click API | 🔲 Open |
| [#30](../../issues/30) | Implement NEAR Intents adapter | 🔲 Open |
| [#31](../../issues/31) | Implement solver interface | 🔲 Open |
| [#32](../../issues/32) | Zcash testnet RPC client | 🔲 Open |
| [#33](../../issues/33) | Zcash shielded transaction support | 🔲 Open |
| [#34](../../issues/34) | Evaluate Zcash proving system | 🔲 Open |
| [#35](../../issues/35) | Abstract wallet interface | 🔲 Open |
| [#36](../../issues/36) | Solana wallet adapter | 🔲 Open |
| [#37](../../issues/37) | Ethereum wallet adapter | 🔲 Open |
| [#38](../../issues/38) | End-to-end testnet integration | 🔲 Open |

**Goal**: Working cross-chain privacy transactions.

---

### M5: Documentation & Launch 📋 Planned

Polish and publish.

| Issue | Description | Status |
|-------|-------------|--------|
| [#39](../../issues/39) | [EPIC] Documentation & Launch | 🔲 Open |
| [#40](../../issues/40) | Demo application polish | 🔲 Open |
| [#41](../../issues/41) | Deploy to production | 🔲 Open |
| [#42](../../issues/42) | Internal security review | 🔲 Open |
| [#43](../../issues/43) | Security audit preparation | 🔲 Open |
| [#44](../../issues/44) | Auto-generated API documentation | 🔲 Open |
| [#45](../../issues/45) | Developer integration guide | 🔲 Open |
| [#46](../../issues/46) | Protocol whitepaper | 🔲 Open |
| [#47](../../issues/47) | Architecture diagrams | 🔲 Open |

**Goal**: Ready for public adoption.

---

## Design Principles

1. **Specification First**: Define rigorously, then implement
2. **Real Cryptography**: No mocked proofs or simulated security
3. **Standard, Not Product**: Build infrastructure others can adopt
4. **Quality Over Speed**: Long-term protocol, not short-term hack

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Cryptographic review
- Protocol specification feedback
- ZK circuit optimization
- Security analysis

---

## Status

| Component | Status |
|-----------|--------|
| TypeScript Types | ✅ Complete |
| Stealth Addresses (impl) | ✅ Complete |
| SDK Structure | ✅ Complete |
| Demo UI | ✅ Complete |
| ZK Proof Specs | 🔄 In Progress |
| Real ZK Implementation | 📋 Planned |
| Network Integration | 📋 Planned |

---

*Last updated: November 2025*
