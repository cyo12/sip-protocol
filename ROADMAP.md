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

- Remove all mocked/simulated proofs from SDK
- Implement pluggable proof interface
- Real Pedersen commitments with proper blinding
- Implement ZK circuits for each proof type
- Comprehensive cryptographic test suite

**Goal**: Production-ready cryptographic primitives.

---

### M3: SDK Production 📋 Planned

Production-quality SDK refactoring.

- Refactor SDK with real cryptographic primitives
- Input validation and error handling
- TypeScript strict mode compliance
- 90%+ test coverage
- Performance benchmarking

**Goal**: SDK ready for developer adoption.

---

### M4: Network Integration 📋 Planned

Connect to real blockchain networks.

- NEAR Intents API integration
- Zcash shielded transaction support
- Multi-chain wallet adapters (Solana, Ethereum)
- End-to-end testnet integration

**Goal**: Working cross-chain privacy transactions.

---

### M5: Documentation & Launch 📋 Planned

Polish and publish.

- Comprehensive API documentation
- Developer integration guide
- Protocol whitepaper
- Demo application
- Security audit preparation

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
