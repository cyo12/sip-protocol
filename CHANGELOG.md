# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2025-12-03

### Security
- **slippageTolerance validation** - Added bounds checking (0-10000 basis points) to prevent negative minOutputAmount calculations
- 4 new test cases for slippage validation edge cases

## [0.3.1] - 2025-12-03

### Added
- **Web Worker proof generation** - Validity and fulfillment proofs via dedicated workers
- **Fail-fast bridge validation** - Early validation before API calls in NEAR Intents adapter
- **Mock prices documentation** - Comprehensive docs for testing scenarios

### Fixed
- Minor bug fixes and documentation improvements

## [0.3.0] - 2025-12-03

### Added - M11: Multi-Settlement

#### Settlement Abstraction Layer
- **SettlementBackend interface** - Pluggable backend abstraction for multi-settlement support
- **SettlementRegistry** - Backend management with route-based selection
- **SmartRouter** - Intelligent route selection with fee/speed/privacy ranking

#### Settlement Backends
- **NEARIntentsBackend** - Refactored NEAR 1Click adapter implementing SettlementBackend
- **ZcashNativeBackend** - Native ZEC→ZEC transfers with shielded address support
- **DirectChainBackend** - Same-chain private transfers (ETH→ETH, SOL→SOL, etc.)

#### Research
- THORChain integration feasibility study (`docs/specs/THORCHAIN-RESEARCH.md`)

### Changed
- Settlement module: 2,683 lines of code
- 143 new tests added (1,628 total SDK tests)

## [0.2.10] - 2025-12-03

### Added - M10: ZK Production
- **BrowserNoirProvider** - Browser-based Noir proof generation with WASM
- **Mobile WASM support** - iOS Safari, Chrome Android, Firefox Mobile detection
- Mobile compatibility utilities (`getMobileDeviceInfo`, `checkMobileWASMCompatibility`)
- SharedArrayBuffer and COOP/COEP header detection
- Noir upgrade to beta.16

### Changed
- Updated @noir-lang/noir_js to 1.0.0-beta.16
- Updated @noir-lang/types to 1.0.0-beta.16

## [0.2.0] - 2025-12-01

### Added
- Noir proof provider with mock implementation
- ProofProvider interface for ZK proof abstraction
- E2E test suite (128 tests)
- Integration tests for cross-chain swaps

### Removed
- Deprecated `createCommitment()` - Use `commit()` from `./commitment`
- Deprecated `verifyCommitment()` - Use `verifyOpening()` from `./commitment`
- Deprecated `generateShieldedAddress()` in ZcashRPCClient

## [0.1.0] - 2025-11-27

### Added
- Initial release of SIP Protocol SDK
- Stealth address generation (EIP-5564 style)
- Pedersen commitments with homomorphic properties
- Viewing keys for selective disclosure
- Privacy levels: transparent, shielded, compliant
- NEAR Intents adapter integration
- Zcash RPC client with shielded transaction support
- Wallet adapters (abstract interface + Solana/Ethereum)
- Comprehensive test suite (1,293 tests)
- ZK proof specifications and mock implementations

### Security
- Implemented cryptographic primitives using @noble/curves
- Added input validation at all system boundaries
- Secure random number generation for blinding factors

---

## Version History

| Version | Date | Milestone | Highlights |
|---------|------|-----------|------------|
| 0.3.2 | 2025-12-03 | Security | slippageTolerance validation fix |
| 0.3.1 | 2025-12-03 | Bugfix | Web Workers, fail-fast validation, docs |
| 0.3.0 | 2025-12-03 | M11 | Settlement abstraction, SmartRouter, 3 backends |
| 0.2.10 | 2025-12-03 | M10 | Noir circuits, browser WASM, mobile support |
| 0.2.0 | 2025-12-01 | M8 | Proof providers, E2E tests |
| 0.1.0 | 2025-11-27 | M1-M7 | Initial release, core cryptography |
