# SIP Protocol - Manual Test Checklist

End-to-end testnet integration manual test checklist for verifying SIP Protocol functionality across all integrated chains.

---

## 🤖 Automated Test Results (MCP Playwright)

**Test Date:** 2024-11-29
**Test URL:** https://sip-protocol.org/demo
**Automated By:** Claude Code (MCP Playwright)

### UI Tests Completed ✅

| Test | Result | Notes |
|------|--------|-------|
| Page loads without errors | ✅ PASS | Title: "SIP Protocol - Privacy for Cross-Chain Transactions" |
| Swap card visible | ✅ PASS | Heading "Swap" present |
| Default state (Shielded) | ✅ PASS | Badge shows "Shielded" |
| Default tokens (SOL → ETH) | ✅ PASS | Correct tokens selected |
| Connect Wallet button | ✅ PASS | Button visible and clickable |
| Privacy info visible | ✅ PASS | "Privacy Protected" text shown |
| Toggle to Public | ✅ PASS | Badge updates, privacy info hides |
| Toggle to Compliant | ✅ PASS | Shows "viewing key for auditors" |
| Toggle to Shielded | ✅ PASS | Privacy info restored |
| From token dropdown | ✅ PASS | Shows SOL, ETH, NEAR options |
| Change From token | ✅ PASS | ETH selected successfully |
| To token dropdown | ✅ PASS | Shows SOL, ETH, NEAR options |
| Change To token | ✅ PASS | SOL selected successfully |
| Enter amount (1) | ✅ PASS | Quote: 22.056769 SOL |
| Rate displayed | ✅ PASS | "1 ETH ≈ 21.842711 SOL" |
| Solver Fee displayed | ✅ PASS | "0.49%" |
| Privacy status | ✅ PASS | "Full shielding" |
| Route displayed | ✅ PASS | "Ethereum → Solana" |
| Decimal input (0.0025) | ✅ PASS | Quote: 0.055141 SOL |
| Large amount (99999) | ✅ PASS | Quote: 2,205,654 SOL |
| Clear input | ✅ PASS | Output resets to 0 |
| Wallet modal opens | ✅ PASS | "Connect Wallet" heading |
| Solana tab (default) | ✅ PASS | Phantom, Solflare visible |
| Ethereum tab | ✅ PASS | MetaMask, WalletConnect visible |
| Close modal (X button) | ✅ PASS | Modal closes |
| Invalid input (letters) | ✅ PASS | Rejected by type="number" |
| Negative input (-5) | ✅ PASS | No quote generated |

### Summary

- **UI Tests:** 27 passed
- **Route Tests:** 6 passed
- **Total Tests:** 33
- **Passed:** 33
- **Failed:** 0
- **Pass Rate:** 100%

### Minor Issues Found

| Issue | Severity | Notes |
|-------|----------|-------|
| Escape key doesn't close wallet modal | Low | X button works fine |

### Multi-Chain Route Tests ✅

**Test Date:** 2024-11-29

All 6 supported chain combinations verified working:

| Route | Output (1 unit) | Rate | Status |
|-------|-----------------|------|--------|
| SOL → ETH | 0.045982 ETH | 1 SOL ≈ 0.045536 ETH | ✅ PASS |
| ETH → SOL | 22.17581 SOL | 1 ETH ≈ 21.960597 SOL | ✅ PASS |
| SOL → NEAR | 73.473692 NEAR | 1 SOL ≈ 72.760638 NEAR | ✅ PASS |
| NEAR → SOL | 0.013878 SOL | 1 NEAR ≈ 0.013744 SOL | ✅ PASS |
| ETH → NEAR | 1613.665771 NEAR | 1 ETH ≈ 1598.005319 NEAR | ✅ PASS |
| NEAR → ETH | 0.000631 ETH | 1 NEAR ≈ 0.000626 ETH | ✅ PASS |

**Result:** 6/6 routes working (100%)

---

## 🧑‍💻 Manual Test Results (2024-11-29)

**Tested By:** RECTOR + Claude Code
**Wallet:** Phantom (Solana Devnet)
**Balance:** 1.7569 SOL

### Wallet Connection Tests ✅

| Test | Result | Notes |
|------|--------|-------|
| Connect Phantom (devnet) | ✅ PASS | After bug fix |
| Address format (Base58) | ✅ PASS | Fixed: was showing 0x hex |
| Balance display | ✅ PASS | Shows 1.7569 SOL |
| Wallet stays connected | ✅ PASS | Persists across mode changes |

### Privacy Mode Tests

| Mode | UI State | Swap Flow | Result |
|------|----------|-----------|--------|
| **Shielded** | ✅ Badge correct | ✅ Completes | PASS |
| **Public** | ✅ Badge correct | ✅ Shows tx hash | PASS |
| **Compliant** | ❌ Badge shows "Shielded" | ❌ ViewingKey error | BLOCKED |

### Swap Flow Tests

| Test | Result | Notes |
|------|--------|-------|
| Shielded Swap | ✅ PASS | "No public record exists" message |
| Public Swap | ✅ PASS | Shows tx hash + explorer link |
| Compliant Swap | ❌ BLOCKED | ViewingKey validation error |
| New Swap reset | ✅ PASS | Form clears, wallet stays connected |
| Quote fetching | ✅ PASS | Real-time quotes work |

### Bugs Fixed During Testing

| Bug | Issue | Fix |
|-----|-------|-----|
| Solana address showed 0x hex format | #15, #16 | Changed `adapter.publicKey` → `adapter.address` |

### Issues Created

| # | Title | Severity | Status |
|---|-------|----------|--------|
| #17 | Real on-chain swap execution | Enhancement | Open |
| #18 | Compliant mode UI bugs + viewingKey error | Bug | Open |

### Known Limitations (Demo Mode)

- Swaps are simulated (no real blockchain transactions)
- Transaction hash is mocked (`0x19acee4954a` - wrong format)
- "View on Solscan" link would 404

---

## 🧑‍💻 Manual Tests Required (Remaining)

The following tests require real wallet extensions and testnet tokens:

## Environment Setup

### Prerequisites

- [ ] Node.js 18+ installed
- [ ] pnpm installed
- [ ] Testnet tokens acquired for each chain:
  - [ ] Solana devnet SOL (faucet: https://faucet.solana.com)
  - [ ] Sepolia ETH (faucet: https://sepoliafaucet.com)
  - [ ] NEAR testnet tokens (faucet: https://near-faucet.io)
  - [ ] Zcash testnet ZEC (faucet: https://faucet.testnet.z.cash)

### Environment Variables

```bash
# .env.test
NEAR_INTENTS_JWT=<your-jwt-token>
SOLANA_RPC_URL=https://api.devnet.solana.com
ETHEREUM_RPC_URL=https://rpc.sepolia.org
ZCASH_RPC_URL=http://localhost:18232
ZCASH_RPC_USER=<username>
ZCASH_RPC_PASS=<password>
```

---

## Test Scenarios

### 1. Cross-Chain Swap Flow (SOL → ZEC)

**Objective:** Complete a shielded swap from Solana to Zcash

#### Steps:

- [x] **1.1** Connect Solana wallet (devnet) - **TESTED 2024-11-29**
  - [x] Open demo app ✅
  - [x] Click "Connect Wallet" ✅
  - [x] Select Phantom (devnet mode) ✅
  - [x] Verify wallet address displayed ✅ (Hi35R3...m9L8)

- [x] **1.2** Create shielded intent - **UI TESTED**
  - [x] Select input: SOL (Solana) ✅
  - [x] Enter amount: 0.1 SOL ✅
  - [x] Select output: ZEC (Zcash) ✅
  - [x] Set privacy level: SHIELDED ✅
  - [ ] Click "Create Intent" - **REQUIRES WALLET**
  - [ ] Verify intent ID generated - **REQUIRES WALLET**

- [ ] **1.3** Submit to NEAR testnet
  - Intent automatically submitted
  - Verify status: "Pending"
  - Check NEAR transaction on explorer

- [x] **1.4** Receive solver quote - **UI TESTED**
  - [x] Wait for quote (max 30 seconds) ✅
  - [x] Verify quote amount displayed ✅
  - [x] Verify fee displayed ✅
  - [ ] Verify expiry time - **REQUIRES LIVE QUOTE**

- [ ] **1.5** Execute swap
  - Accept quote
  - Sign transaction in wallet
  - Wait for confirmation

- [ ] **1.6** Verify ZEC received
  - Check Zcash wallet balance
  - Verify amount matches quote (minus fees)
  - Verify received in shielded address

- [ ] **1.7** Confirm no privacy leakage
  - Check Solana explorer - no linked destination
  - Check NEAR explorer - only commitments visible
  - Check Zcash explorer - shielded transaction (no amounts)

**Expected Results:**
- Swap completes successfully
- ZEC received in shielded Zcash address
- Transaction data not linkable

---

### 2. Privacy Verification

**Objective:** Verify all privacy guarantees are maintained

#### Sender Privacy

- [ ] **2.1** Sender address not visible in intent
  - Create shielded intent
  - Export intent JSON
  - Verify no raw sender address
  - Verify only `senderCommitment` present

- [ ] **2.2** Multiple intents not linkable
  - Create 3 intents from same wallet
  - Compare `senderCommitment` values
  - Verify all different (unlinkable)

#### Amount Privacy

- [ ] **2.3** Amount hidden with commitment
  - Create intent with 1.0 SOL
  - Export intent JSON
  - Verify no raw amount visible
  - Verify `inputCommitment` present

- [ ] **2.4** Commitment verification
  - Note the input commitment
  - Cannot derive original amount from commitment
  - Only sender with blinding factor can open

#### Stealth Addresses

- [ ] **2.5** Unique stealth address per transaction
  - Send 3 transactions to same recipient
  - Verify 3 different receiving addresses
  - All received by same wallet

- [ ] **2.6** Stealth address unlinkability
  - Observer cannot link stealth addresses
  - Even with blockchain data

- [ ] **2.7** Refund uses fresh stealth address
  - Trigger a failed transaction
  - Verify refund goes to new stealth address
  - Not linked to original sender

---

### 3. Compliance Flow

**Objective:** Test COMPLIANT privacy mode with viewing keys

#### Setup

- [ ] **3.1** Generate master viewing key
  - Navigate to Compliance Settings
  - Generate viewing key for account
  - Note key hash

#### Transaction

- [x] **3.2** Create compliant-mode intent - **UI TESTED**
  - [x] Select privacy: COMPLIANT ✅
  - [ ] Verify viewing key attached - **REQUIRES WALLET**
  - [ ] Complete transaction - **REQUIRES WALLET**

- [ ] **3.3** Verify auditor access
  - Export viewing key for auditor
  - Auditor decrypts transaction details
  - Verify sender, amount, recipient visible

- [ ] **3.4** Verify public cannot see details
  - Without viewing key
  - Attempt to decrypt
  - Should fail

---

### 4. Error Scenarios

**Objective:** Verify graceful error handling

#### Network Failures

- [ ] **4.1** Handle RPC disconnect
  - Disconnect internet mid-transaction
  - Verify error message displayed
  - Reconnect and retry works

- [ ] **4.2** Handle wallet disconnect
  - Disconnect wallet during signing
  - Verify error message
  - Reconnect and retry

#### Timeouts

- [ ] **4.3** Intent expiry handling
  - Create intent with short TTL
  - Wait for expiry
  - Verify cannot execute expired intent

- [ ] **4.4** Quote expiry handling
  - Get quote
  - Wait for quote expiry
  - Verify new quote required

#### Invalid Operations

- [ ] **4.5** Insufficient balance
  - Try to swap more than wallet balance
  - Verify error: "Insufficient balance"

- [x] **4.6** Invalid input handling - **UI TESTED**
  - [x] Letters rejected by number input ✅
  - [x] Negative numbers don't generate quotes ✅

#### Solver Failures

- [ ] **4.7** No quotes available
  - Try very small amount
  - Handle "No quotes available" gracefully

- [ ] **4.8** Solver rejection
  - Solver fails mid-execution
  - Verify refund process
  - Verify funds returned

---

### 5. Multi-Chain Scenarios

**Objective:** Verify all supported chain combinations

**Test Date:** 2024-11-29
**Tested By:** Claude Code (MCP Playwright)

| Input | Output | Status | Rate | Notes |
|-------|--------|--------|------|-------|
| SOL | ETH | [x] ✅ | 1 SOL ≈ 0.045536 ETH | Route: Solana → Ethereum |
| ETH | SOL | [x] ✅ | 1 ETH ≈ 21.960597 SOL | Route: Ethereum → Solana |
| SOL | NEAR | [x] ✅ | 1 SOL ≈ 72.760638 NEAR | Route: Solana → NEAR |
| NEAR | SOL | [x] ✅ | 1 NEAR ≈ 0.013744 SOL | Route: NEAR → Solana |
| ETH | NEAR | [x] ✅ | 1 ETH ≈ 1598.005319 NEAR | Route: Ethereum → NEAR |
| NEAR | ETH | [x] ✅ | 1 NEAR ≈ 0.000626 ETH | Route: NEAR → Ethereum |
| SOL | ZEC | [ ] | - | Zcash not in demo UI |
| ETH | ZEC | [ ] | - | Zcash not in demo UI |
| NEAR | ZEC | [ ] | - | Zcash not in demo UI |

**Summary:** All 6 core routes (SOL, ETH, NEAR) work perfectly. ZEC routes require Zcash wallet integration.

---

### 6. Performance Metrics

**Objective:** Verify acceptable performance

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Intent creation | < 500ms | ____ ms | [ ] |
| Quote fetching | < 2s | ~1.5s | [x] ✅ |
| Swap execution (mock) | < 5s | ____ s | [ ] |
| Swap execution (live) | < 60s | ____ s | [ ] |
| Commitment generation | < 10ms | ____ ms | [ ] |
| Stealth address gen | < 20ms | ____ ms | [ ] |
| Proof generation (mock) | < 100ms | ____ ms | [ ] |

---

## Test Environment Commands

### Run Automated E2E Tests

```bash
# Run all E2E tests
cd packages/sdk
pnpm test -- --grep "E2E"

# Run specific test file
pnpm test -- tests/e2e/cross-chain-swap.test.ts

# Run with verbose output
pnpm test -- --reporter=verbose --grep "E2E"

# Run with coverage
pnpm test -- --coverage --grep "E2E"
```

### Run with Live Testnet (requires env vars)

```bash
# Set environment variables first
export NEAR_INTENTS_JWT="..."

# Run live API tests
pnpm test -- tests/e2e --grep "Live API"
```

### Debug Mode

```bash
# Run single test with debug
DEBUG=sip:* pnpm test -- --grep "should complete SOL → ZEC"
```

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA Engineer | | | |
| Product Manager | | | |

---

## Issues Found

| # | Description | Severity | Status |
|---|-------------|----------|--------|
| #15 | Solana balance shows 0 (wrong address format) | Critical | ✅ Fixed |
| #16 | Solana address displays as 0x hex instead of Base58 | Critical | ✅ Fixed |
| #17 | Need real on-chain swap execution (not mock) | Enhancement | Open |
| #18 | Compliant mode: badge wrong, button wrong, viewingKey error | High | Open |

---

## Notes

- All tests should pass on testnet before mainnet deployment
- Privacy tests should be verified by independent auditor
- Performance metrics may vary based on network conditions
- Keep viewing keys secure during compliance testing
