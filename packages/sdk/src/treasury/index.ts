/**
 * DAO Treasury Module for SIP Protocol
 *
 * Provides privacy-preserving treasury management with multi-sig support
 * for DAOs and organizations.
 *
 * @example
 * ```typescript
 * import { Treasury, getStablecoin } from '@sip-protocol/sdk'
 *
 * // Create a 2-of-3 multi-sig treasury
 * const treasury = await Treasury.create({
 *   name: 'DAO Treasury',
 *   chain: 'ethereum',
 *   members: [
 *     { address: alice, publicKey: alicePub, role: 'owner', name: 'Alice' },
 *     { address: bob, publicKey: bobPub, role: 'signer', name: 'Bob' },
 *     { address: carol, publicKey: carolPub, role: 'signer', name: 'Carol' },
 *   ],
 *   signingThreshold: 2,
 * })
 *
 * // Create a batch payment proposal for payroll
 * const proposal = await treasury.createBatchProposal({
 *   title: 'November Payroll',
 *   token: getStablecoin('USDC', 'ethereum')!,
 *   recipients: [
 *     { address: emp1MetaAddr, amount: 5000_000000n, purpose: 'salary' },
 *     { address: emp2MetaAddr, amount: 4500_000000n, purpose: 'salary' },
 *     { address: emp3MetaAddr, amount: 6000_000000n, purpose: 'salary' },
 *   ],
 * })
 *
 * // Collect signatures
 * await treasury.signProposal(proposal.proposalId, alice, alicePrivKey)
 * await treasury.signProposal(proposal.proposalId, bob, bobPrivKey)
 *
 * // Execute when approved
 * const payments = await treasury.executeProposal(proposal.proposalId)
 * ```
 */

export { Treasury } from './treasury'
