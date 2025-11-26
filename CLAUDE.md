# CLAUDE.md - SIP Protocol

## Project
**SIP (Shielded Intents Protocol)** - Privacy layer for cross-chain transactions via NEAR Intents + Zcash.

## Tech Stack
- **Framework**: Next.js 14 (App Router) + TypeScript (strict)
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand
- **Monorepo**: pnpm + Turborepo
- **Deploy**: Vercel

## Structure
```
apps/demo/          # Next.js demo app
packages/sdk/       # @sip-protocol/sdk
packages/types/     # @sip-protocol/types
docs/              # Public documentation
.strategy/         # PRIVATE (gitignored) - hackathon strategy
```

## Key Concepts
- **ShieldedIntent**: Intent with hidden sender/amount, visible output requirements
- **Stealth Address**: One-time recipient address (prevents linkability)
- **Privacy Levels**: `transparent` | `shielded` | `compliant`
- **Viewing Key**: Selective disclosure for audit/compliance

## Commands
```bash
pnpm install    # Install deps
pnpm dev        # Dev server
pnpm build      # Build all
pnpm lint       # Lint
pnpm typecheck  # Type check
```

## Core Files
- `packages/sdk/src/intent.ts` - ShieldedIntent class
- `packages/sdk/src/stealth.ts` - Stealth address generation
- `packages/sdk/src/privacy.ts` - Privacy level handling
- `apps/demo/app/page.tsx` - Main swap interface

## APIs
- **NEAR Intents**: 1Click API for swap execution
- **Zcash**: Testnet RPC for shielded transactions

## Code Style
- 2-space indent, no semicolons
- Explicit types for public APIs
- JSDoc for public functions

## Private Strategy
Hackathon tactics in `.strategy/` - NEVER commit. Reference: `~/.claude/sip-protocol/` for backup.
