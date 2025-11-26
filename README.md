# SIP Protocol

**Shielded Intents Protocol** — The privacy layer for cross-chain transactions.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## Overview

SIP (Shielded Intents Protocol) brings HTTPS-level privacy to cross-chain transactions. Just as HTTPS encrypted the web without changing how users browse, SIP adds privacy to blockchain intents without changing how users swap.

```
HTTP  → HTTPS  (Web privacy upgrade)
Intents → SIP   (Blockchain privacy upgrade)
```

### The Problem

Current cross-chain solutions expose everything:
- **Sender address** — Everyone knows who's swapping
- **Transaction amounts** — Everyone sees how much
- **Recipient address** — Everyone knows where funds go
- **Transaction history** — Permanent public record

This isn't just inconvenient — it's a security risk. Public transactions enable:
- Front-running and MEV extraction
- Targeted phishing attacks
- Price discrimination
- Surveillance and censorship

### The Solution

SIP wraps cross-chain intents in a privacy layer:

```typescript
// Before: Public intent (everyone sees everything)
{
  from: "0x1234...",      // Visible
  inputAmount: 10,        // Visible
  outputToken: "ETH",     // Visible
  recipient: "0x5678..."  // Visible
}

// After: Shielded intent (solvers see only what they need)
{
  intentId: "abc123",
  outputToken: "ETH",           // Solvers need this to quote
  minOutput: 0.004,             // Solvers need this to quote
  inputCommitment: "0xabc...",  // Hidden: cryptographic commitment
  recipientStealth: "0xdef...", // Hidden: one-time stealth address
  proof: "0x123..."             // ZK proof: "I have sufficient funds"
}
```

## Features

- **One-click privacy** — Toggle between public and shielded modes
- **Multi-chain support** — Works across Solana, Ethereum, NEAR, and more
- **Three privacy levels**:
  - `transparent` — Standard public transactions
  - `shielded` — Full privacy via Zcash shielded pool
  - `compliant` — Privacy with viewing key for institutional audit
- **Stealth addresses** — One-time addresses prevent linkability
- **Viewing keys** — Selective disclosure for compliance

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│                          │                                  │
│               ┌──────────▼──────────┐                       │
│               │    SIP SDK          │                       │
│               │  • Privacy toggle   │                       │
│               │  • Stealth address  │                       │
│               │  • Proof generation │                       │
│               └──────────┬──────────┘                       │
│                          │                                  │
│               ┌──────────▼──────────┐                       │
│               │  Shielded Intent    │                       │
│               │  Layer              │                       │
│               └──────────┬──────────┘                       │
│                          │                                  │
│               ┌──────────▼──────────┐                       │
│               │  Intent Router      │                       │
│               │  (NEAR Intents)     │                       │
│               └──────────┬──────────┘                       │
│                          │                                  │
│         ┌────────────────┼────────────────┐                 │
│         │                │                │                 │
│    ┌────▼────┐     ┌─────▼─────┐    ┌────▼────┐            │
│    │ Solana  │     │  Zcash    │    │Ethereum │            │
│    │         │     │ (Privacy  │    │         │            │
│    │         │     │ Backbone) │    │         │            │
│    └─────────┘     └───────────┘    └─────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Installation

```bash
npm install @sip-protocol/sdk
# or
pnpm add @sip-protocol/sdk
# or
yarn add @sip-protocol/sdk
```

### Basic Usage

```typescript
import { SIP, PrivacyLevel } from '@sip-protocol/sdk';

// Initialize
const sip = new SIP({
  network: 'mainnet', // or 'testnet'
});

// Create a shielded swap intent
const intent = await sip.createIntent({
  input: {
    chain: 'solana',
    token: 'SOL',
    amount: 10,
  },
  output: {
    chain: 'ethereum',
    token: 'ETH',
  },
  privacy: PrivacyLevel.SHIELDED,
});

// Get quotes from solvers
const quotes = await intent.getQuotes();

// Execute with best quote
const result = await intent.execute(quotes[0]);

console.log(result.status);    // 'fulfilled'
console.log(result.txHash);    // null (shielded!)
console.log(result.proof);     // ZK proof of execution
```

### Privacy Levels

```typescript
// Public mode (standard intent, no privacy)
privacy: PrivacyLevel.TRANSPARENT

// Full privacy (via Zcash shielded pool)
privacy: PrivacyLevel.SHIELDED

// Privacy + audit capability (for institutions)
privacy: PrivacyLevel.COMPLIANT
viewingKey: generateViewingKey()
```

## Documentation

- [Specification](docs/spec/SIP-SPEC.md) — Full protocol specification
- [Architecture](docs/ARCHITECTURE.md) — Technical deep-dive
- [Integration Guide](docs/guides/INTEGRATION.md) — How to integrate SIP
- [API Reference](docs/API.md) — SDK API documentation

## Packages

| Package | Description |
|---------|-------------|
| [`@sip-protocol/sdk`](packages/sdk) | Core SDK for creating shielded intents |
| [`@sip-protocol/types`](packages/types) | TypeScript type definitions |
| [`apps/demo`](apps/demo) | Reference implementation and demo app |

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Clone the repository
git clone https://github.com/RECTOR-LABS/sip-protocol.git
cd sip-protocol

# Install dependencies
pnpm install

# Start development
pnpm dev
```

### Commands

```bash
pnpm dev        # Start development server
pnpm build      # Build all packages
pnpm test       # Run tests
pnpm lint       # Lint code
pnpm typecheck  # Type check
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Areas for Contribution

- Protocol improvements
- SDK features
- Documentation
- Security audits
- Chain integrations

## Security

SIP is experimental software. Use at your own risk.

If you discover a security vulnerability, please report it responsibly:
- Email: security@sip-protocol.xyz
- Do NOT open public issues for security vulnerabilities

## License

[MIT License](LICENSE) — see LICENSE file for details.

## Acknowledgments

SIP builds on the shoulders of giants:
- [Zcash](https://z.cash) — Privacy-preserving cryptocurrency
- [NEAR Protocol](https://near.org) — Intent-centric blockchain infrastructure
- The broader privacy and cryptography research community

---

<p align="center">
  <strong>Privacy is not a feature. It's a right.</strong>
</p>
