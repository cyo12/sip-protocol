/**
 * Tests for DAO Treasury module
 *
 * @module tests/treasury
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { secp256k1 } from '@noble/curves/secp256k1'
import { bytesToHex, randomBytes } from '@noble/hashes/utils'
import {
  Treasury,
  ProposalStatus,
  PrivacyLevel,
  getStablecoin,
  generateStealthMetaAddress,
  ValidationError,
} from '../src'
import type {
  TreasuryMember,
  CreateTreasuryParams,
  TreasuryConfig,
} from '../src'

// Helper to generate a keypair
function generateKeypair(): { address: string; publicKey: string; privateKey: string } {
  const privateKeyBytes = randomBytes(32)
  const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, true)
  const address = `0x${bytesToHex(publicKeyBytes.slice(-20))}`

  return {
    address,
    publicKey: `0x${bytesToHex(publicKeyBytes)}`,
    privateKey: `0x${bytesToHex(privateKeyBytes)}`,
  }
}

describe('Treasury', () => {
  let alice: ReturnType<typeof generateKeypair>
  let bob: ReturnType<typeof generateKeypair>
  let carol: ReturnType<typeof generateKeypair>
  let defaultParams: CreateTreasuryParams

  beforeEach(() => {
    alice = generateKeypair()
    bob = generateKeypair()
    carol = generateKeypair()

    defaultParams = {
      name: 'Test Treasury',
      chain: 'ethereum',
      members: [
        { address: alice.address, publicKey: alice.publicKey as `0x${string}`, role: 'owner', name: 'Alice' },
        { address: bob.address, publicKey: bob.publicKey as `0x${string}`, role: 'signer', name: 'Bob' },
        { address: carol.address, publicKey: carol.publicKey as `0x${string}`, role: 'signer', name: 'Carol' },
      ],
      signingThreshold: 2,
    }
  })

  describe('create', () => {
    it('should create a treasury with valid params', async () => {
      const treasury = await Treasury.create(defaultParams)

      expect(treasury.treasuryId).toBeDefined()
      expect(treasury.treasuryId).toMatch(/^treasury_/)
      expect(treasury.name).toBe('Test Treasury')
      expect(treasury.chain).toBe('ethereum')
      expect(treasury.signingThreshold).toBe(2)
      expect(treasury.members).toHaveLength(3)
      expect(treasury.masterViewingKey).toBeDefined()
    })

    it('should throw if no owner', async () => {
      const params = {
        ...defaultParams,
        members: [
          { address: bob.address, publicKey: bob.publicKey as `0x${string}`, role: 'signer' as const, name: 'Bob' },
          { address: carol.address, publicKey: carol.publicKey as `0x${string}`, role: 'signer' as const, name: 'Carol' },
        ],
      }

      await expect(Treasury.create(params)).rejects.toThrow('at least one owner is required')
    })

    it('should throw if threshold exceeds signers', async () => {
      const params = {
        ...defaultParams,
        signingThreshold: 5,
      }

      await expect(Treasury.create(params)).rejects.toThrow('signing threshold (5) cannot exceed number of signers')
    })

    it('should throw if threshold is zero', async () => {
      const params = {
        ...defaultParams,
        signingThreshold: 0,
      }

      await expect(Treasury.create(params)).rejects.toThrow('signing threshold must be at least 1')
    })

    it('should throw if no members', async () => {
      const params = {
        ...defaultParams,
        members: [],
      }

      await expect(Treasury.create(params)).rejects.toThrow('at least one member is required')
    })

    it('should throw if name is empty', async () => {
      const params = {
        ...defaultParams,
        name: '',
      }

      await expect(Treasury.create(params)).rejects.toThrow('treasury name is required')
    })

    it('should set default privacy level', async () => {
      const treasury = await Treasury.create(defaultParams)
      const config = treasury.getConfig()
      expect(config.defaultPrivacy).toBe(PrivacyLevel.SHIELDED)
    })

    it('should accept custom privacy level', async () => {
      const params = {
        ...defaultParams,
        defaultPrivacy: PrivacyLevel.COMPLIANT,
      }

      const treasury = await Treasury.create(params)
      const config = treasury.getConfig()
      expect(config.defaultPrivacy).toBe(PrivacyLevel.COMPLIANT)
    })

    it('should set spending limits', async () => {
      const params = {
        ...defaultParams,
        dailyLimit: 100000_000000n,
        transactionLimit: 10000_000000n,
      }

      const treasury = await Treasury.create(params)
      const config = treasury.getConfig()
      expect(config.dailyLimit).toBe(100000_000000n)
      expect(config.transactionLimit).toBe(10000_000000n)
    })
  })

  describe('member management', () => {
    let treasury: Treasury

    beforeEach(async () => {
      treasury = await Treasury.create(defaultParams)
    })

    it('should get member by address', () => {
      const member = treasury.getMember(alice.address)
      expect(member).toBeDefined()
      expect(member!.name).toBe('Alice')
      expect(member!.role).toBe('owner')
    })

    it('should return undefined for non-member', () => {
      const dave = generateKeypair()
      const member = treasury.getMember(dave.address)
      expect(member).toBeUndefined()
    })

    it('should check if address is signer', () => {
      expect(treasury.isSigner(alice.address)).toBe(true) // owner is signer
      expect(treasury.isSigner(bob.address)).toBe(true)
      expect(treasury.isSigner(carol.address)).toBe(true)

      const dave = generateKeypair()
      expect(treasury.isSigner(dave.address)).toBe(false)
    })

    it('should get all signers', () => {
      const signers = treasury.getSigners()
      expect(signers).toHaveLength(3)
    })

    it('should check proposal creation permission', () => {
      expect(treasury.canCreateProposal(alice.address)).toBe(true)
      expect(treasury.canCreateProposal(bob.address)).toBe(true)

      const dave = generateKeypair()
      expect(treasury.canCreateProposal(dave.address)).toBe(false)
    })

    it('should handle viewer role', async () => {
      const viewer = generateKeypair()
      const params = {
        ...defaultParams,
        members: [
          ...defaultParams.members,
          { address: viewer.address, publicKey: viewer.publicKey as `0x${string}`, role: 'viewer' as const, name: 'Viewer' },
        ],
      }

      const treasuryWithViewer = await Treasury.create(params)
      expect(treasuryWithViewer.isSigner(viewer.address)).toBe(false)
      expect(treasuryWithViewer.canCreateProposal(viewer.address)).toBe(false)
    })
  })

  describe('payment proposals', () => {
    let treasury: Treasury
    let recipientMetaAddress: string
    const usdc = getStablecoin('USDC', 'ethereum')!

    beforeEach(async () => {
      treasury = await Treasury.create(defaultParams)
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      recipientMetaAddress = `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`
    })

    it('should create a payment proposal', async () => {
      const proposal = await treasury.createPaymentProposal({
        treasuryId: treasury.treasuryId,
        title: 'Developer Grant',
        recipient: recipientMetaAddress,
        token: usdc,
        amount: 5000_000000n,
        purpose: 'salary',
      })

      expect(proposal.proposalId).toBeDefined()
      expect(proposal.proposalId).toMatch(/^prop_/)
      expect(proposal.type).toBe('payment')
      expect(proposal.status).toBe(ProposalStatus.PENDING)
      expect(proposal.requiredSignatures).toBe(2)
      expect(proposal.signatures).toHaveLength(0)
      expect(proposal.payment).toBeDefined()
      expect(proposal.payment!.amount).toBe(5000_000000n)
    })

    it('should throw if title is empty', async () => {
      await expect(
        treasury.createPaymentProposal({
          treasuryId: treasury.treasuryId,
          title: '',
          recipient: recipientMetaAddress,
          token: usdc,
          amount: 5000_000000n,
        })
      ).rejects.toThrow('proposal title is required')
    })

    it('should throw if amount is zero', async () => {
      await expect(
        treasury.createPaymentProposal({
          treasuryId: treasury.treasuryId,
          title: 'Test',
          recipient: recipientMetaAddress,
          token: usdc,
          amount: 0n,
        })
      ).rejects.toThrow('amount must be positive')
    })

    it('should throw if amount exceeds transaction limit', async () => {
      const treasuryWithLimit = await Treasury.create({
        ...defaultParams,
        transactionLimit: 1000_000000n,
      })

      await expect(
        treasuryWithLimit.createPaymentProposal({
          treasuryId: treasuryWithLimit.treasuryId,
          title: 'Large Payment',
          recipient: recipientMetaAddress,
          token: usdc,
          amount: 5000_000000n,
        })
      ).rejects.toThrow('amount exceeds transaction limit')
    })

    it('should get pending proposals', async () => {
      await treasury.createPaymentProposal({
        treasuryId: treasury.treasuryId,
        title: 'Grant 1',
        recipient: recipientMetaAddress,
        token: usdc,
        amount: 1000_000000n,
      })

      await treasury.createPaymentProposal({
        treasuryId: treasury.treasuryId,
        title: 'Grant 2',
        recipient: recipientMetaAddress,
        token: usdc,
        amount: 2000_000000n,
      })

      const pending = treasury.getPendingProposals()
      expect(pending).toHaveLength(2)
    })
  })

  describe('batch proposals', () => {
    let treasury: Treasury
    const usdc = getStablecoin('USDC', 'ethereum')!
    let recipients: { address: string; amount: bigint; purpose?: 'salary' }[]

    beforeEach(async () => {
      treasury = await Treasury.create(defaultParams)

      recipients = []
      for (let i = 0; i < 3; i++) {
        const { metaAddress } = generateStealthMetaAddress('ethereum')
        recipients.push({
          address: `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`,
          amount: BigInt((i + 1) * 1000_000000),
          purpose: 'salary',
        })
      }
    })

    it('should create a batch payment proposal', async () => {
      const proposal = await treasury.createBatchProposal({
        treasuryId: treasury.treasuryId,
        title: 'November Payroll',
        token: usdc,
        recipients,
      })

      expect(proposal.proposalId).toBeDefined()
      expect(proposal.type).toBe('batch_payment')
      expect(proposal.status).toBe(ProposalStatus.PENDING)
      expect(proposal.batchPayment).toBeDefined()
      expect(proposal.batchPayment!.recipients).toHaveLength(3)
      expect(proposal.batchPayment!.totalAmount).toBe(6000_000000n) // 1000 + 2000 + 3000
    })

    it('should throw if no recipients', async () => {
      await expect(
        treasury.createBatchProposal({
          treasuryId: treasury.treasuryId,
          title: 'Empty Batch',
          token: usdc,
          recipients: [],
        })
      ).rejects.toThrow('at least one recipient is required')
    })

    it('should validate each recipient', async () => {
      const badRecipients = [
        { address: '', amount: 1000_000000n },
      ]

      await expect(
        treasury.createBatchProposal({
          treasuryId: treasury.treasuryId,
          title: 'Bad Batch',
          token: usdc,
          recipients: badRecipients,
        })
      ).rejects.toThrow('recipient 0 address is required')
    })
  })

  describe('signing', () => {
    let treasury: Treasury
    let proposal: Awaited<ReturnType<typeof treasury.createPaymentProposal>>
    const usdc = getStablecoin('USDC', 'ethereum')!

    beforeEach(async () => {
      treasury = await Treasury.create(defaultParams)
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const recipientMetaAddress = `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`

      proposal = await treasury.createPaymentProposal({
        treasuryId: treasury.treasuryId,
        title: 'Test Payment',
        recipient: recipientMetaAddress,
        token: usdc,
        amount: 1000_000000n,
      })
    })

    it('should sign a proposal', async () => {
      const signed = await treasury.signProposal(
        proposal.proposalId,
        alice.address,
        alice.privateKey as `0x${string}`,
        true
      )

      expect(signed.signatures).toHaveLength(1)
      expect(signed.signatures[0].signer).toBe(alice.address)
      expect(signed.signatures[0].approved).toBe(true)
      expect(signed.status).toBe(ProposalStatus.PENDING) // Still pending, need 2 sigs
    })

    it('should approve with enough signatures', async () => {
      await treasury.signProposal(
        proposal.proposalId,
        alice.address,
        alice.privateKey as `0x${string}`,
        true
      )

      const approved = await treasury.signProposal(
        proposal.proposalId,
        bob.address,
        bob.privateKey as `0x${string}`,
        true
      )

      expect(approved.signatures).toHaveLength(2)
      expect(approved.status).toBe(ProposalStatus.APPROVED)
    })

    it('should reject with enough rejections', async () => {
      await treasury.signProposal(
        proposal.proposalId,
        alice.address,
        alice.privateKey as `0x${string}`,
        false // reject
      )

      const rejected = await treasury.signProposal(
        proposal.proposalId,
        bob.address,
        bob.privateKey as `0x${string}`,
        false // reject
      )

      expect(rejected.status).toBe(ProposalStatus.REJECTED)
    })

    it('should throw if signer already signed', async () => {
      await treasury.signProposal(
        proposal.proposalId,
        alice.address,
        alice.privateKey as `0x${string}`,
        true
      )

      await expect(
        treasury.signProposal(
          proposal.proposalId,
          alice.address,
          alice.privateKey as `0x${string}`,
          true
        )
      ).rejects.toThrow('signer has already signed this proposal')
    })

    it('should throw if not a signer', async () => {
      const dave = generateKeypair()

      await expect(
        treasury.signProposal(
          proposal.proposalId,
          dave.address,
          dave.privateKey as `0x${string}`,
          true
        )
      ).rejects.toThrow('address is not a signer')
    })

    it('should throw if proposal not found', async () => {
      await expect(
        treasury.signProposal(
          'prop_invalid',
          alice.address,
          alice.privateKey as `0x${string}`,
          true
        )
      ).rejects.toThrow('proposal not found')
    })
  })

  describe('execution', () => {
    let treasury: Treasury
    const usdc = getStablecoin('USDC', 'ethereum')!
    let recipientMetaAddress: string

    beforeEach(async () => {
      treasury = await Treasury.create(defaultParams)
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      recipientMetaAddress = `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`
    })

    it('should execute approved payment proposal', async () => {
      const proposal = await treasury.createPaymentProposal({
        treasuryId: treasury.treasuryId,
        title: 'Test Payment',
        recipient: recipientMetaAddress,
        token: usdc,
        amount: 1000_000000n,
      })

      // Get approval
      await treasury.signProposal(proposal.proposalId, alice.address, alice.privateKey as `0x${string}`, true)
      await treasury.signProposal(proposal.proposalId, bob.address, bob.privateKey as `0x${string}`, true)

      // Execute
      const payments = await treasury.executeProposal(proposal.proposalId)

      expect(payments).toHaveLength(1)
      expect(payments[0].amount).toBe(1000_000000n)

      // Check status updated
      const executed = treasury.getProposal(proposal.proposalId)
      expect(executed!.status).toBe(ProposalStatus.EXECUTED)
      expect(executed!.executedAt).toBeDefined()
    })

    it('should execute batch payment proposal', async () => {
      const recipients = []
      for (let i = 0; i < 3; i++) {
        const { metaAddress } = generateStealthMetaAddress('ethereum')
        recipients.push({
          address: `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`,
          amount: BigInt((i + 1) * 1000_000000),
        })
      }

      const proposal = await treasury.createBatchProposal({
        treasuryId: treasury.treasuryId,
        title: 'Batch Payment',
        token: usdc,
        recipients,
      })

      // Get approval
      await treasury.signProposal(proposal.proposalId, alice.address, alice.privateKey as `0x${string}`, true)
      await treasury.signProposal(proposal.proposalId, bob.address, bob.privateKey as `0x${string}`, true)

      // Execute
      const payments = await treasury.executeProposal(proposal.proposalId)

      expect(payments).toHaveLength(3)
      expect(payments[0].amount).toBe(1000_000000n)
      expect(payments[1].amount).toBe(2000_000000n)
      expect(payments[2].amount).toBe(3000_000000n)
    })

    it('should throw if proposal not approved', async () => {
      const proposal = await treasury.createPaymentProposal({
        treasuryId: treasury.treasuryId,
        title: 'Test Payment',
        recipient: recipientMetaAddress,
        token: usdc,
        amount: 1000_000000n,
      })

      await expect(treasury.executeProposal(proposal.proposalId))
        .rejects.toThrow('proposal is not approved')
    })
  })

  describe('cancellation', () => {
    let treasury: Treasury
    const usdc = getStablecoin('USDC', 'ethereum')!

    beforeEach(async () => {
      treasury = await Treasury.create(defaultParams)
    })

    it('should allow owner to cancel', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const proposal = await treasury.createPaymentProposal({
        treasuryId: treasury.treasuryId,
        title: 'Test',
        recipient: `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`,
        token: usdc,
        amount: 1000_000000n,
      })

      const cancelled = treasury.cancelProposal(proposal.proposalId, alice.address)
      expect(cancelled.status).toBe(ProposalStatus.CANCELLED)
    })

    it('should throw if non-owner tries to cancel', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const proposal = await treasury.createPaymentProposal({
        treasuryId: treasury.treasuryId,
        title: 'Test',
        recipient: `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`,
        token: usdc,
        amount: 1000_000000n,
      })

      expect(() => treasury.cancelProposal(proposal.proposalId, bob.address))
        .toThrow('only proposer or owner can cancel')
    })
  })

  describe('auditor access', () => {
    let treasury: Treasury

    beforeEach(async () => {
      treasury = await Treasury.create(defaultParams)
    })

    it('should grant auditor access', () => {
      const auditorKey = treasury.grantAuditorAccess(
        'audit_2024',
        'Annual Auditor',
        alice.address,
        'all'
      )

      expect(auditorKey.auditorId).toBe('audit_2024')
      expect(auditorKey.name).toBe('Annual Auditor')
      expect(auditorKey.viewingKey).toBeDefined()
      expect(auditorKey.scope).toBe('all')
      expect(auditorKey.grantedBy).toBe(alice.address)
    })

    it('should throw if non-owner grants access', () => {
      expect(() =>
        treasury.grantAuditorAccess(
          'audit_2024',
          'Annual Auditor',
          bob.address, // Bob is signer, not owner
          'all'
        )
      ).toThrow('only owners can grant auditor access')
    })

    it('should revoke auditor access', () => {
      treasury.grantAuditorAccess('audit_2024', 'Annual Auditor', alice.address, 'all')

      const revoked = treasury.revokeAuditorAccess('audit_2024', alice.address)
      expect(revoked).toBe(true)

      const keys = treasury.getAuditorKeys()
      expect(keys).toHaveLength(0)
    })

    it('should scope auditor access', () => {
      const inboundKey = treasury.grantAuditorAccess(
        'inbound_audit',
        'Inbound Auditor',
        alice.address,
        'inbound'
      )

      expect(inboundKey.scope).toBe('inbound')
    })

    it('should set validity period', () => {
      const endDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 // 1 year

      const key = treasury.grantAuditorAccess(
        'audit_2024',
        'Annual Auditor',
        alice.address,
        'all',
        endDate
      )

      expect(key.validUntil).toBe(endDate)
    })
  })

  describe('balance management', () => {
    let treasury: Treasury
    const usdc = getStablecoin('USDC', 'ethereum')!

    beforeEach(async () => {
      treasury = await Treasury.create(defaultParams)
    })

    it('should update and get balance', () => {
      treasury.updateBalance(usdc, 100000_000000n)

      const balance = treasury.getBalance(usdc)
      expect(balance).toBeDefined()
      expect(balance!.balance).toBe(100000_000000n)
      expect(balance!.available).toBe(100000_000000n)
      expect(balance!.committed).toBe(0n)
    })

    it('should track committed amounts', async () => {
      treasury.updateBalance(usdc, 100000_000000n)

      const { metaAddress } = generateStealthMetaAddress('ethereum')
      await treasury.createPaymentProposal({
        treasuryId: treasury.treasuryId,
        title: 'Pending Payment',
        recipient: `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`,
        token: usdc,
        amount: 5000_000000n,
      })

      // Re-update balance to recalculate committed
      treasury.updateBalance(usdc, 100000_000000n)

      const balance = treasury.getBalance(usdc)
      expect(balance!.committed).toBe(5000_000000n)
      expect(balance!.available).toBe(95000_000000n)
    })

    it('should get all balances', () => {
      const usdt = getStablecoin('USDT', 'ethereum')!

      treasury.updateBalance(usdc, 50000_000000n)
      treasury.updateBalance(usdt, 30000_000000n)

      const balances = treasury.getAllBalances()
      expect(balances).toHaveLength(2)
    })
  })

  describe('serialization', () => {
    let treasury: Treasury

    beforeEach(async () => {
      treasury = await Treasury.create(defaultParams)
    })

    it('should serialize and deserialize', async () => {
      const { metaAddress } = generateStealthMetaAddress('ethereum')
      const usdc = getStablecoin('USDC', 'ethereum')!

      // Create some state
      await treasury.createPaymentProposal({
        treasuryId: treasury.treasuryId,
        title: 'Test',
        recipient: `sip:ethereum:${metaAddress.spendingKey}:${metaAddress.viewingKey}`,
        token: usdc,
        amount: 1000_000000n,
      })

      treasury.updateBalance(usdc, 50000_000000n)

      // Serialize
      const json = treasury.toJSON()
      expect(typeof json).toBe('string')

      // Deserialize
      const restored = Treasury.fromJSON(json)

      expect(restored.treasuryId).toBe(treasury.treasuryId)
      expect(restored.name).toBe(treasury.name)
      expect(restored.getPendingProposals()).toHaveLength(1)
      expect(restored.getBalance(usdc)!.balance).toBe(50000_000000n)
    })

    it('should handle bigint in serialization', async () => {
      const usdc = getStablecoin('USDC', 'ethereum')!
      treasury.updateBalance(usdc, 999999999999_000000n)

      const json = treasury.toJSON()
      const restored = Treasury.fromJSON(json)

      expect(restored.getBalance(usdc)!.balance).toBe(999999999999_000000n)
    })
  })

  describe('fromConfig', () => {
    it('should load treasury from config', async () => {
      const original = await Treasury.create(defaultParams)
      const config = original.getConfig()

      const loaded = Treasury.fromConfig(config)

      expect(loaded.treasuryId).toBe(original.treasuryId)
      expect(loaded.name).toBe(original.name)
      expect(loaded.signingThreshold).toBe(original.signingThreshold)
    })
  })
})
