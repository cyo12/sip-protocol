# Noir Proof Generation Benchmarks

Performance benchmarks for SIP's Noir/Barretenberg ZK proof system.

## Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Funding proof generation | <5s | Most common operation, must feel responsive |
| Validity proof generation | <10s | Larger circuit, acceptable for authorization |
| Fulfillment proof generation | <15s | Largest circuit, solver-side operation |
| Any proof verification | <100ms | Critical for solver UX and throughput |
| Memory usage | <1GB | Consumer hardware compatibility |

## Circuit Constraint Counts

| Circuit | Constraints | Breakdown |
|---------|-------------|-----------|
| **Funding** | ~2,000 | Pedersen commitment (500), Range check (500), Hash verification (1,000) |
| **Validity** | ~72,000 | ECDSA signature (50,000), Pedersen commitment (2,000), Nullifier computation (10,000), Timestamp checks (10,000) |
| **Fulfillment** | ~22,000 | Oracle signature (15,000), Output commitment (2,000), Amount verification (5,000) |

## Expected Performance

Based on Noir/UltraHonk benchmarks (~1ms per 1,000 constraints):

| Circuit | Expected Time | Notes |
|---------|---------------|-------|
| Funding | ~2-3s | Simple circuit, should be fast |
| Validity | ~72-80s | ECDSA dominates, may need optimization |
| Fulfillment | ~22-25s | Oracle verification is the bottleneck |

## Framework Comparison

### Noir/Barretenberg (Selected)

**Advantages:**
- WASM support enables browser-side proving
- High-level DSL reduces development time 10x
- UltraHonk backend is production-ready
- Active Aztec ecosystem and tooling

**Disadvantages:**
- Less mature than Halo2
- Smaller community

### Halo2 (Alternative)

**Advantages:**
- Battle-tested in Zcash production
- Native integration with Zcash proving
- More mature tooling and documentation

**Disadvantages:**
- No WASM support (server-side only)
- Lower-level API increases development time
- ~2x slower proving (~2ms per 1,000 constraints)
- Larger proof sizes (~10-20 KB vs 2-4 KB)

### Decision Rationale

We chose **Noir/Barretenberg** for Phase 1 (M8) because:

1. **Browser proving** - WASM support enables better UX
2. **Development speed** - High-level DSL means faster iteration
3. **Performance** - UltraHonk is competitive with Groth16
4. **Migration path** - Can port to Halo2 later if needed

See [NOIR-VS-HALO2.md](/docs/decisions/NOIR-VS-HALO2.md) for detailed comparison.

## Running Benchmarks

```bash
# Run Noir benchmark tests
cd packages/sdk
pnpm test -- tests/benchmarks/noir-benchmarks.test.ts --run

# Run with verbose output
pnpm test -- tests/benchmarks/noir-benchmarks.test.ts --run --reporter=verbose
```

## Benchmark Output

The benchmark suite produces a summary like:

```
================================================================================
NOIR BENCHMARK SUMMARY
================================================================================
WASM Available: true
Initialization Time: 3.58ms

Performance Targets:
  - Funding proof:     <5000ms (target)
  - Validity proof:    <10000ms (target)
  - Fulfillment proof: <15000ms (target)
  - Verification:      <100ms (target)
  - Memory:            <1024MB (target)

Circuit Constraints:
  - Funding:     ~2,000
  - Validity:    ~72,000
  - Fulfillment: ~22,000
================================================================================
```

## Current Status

| Component | Status |
|-----------|--------|
| Benchmark infrastructure | Ready |
| Circuit artifacts | Compiled |
| WASM backend | Working |
| Full proof generation tests | Pending (circuit field encoding) |

## Future Work

1. **Circuit optimization** - Reduce validity proof constraint count
2. **Parallel proving** - Enable multi-threaded proof generation
3. **Proof aggregation** - Batch multiple proofs together
4. **Hardware acceleration** - GPU proving for high-throughput scenarios

## References

- [ZK Architecture](/docs/specs/ZK-ARCHITECTURE.md)
- [Funding Proof Spec](/docs/specs/FUNDING-PROOF.md)
- [Validity Proof Spec](/docs/specs/VALIDITY-PROOF.md)
- [Fulfillment Proof Spec](/docs/specs/FULFILLMENT-PROOF.md)
- [Noir vs Halo2 Decision](/docs/decisions/NOIR-VS-HALO2.md)
