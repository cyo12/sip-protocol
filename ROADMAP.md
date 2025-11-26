# SIP Protocol Roadmap

> Shielded Intents Protocol — A standard for privacy in intent-based cross-chain systems

---

## Vision

SIP aims to become the universal privacy standard for intent-based cross-chain transactions, providing:

- **Stealth Addresses**: One-time recipient addresses preventing linkability
- **Shielded Intents**: Hidden sender/amount with verifiable output requirements
- **Viewing Keys**: Selective disclosure for compliance and auditing
- **Production-Grade Cryptography**: Real ZK proofs with Noir framework

---

## Milestones

### M1: Architecture & Specification ✅ Complete

Foundational decisions and formal protocol specifications.

| Issue | Description | Status |
|-------|-------------|--------|
| [#1](../../issues/1) | [EPIC] Architecture & Specification | ✅ Done |
| [#2](../../issues/2) | ZK proof architecture selection (Noir) | ✅ Done |
| [#3](../../issues/3) | Funding Proof specification | ✅ Done |
| [#4](../../issues/4) | Validity Proof specification | ✅ Done |
| [#5](../../issues/5) | Fulfillment Proof specification | ✅ Done |
| [#6](../../issues/6) | SIP-SPEC.md production update | ✅ Done |
| [#7](../../issues/7) | Stealth address protocol spec | ✅ Done |
| [#8](../../issues/8) | Viewing key specification | ✅ Done |
| [#9](../../issues/9) | Privacy levels formal spec | ✅ Done |

**Goal**: ✅ Mathematically rigorous specifications ready for implementation.

---

### M2: Cryptographic Core ✅ Complete

Real cryptographic implementations, no mocks.

| Issue | Description | Status |
|-------|-------------|--------|
| [#10](../../issues/10) | [EPIC] Cryptographic Core | ✅ Done |
| [#11](../../issues/11) | Remove mocked proofs from SDK | ✅ Done |
| [#12](../../issues/12) | Define ProofProvider interface | ✅ Done |
| [#13](../../issues/13) | Implement real Pedersen commitments | ✅ Done |
| [#14](../../issues/14) | Implement Funding Proof circuit | ✅ Done |
| [#15](../../issues/15) | Implement Validity Proof circuit | ✅ Done |
| [#16](../../issues/16) | Implement Fulfillment Proof circuit | ✅ Done |
| [#17](../../issues/17) | Cryptographic test suite | ✅ Done |
| [#18](../../issues/18) | Security audit preparation - document assumptions | ✅ Done |

**Goal**: ✅ Production-ready cryptographic primitives.

---

### M3: SDK Production ✅ Complete

Production-quality SDK refactoring.

| Issue | Description | Status |
|-------|-------------|--------|
| [#19](../../issues/19) | [EPIC] SDK Production Refactoring | ✅ Done |
| [#20](../../issues/20) | Refactor crypto.ts with real primitives | ✅ Done |
| [#21](../../issues/21) | Refactor intent.ts to use proof interface | ✅ Done |
| [#22](../../issues/22) | Refactor privacy.ts with real encryption | ✅ Done |
| [#23](../../issues/23) | Add comprehensive input validation | ✅ Done |
| [#24](../../issues/24) | Implement proper error handling | ✅ Done |
| [#25](../../issues/25) | Add SDK unit tests (90%+ coverage) | ✅ Done |
| [#26](../../issues/26) | Add SDK integration tests | ✅ Done |
| [#27](../../issues/27) | Performance benchmarking and optimization | ✅ Done |

**Goal**: ✅ SDK ready for developer adoption.

---

### M4: Network Integration 🔄 In Progress

Connect to real blockchain networks.

| Issue | Description | Status |
|-------|-------------|--------|
| [#28](../../issues/28) | [EPIC] Network Integration | 🔄 Active |
| [#29](../../issues/29) | Research and document NEAR 1Click API | ✅ Done |
| [#30](../../issues/30) | Implement NEAR Intents adapter | ✅ Done |
| [#31](../../issues/31) | Implement solver interface | ✅ Done |
| [#32](../../issues/32) | Zcash testnet RPC client | ✅ Done |
| [#33](../../issues/33) | Zcash shielded transaction support | ✅ Done |
| [#34](../../issues/34) | Evaluate Zcash proving system | ✅ Done |
| [#35](../../issues/35) | Abstract wallet interface design | 🔲 Open |
| [#36](../../issues/36) | Solana wallet adapter | 🔲 Open |
| [#37](../../issues/37) | Ethereum wallet adapter | 🔲 Open |
| [#38](../../issues/38) | End-to-end testnet integration | 🔲 Open |

**Goal**: Working cross-chain privacy transactions.

**Progress**: 6/11 issues complete (55%)

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
| Stealth Addresses | ✅ Complete |
| Pedersen Commitments | ✅ Complete |
| ZK Proof Specs | ✅ Complete |
| ProofProvider Interface | ✅ Complete |
| Noir Circuit Stubs | ✅ Complete |
| SDK Core | ✅ Complete |
| Input Validation | ✅ Complete |
| Error Handling | ✅ Complete |
| Unit Tests (411 tests) | ✅ Complete |
| Integration Tests | ✅ Complete |
| Performance Benchmarks | ✅ Complete |
| NEAR Intents Adapter | ✅ Complete |
| Zcash RPC Client | ✅ Complete |
| Zcash Shielded Service | ✅ Complete |
| Wallet Adapters | 🔄 In Progress |
| E2E Integration | 📋 Planned |

---

*Last updated: November 27, 2025*
