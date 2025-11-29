/**
 * Compliance Module Tests
 *
 * Tests for Enterprise Compliance management, auditor access,
 * transaction disclosure, and reporting functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ComplianceManager,
  ReportStatus,
  PrivacyLevel,
  generateViewingKey,
  generateStealthMetaAddress,
  type ShieldedPayment,
  type AuditScope,
  type RegisterAuditorParams,
  type HexString,
} from '../src'

describe('ComplianceManager', () => {
  let compliance: ComplianceManager
  const adminAddress = '0xadmin123'

  beforeEach(async () => {
    compliance = await ComplianceManager.create({
      organizationName: 'Test Corp',
      riskThreshold: 70,
      highValueThreshold: 10000_000000n,
    })
  })

  // ─── Creation Tests ───────────────────────────────────────────────────────────

  describe('creation', () => {
    it('should create a compliance manager with defaults', async () => {
      const mgr = await ComplianceManager.create({
        organizationName: 'Acme Corp',
      })

      expect(mgr.organizationName).toBe('Acme Corp')
      expect(mgr.organizationId).toMatch(/^org_/)
      expect(mgr.masterViewingKey).toBeDefined()
      expect(mgr.masterViewingKey.key).toBeDefined()
      expect(mgr.masterViewingKey.hash).toBeDefined()
    })

    it('should create with custom risk threshold', async () => {
      const mgr = await ComplianceManager.create({
        organizationName: 'Custom Corp',
        riskThreshold: 50,
      })

      const config = mgr.getConfig()
      expect(config.riskThreshold).toBe(50)
    })

    it('should create with custom high value threshold', async () => {
      const mgr = await ComplianceManager.create({
        organizationName: 'Custom Corp',
        highValueThreshold: 50000_000000n,
      })

      const config = mgr.getConfig()
      expect(config.highValueThreshold).toBe(50000_000000n)
    })

    it('should throw on empty organization name', async () => {
      await expect(
        ComplianceManager.create({ organizationName: '' })
      ).rejects.toThrow('organization name is required')
    })

    it('should throw on whitespace-only organization name', async () => {
      await expect(
        ComplianceManager.create({ organizationName: '   ' })
      ).rejects.toThrow('organization name is required')
    })

    it('should load from config', async () => {
      const original = await ComplianceManager.create({
        organizationName: 'Config Corp',
      })
      const config = original.getConfig()

      const loaded = ComplianceManager.fromConfig(config)

      expect(loaded.organizationId).toBe(original.organizationId)
      expect(loaded.organizationName).toBe(original.organizationName)
    })
  })

  // ─── Auditor Management Tests ─────────────────────────────────────────────────

  describe('auditor management', () => {
    const baseAuditorParams: RegisterAuditorParams = {
      organization: 'Big Four Audit',
      contactName: 'John Auditor',
      contactEmail: 'john@bigfour.com',
      publicKey: '0x04abcd1234' as HexString,
      scope: {
        transactionTypes: ['all'],
        chains: ['ethereum'],
        tokens: [],
        startDate: Math.floor(Date.now() / 1000) - 86400 * 365,
      },
    }

    it('should register an auditor', async () => {
      const auditor = await compliance.registerAuditor(
        baseAuditorParams,
        adminAddress
      )

      expect(auditor.auditorId).toMatch(/^auditor_/)
      expect(auditor.organization).toBe('Big Four Audit')
      expect(auditor.contactName).toBe('John Auditor')
      expect(auditor.contactEmail).toBe('john@bigfour.com')
      expect(auditor.viewingKey).toBeDefined()
      expect(auditor.isActive).toBe(true)
      expect(auditor.role).toBe('auditor')
    })

    it('should register auditor with custom role', async () => {
      const auditor = await compliance.registerAuditor(
        { ...baseAuditorParams, role: 'compliance_officer' },
        adminAddress
      )

      expect(auditor.role).toBe('compliance_officer')
    })

    it('should get auditor by ID', async () => {
      const registered = await compliance.registerAuditor(
        baseAuditorParams,
        adminAddress
      )

      const retrieved = compliance.getAuditor(registered.auditorId)

      expect(retrieved).toBeDefined()
      expect(retrieved?.auditorId).toBe(registered.auditorId)
    })

    it('should return undefined for non-existent auditor', () => {
      const retrieved = compliance.getAuditor('auditor_nonexistent')
      expect(retrieved).toBeUndefined()
    })

    it('should get all auditors', async () => {
      await compliance.registerAuditor(baseAuditorParams, adminAddress)
      await compliance.registerAuditor(
        { ...baseAuditorParams, organization: 'Another Audit' },
        adminAddress
      )

      const all = compliance.getAllAuditors()

      expect(all).toHaveLength(2)
    })

    it('should get active auditors only', async () => {
      const auditor1 = await compliance.registerAuditor(
        baseAuditorParams,
        adminAddress
      )
      await compliance.registerAuditor(
        { ...baseAuditorParams, organization: 'Another Audit' },
        adminAddress
      )

      compliance.deactivateAuditor(
        auditor1.auditorId,
        adminAddress,
        'Contract ended'
      )

      const active = compliance.getActiveAuditors()

      expect(active).toHaveLength(1)
      expect(active[0].organization).toBe('Another Audit')
    })

    it('should deactivate an auditor', async () => {
      const auditor = await compliance.registerAuditor(
        baseAuditorParams,
        adminAddress
      )

      const deactivated = compliance.deactivateAuditor(
        auditor.auditorId,
        adminAddress,
        'Audit complete'
      )

      expect(deactivated.isActive).toBe(false)
      expect(deactivated.deactivatedAt).toBeDefined()
      expect(deactivated.deactivationReason).toBe('Audit complete')
    })

    it('should throw when deactivating non-existent auditor', () => {
      expect(() =>
        compliance.deactivateAuditor(
          'auditor_fake',
          adminAddress,
          'reason'
        )
      ).toThrow('auditor not found')
    })

    it('should update auditor scope', async () => {
      const auditor = await compliance.registerAuditor(
        baseAuditorParams,
        adminAddress
      )

      const newScope: AuditScope = {
        transactionTypes: ['inbound'],
        chains: ['solana'],
        tokens: ['USDC'],
        startDate: Math.floor(Date.now() / 1000),
      }

      const updated = compliance.updateAuditorScope(
        auditor.auditorId,
        newScope,
        adminAddress
      )

      expect(updated.scope.transactionTypes).toEqual(['inbound'])
      expect(updated.scope.chains).toEqual(['solana'])
      expect(updated.scope.tokens).toEqual(['USDC'])
    })

    // Validation tests
    it('should throw on missing organization', async () => {
      await expect(
        compliance.registerAuditor(
          { ...baseAuditorParams, organization: '' },
          adminAddress
        )
      ).rejects.toThrow('organization is required')
    })

    it('should throw on missing contact name', async () => {
      await expect(
        compliance.registerAuditor(
          { ...baseAuditorParams, contactName: '' },
          adminAddress
        )
      ).rejects.toThrow('contact name is required')
    })

    it('should throw on missing contact email', async () => {
      await expect(
        compliance.registerAuditor(
          { ...baseAuditorParams, contactEmail: '' },
          adminAddress
        )
      ).rejects.toThrow('contact email is required')
    })

    it('should throw on missing public key', async () => {
      await expect(
        compliance.registerAuditor(
          { ...baseAuditorParams, publicKey: '' as HexString },
          adminAddress
        )
      ).rejects.toThrow('public key is required')
    })
  })

  // ─── Transaction Disclosure Tests ─────────────────────────────────────────────

  describe('transaction disclosure', () => {
    let auditor: Awaited<ReturnType<typeof compliance.registerAuditor>>
    let viewingKey: ReturnType<typeof generateViewingKey>
    let mockPayment: ShieldedPayment

    beforeEach(async () => {
      const scope: AuditScope = {
        transactionTypes: ['all'],
        chains: ['ethereum'],
        tokens: [],
        startDate: Math.floor(Date.now() / 1000) - 86400 * 365,
      }

      auditor = await compliance.registerAuditor(
        {
          organization: 'Audit Co',
          contactName: 'Jane',
          contactEmail: 'jane@audit.com',
          publicKey: '0x04abcd' as HexString,
          scope,
        },
        adminAddress
      )

      viewingKey = generateViewingKey('test-payment')
      const metaAddress = generateStealthMetaAddress('ethereum')

      mockPayment = {
        paymentId: 'pay_mock123',
        stablecoin: 'USDC',
        token: {
          chain: 'ethereum',
          symbol: 'USDC',
          decimals: 6,
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        },
        amount: 1000_000000n,
        recipientAddress: '0xrecipient',
        recipientStealth: {
          address: '0xstealth',
          ephemeralPublicKey: metaAddress.metaAddress.spendingKey,
          viewTag: 42,
        },
        senderCommitment: {
          value: '0xcommitment' as HexString,
          blindingFactor: '0xblinding' as HexString,
        },
        memo: 'Test payment',
        purpose: 'vendor_payment',
        privacyLevel: PrivacyLevel.SHIELDED,
        sourceChain: 'ethereum',
        viewingKeyHash: viewingKey.hash,
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        status: 'pending',
      }
    })

    it('should disclose a transaction to an auditor', () => {
      const disclosed = compliance.discloseTransaction(
        mockPayment,
        auditor.auditorId,
        viewingKey,
        adminAddress
      )

      expect(disclosed.disclosureId).toMatch(/^disc_/)
      expect(disclosed.transactionId).toBe(mockPayment.paymentId)
      expect(disclosed.auditorId).toBe(auditor.auditorId)
      expect(disclosed.amount).toBe(mockPayment.amount)
      expect(disclosed.type).toBe('payment')
      expect(disclosed.chain).toBe('ethereum')
    })

    it('should include additional info in disclosure', () => {
      const disclosed = compliance.discloseTransaction(
        mockPayment,
        auditor.auditorId,
        viewingKey,
        adminAddress,
        {
          txHash: '0xtxhash123',
          blockNumber: 12345,
          riskScore: 25,
          riskFlags: ['large_amount'],
          notes: 'Quarterly payment',
          tags: ['vendor', 'recurring'],
        }
      )

      expect(disclosed.txHash).toBe('0xtxhash123')
      expect(disclosed.blockNumber).toBe(12345)
      expect(disclosed.riskScore).toBe(25)
      expect(disclosed.riskFlags).toContain('large_amount')
      expect(disclosed.notes).toBe('Quarterly payment')
      expect(disclosed.tags).toContain('vendor')
    })

    it('should throw for non-existent auditor', () => {
      expect(() =>
        compliance.discloseTransaction(
          mockPayment,
          'auditor_fake',
          viewingKey,
          adminAddress
        )
      ).toThrow('auditor not found')
    })

    it('should throw for inactive auditor', () => {
      compliance.deactivateAuditor(
        auditor.auditorId,
        adminAddress,
        'Contract ended'
      )

      expect(() =>
        compliance.discloseTransaction(
          mockPayment,
          auditor.auditorId,
          viewingKey,
          adminAddress
        )
      ).toThrow('auditor is not active')
    })

    it('should throw for transaction outside scope (wrong chain)', async () => {
      const narrowAuditor = await compliance.registerAuditor(
        {
          organization: 'Solana Only Audit',
          contactName: 'Sol Auditor',
          contactEmail: 'sol@audit.com',
          publicKey: '0x04xyz' as HexString,
          scope: {
            transactionTypes: ['all'],
            chains: ['solana'],
            tokens: [],
            startDate: Math.floor(Date.now() / 1000) - 86400,
          },
        },
        adminAddress
      )

      expect(() =>
        compliance.discloseTransaction(
          mockPayment, // ethereum payment
          narrowAuditor.auditorId,
          viewingKey,
          adminAddress
        )
      ).toThrow('transaction is outside auditor scope')
    })

    it('should retrieve disclosed transactions', () => {
      compliance.discloseTransaction(
        mockPayment,
        auditor.auditorId,
        viewingKey,
        adminAddress
      )

      const all = compliance.getDisclosedTransactions()
      expect(all).toHaveLength(1)

      const byAuditor = compliance.getDisclosedTransactions(auditor.auditorId)
      expect(byAuditor).toHaveLength(1)
    })

    it('should get disclosed transaction by ID', () => {
      const disclosed = compliance.discloseTransaction(
        mockPayment,
        auditor.auditorId,
        viewingKey,
        adminAddress
      )

      const retrieved = compliance.getDisclosedTransaction(disclosed.disclosureId)

      expect(retrieved).toBeDefined()
      expect(retrieved?.disclosureId).toBe(disclosed.disclosureId)
    })
  })

  // ─── Disclosure Request Tests ─────────────────────────────────────────────────

  describe('disclosure requests', () => {
    let auditor: Awaited<ReturnType<typeof compliance.registerAuditor>>

    beforeEach(async () => {
      auditor = await compliance.registerAuditor(
        {
          organization: 'Request Audit',
          contactName: 'Req Auditor',
          contactEmail: 'req@audit.com',
          publicKey: '0x04request' as HexString,
          scope: {
            transactionTypes: ['all'],
            chains: [],
            tokens: [],
            startDate: Math.floor(Date.now() / 1000) - 86400,
          },
        },
        adminAddress
      )
    })

    it('should create a disclosure request', () => {
      const request = compliance.createDisclosureRequest(
        'tx_123',
        auditor.auditorId,
        'Regulatory inquiry'
      )

      expect(request.requestId).toMatch(/^req_/)
      expect(request.transactionId).toBe('tx_123')
      expect(request.auditorId).toBe(auditor.auditorId)
      expect(request.reason).toBe('Regulatory inquiry')
      expect(request.status).toBe('pending')
    })

    it('should throw for non-existent auditor', () => {
      expect(() =>
        compliance.createDisclosureRequest(
          'tx_123',
          'auditor_fake',
          'reason'
        )
      ).toThrow('auditor not found')
    })

    it('should approve a disclosure request', () => {
      const request = compliance.createDisclosureRequest(
        'tx_123',
        auditor.auditorId,
        'Regulatory inquiry'
      )

      const approved = compliance.approveDisclosureRequest(
        request.requestId,
        adminAddress
      )

      expect(approved.status).toBe('approved')
      expect(approved.approvedBy).toBe(adminAddress)
      expect(approved.resolvedAt).toBeDefined()
    })

    it('should deny a disclosure request', () => {
      const request = compliance.createDisclosureRequest(
        'tx_123',
        auditor.auditorId,
        'Fishing expedition'
      )

      const denied = compliance.denyDisclosureRequest(
        request.requestId,
        adminAddress,
        'Insufficient justification'
      )

      expect(denied.status).toBe('denied')
      expect(denied.denialReason).toBe('Insufficient justification')
    })

    it('should get pending requests', () => {
      compliance.createDisclosureRequest('tx_1', auditor.auditorId, 'reason 1')
      const req2 = compliance.createDisclosureRequest('tx_2', auditor.auditorId, 'reason 2')
      compliance.createDisclosureRequest('tx_3', auditor.auditorId, 'reason 3')

      compliance.approveDisclosureRequest(req2.requestId, adminAddress)

      const pending = compliance.getPendingRequests()

      expect(pending).toHaveLength(2)
    })

    it('should throw when approving non-existent request', () => {
      expect(() =>
        compliance.approveDisclosureRequest('req_fake', adminAddress)
      ).toThrow('request not found')
    })
  })

  // ─── Report Generation Tests ──────────────────────────────────────────────────

  describe('report generation', () => {
    let auditor: Awaited<ReturnType<typeof compliance.registerAuditor>>

    beforeEach(async () => {
      auditor = await compliance.registerAuditor(
        {
          organization: 'Report Audit',
          contactName: 'Rep Auditor',
          contactEmail: 'rep@audit.com',
          publicKey: '0x04report' as HexString,
          scope: {
            transactionTypes: ['all'],
            chains: [],
            tokens: [],
            startDate: Math.floor(Date.now() / 1000) - 86400 * 30,
          },
        },
        adminAddress
      )

      // Add some disclosed transactions for reporting
      const viewingKey = generateViewingKey('report-test')
      const metaAddress = generateStealthMetaAddress('ethereum')

      for (let i = 0; i < 5; i++) {
        const payment: ShieldedPayment = {
          paymentId: `pay_${i}`,
          stablecoin: 'USDC',
          token: {
            chain: 'ethereum',
            symbol: i % 2 === 0 ? 'USDC' : 'USDT',
            decimals: 6,
            address: '0xtoken',
          },
          amount: BigInt((i + 1) * 1000_000000),
          recipientAddress: `0xrecipient${i}`,
          recipientStealth: {
            address: `0xstealth${i}`,
            ephemeralPublicKey: metaAddress.metaAddress.spendingKey,
            viewTag: i,
          },
          senderCommitment: {
            value: `0xcommitment${i}` as HexString,
            blindingFactor: `0xblinding${i}` as HexString,
          },
          purpose: 'vendor_payment',
          privacyLevel: PrivacyLevel.SHIELDED,
          sourceChain: 'ethereum',
          viewingKeyHash: viewingKey.hash,
          createdAt: Math.floor(Date.now() / 1000) - 86400 * (5 - i),
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          status: 'completed',
        }

        compliance.discloseTransaction(
          payment,
          auditor.auditorId,
          viewingKey,
          adminAddress,
          { riskScore: i * 20 }
        )
      }
    })

    it('should generate a JSON report', async () => {
      const report = await compliance.generateReport(
        {
          type: 'transaction_summary',
          title: 'Q4 2024 Report',
          format: 'json',
          startDate: Math.floor(Date.now() / 1000) - 86400 * 30,
          endDate: Math.floor(Date.now() / 1000) + 86400,
        },
        adminAddress
      )

      expect(report.reportId).toMatch(/^report_/)
      expect(report.status).toBe(ReportStatus.COMPLETED)
      expect(report.data).toBeDefined()
      expect(report.data?.summary.totalTransactions).toBe(5)
    })

    it('should generate a CSV report', async () => {
      const report = await compliance.generateReport(
        {
          type: 'transaction_summary',
          title: 'CSV Export',
          format: 'csv',
          startDate: Math.floor(Date.now() / 1000) - 86400 * 30,
          endDate: Math.floor(Date.now() / 1000) + 86400,
        },
        adminAddress
      )

      expect(report.status).toBe(ReportStatus.COMPLETED)
      expect(report.content).toBeDefined()
      expect(report.content).toContain('Transaction ID')
      expect(report.content).toContain('pay_0')
    })

    it('should include transactions when requested', async () => {
      const report = await compliance.generateReport(
        {
          type: 'audit_trail',
          title: 'Full Audit',
          format: 'json',
          startDate: Math.floor(Date.now() / 1000) - 86400 * 30,
          endDate: Math.floor(Date.now() / 1000) + 86400,
          includeTransactions: true,
        },
        adminAddress
      )

      expect(report.data?.transactions).toBeDefined()
      expect(report.data?.transactions).toHaveLength(5)
    })

    it('should filter by date range', async () => {
      const report = await compliance.generateReport(
        {
          type: 'transaction_summary',
          title: 'Recent Only',
          format: 'json',
          startDate: Math.floor(Date.now() / 1000) - 86400 * 2,
          endDate: Math.floor(Date.now() / 1000) + 86400,
        },
        adminAddress
      )

      expect(report.data?.summary.totalTransactions).toBeLessThan(5)
    })

    it('should compute risk summary', async () => {
      const report = await compliance.generateReport(
        {
          type: 'risk_assessment',
          title: 'Risk Report',
          format: 'json',
          startDate: Math.floor(Date.now() / 1000) - 86400 * 30,
          endDate: Math.floor(Date.now() / 1000) + 86400,
        },
        adminAddress
      )

      expect(report.data?.riskSummary).toBeDefined()
      expect(report.data?.riskSummary?.lowRisk).toBeGreaterThanOrEqual(0)
    })

    it('should throw on missing title', async () => {
      await expect(
        compliance.generateReport(
          {
            type: 'transaction_summary',
            title: '',
            format: 'json',
            startDate: 0,
            endDate: 1,
          },
          adminAddress
        )
      ).rejects.toThrow('report title is required')
    })

    it('should throw on invalid date range', async () => {
      await expect(
        compliance.generateReport(
          {
            type: 'transaction_summary',
            title: 'Bad Range',
            format: 'json',
            startDate: 1000,
            endDate: 500,
          },
          adminAddress
        )
      ).rejects.toThrow('start date must be before end date')
    })

    it('should get report by ID', async () => {
      const report = await compliance.generateReport(
        {
          type: 'transaction_summary',
          title: 'Test Report',
          format: 'json',
          startDate: Math.floor(Date.now() / 1000) - 86400 * 30,
          endDate: Math.floor(Date.now() / 1000) + 86400,
        },
        adminAddress
      )

      const retrieved = compliance.getReport(report.reportId)

      expect(retrieved).toBeDefined()
      expect(retrieved?.reportId).toBe(report.reportId)
    })

    it('should get all reports', async () => {
      await compliance.generateReport(
        {
          type: 'transaction_summary',
          title: 'Report 1',
          format: 'json',
          startDate: Math.floor(Date.now() / 1000) - 86400 * 30,
          endDate: Math.floor(Date.now() / 1000) + 86400,
        },
        adminAddress
      )
      await compliance.generateReport(
        {
          type: 'audit_trail',
          title: 'Report 2',
          format: 'csv',
          startDate: Math.floor(Date.now() / 1000) - 86400 * 30,
          endDate: Math.floor(Date.now() / 1000) + 86400,
        },
        adminAddress
      )

      const all = compliance.getAllReports()

      expect(all).toHaveLength(2)
    })
  })

  // ─── Audit Log Tests ──────────────────────────────────────────────────────────

  describe('audit log', () => {
    it('should log auditor registration', async () => {
      await compliance.registerAuditor(
        {
          organization: 'Log Test Audit',
          contactName: 'Logger',
          contactEmail: 'log@audit.com',
          publicKey: '0x04log' as HexString,
          scope: {
            transactionTypes: ['all'],
            chains: [],
            tokens: [],
            startDate: 0,
          },
        },
        adminAddress
      )

      const log = compliance.getAuditLog({ action: 'auditor_registered' })

      expect(log).toHaveLength(1)
      expect(log[0].action).toBe('auditor_registered')
      expect(log[0].actor).toBe(adminAddress)
    })

    it('should filter by date range', async () => {
      const now = Math.floor(Date.now() / 1000)

      await compliance.registerAuditor(
        {
          organization: 'Date Test',
          contactName: 'Date',
          contactEmail: 'date@audit.com',
          publicKey: '0x04date' as HexString,
          scope: {
            transactionTypes: ['all'],
            chains: [],
            tokens: [],
            startDate: 0,
          },
        },
        adminAddress
      )

      const log = compliance.getAuditLog({
        startDate: now - 60,
        endDate: now + 60,
      })

      expect(log.length).toBeGreaterThan(0)
    })

    it('should filter by actor', async () => {
      const actor1 = '0xactor1'
      const actor2 = '0xactor2'

      await compliance.registerAuditor(
        {
          organization: 'Actor1 Audit',
          contactName: 'A1',
          contactEmail: 'a1@audit.com',
          publicKey: '0x04a1' as HexString,
          scope: {
            transactionTypes: ['all'],
            chains: [],
            tokens: [],
            startDate: 0,
          },
        },
        actor1
      )

      await compliance.registerAuditor(
        {
          organization: 'Actor2 Audit',
          contactName: 'A2',
          contactEmail: 'a2@audit.com',
          publicKey: '0x04a2' as HexString,
          scope: {
            transactionTypes: ['all'],
            chains: [],
            tokens: [],
            startDate: 0,
          },
        },
        actor2
      )

      const log = compliance.getAuditLog({ actor: actor1 })

      expect(log).toHaveLength(1)
      expect(log[0].details).toHaveProperty('organization', 'Actor1 Audit')
    })

    it('should limit results', async () => {
      for (let i = 0; i < 5; i++) {
        await compliance.registerAuditor(
          {
            organization: `Limit Audit ${i}`,
            contactName: `L${i}`,
            contactEmail: `l${i}@audit.com`,
            publicKey: `0x04limit${i}` as HexString,
            scope: {
              transactionTypes: ['all'],
              chains: [],
              tokens: [],
              startDate: 0,
            },
          },
          adminAddress
        )
      }

      const log = compliance.getAuditLog({ limit: 3 })

      expect(log).toHaveLength(3)
    })
  })

  // ─── Export Tests ─────────────────────────────────────────────────────────────

  describe('export', () => {
    let auditor: Awaited<ReturnType<typeof compliance.registerAuditor>>

    beforeEach(async () => {
      auditor = await compliance.registerAuditor(
        {
          organization: 'Export Audit',
          contactName: 'Exp',
          contactEmail: 'exp@audit.com',
          publicKey: '0x04export' as HexString,
          scope: {
            transactionTypes: ['all'],
            chains: [],
            tokens: [],
            startDate: 0,
          },
        },
        adminAddress
      )

      const viewingKey = generateViewingKey('export-test')
      const metaAddress = generateStealthMetaAddress('ethereum')

      const payment: ShieldedPayment = {
        paymentId: 'pay_export',
        stablecoin: 'USDC',
        token: {
          chain: 'ethereum',
          symbol: 'USDC',
          decimals: 6,
          address: '0xtoken',
        },
        amount: 5000_000000n,
        recipientAddress: '0xrecipient',
        recipientStealth: {
          address: '0xstealth',
          ephemeralPublicKey: metaAddress.metaAddress.spendingKey,
          viewTag: 1,
        },
        senderCommitment: {
          value: '0xcommitment' as HexString,
          blindingFactor: '0xblinding' as HexString,
        },
        privacyLevel: PrivacyLevel.SHIELDED,
        sourceChain: 'ethereum',
        viewingKeyHash: viewingKey.hash,
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        status: 'completed',
      }

      compliance.discloseTransaction(
        payment,
        auditor.auditorId,
        viewingKey,
        adminAddress
      )
    })

    it('should export to CSV', () => {
      const csv = compliance.exportToCSV()

      expect(csv).toContain('Transaction ID')
      expect(csv).toContain('pay_export')
      expect(csv).toContain('USDC')
      expect(csv).toContain('ethereum')
    })

    it('should export to CSV for specific auditor', () => {
      const csv = compliance.exportToCSV(auditor.auditorId)

      expect(csv).toContain('pay_export')
    })

    it('should export to JSON', () => {
      const json = compliance.exportToJSON()
      const parsed = JSON.parse(json)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].transactionId).toBe('pay_export')
    })

    it('should export to JSON for specific auditor', () => {
      const json = compliance.exportToJSON(auditor.auditorId)
      const parsed = JSON.parse(json)

      expect(parsed).toHaveLength(1)
    })
  })

  // ─── Serialization Tests ──────────────────────────────────────────────────────

  describe('serialization', () => {
    it('should serialize and deserialize', async () => {
      const auditor = await compliance.registerAuditor(
        {
          organization: 'Serialize Audit',
          contactName: 'Ser',
          contactEmail: 'ser@audit.com',
          publicKey: '0x04serialize' as HexString,
          scope: {
            transactionTypes: ['all'],
            chains: [],
            tokens: [],
            startDate: 0,
          },
        },
        adminAddress
      )

      const viewingKey = generateViewingKey('serialize-test')
      const metaAddress = generateStealthMetaAddress('ethereum')

      const payment: ShieldedPayment = {
        paymentId: 'pay_serialize',
        stablecoin: 'USDC',
        token: {
          chain: 'ethereum',
          symbol: 'USDC',
          decimals: 6,
          address: '0xtoken',
        },
        amount: 1000_000000n,
        recipientAddress: '0xrecipient',
        recipientStealth: {
          address: '0xstealth',
          ephemeralPublicKey: metaAddress.metaAddress.spendingKey,
          viewTag: 1,
        },
        senderCommitment: {
          value: '0xcommitment' as HexString,
          blindingFactor: '0xblinding' as HexString,
        },
        privacyLevel: PrivacyLevel.SHIELDED,
        sourceChain: 'ethereum',
        viewingKeyHash: viewingKey.hash,
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        status: 'completed',
      }

      compliance.discloseTransaction(
        payment,
        auditor.auditorId,
        viewingKey,
        adminAddress
      )

      const json = compliance.toJSON()
      const restored = ComplianceManager.fromJSON(json)

      expect(restored.organizationId).toBe(compliance.organizationId)
      expect(restored.getAllAuditors()).toHaveLength(1)
      expect(restored.getDisclosedTransactions()).toHaveLength(1)
    })

    it('should handle bigint serialization', async () => {
      const mgr = await ComplianceManager.create({
        organizationName: 'BigInt Test',
        highValueThreshold: 999999_000000n,
      })

      const json = mgr.toJSON()
      const restored = ComplianceManager.fromJSON(json)
      const config = restored.getConfig()

      expect(config.highValueThreshold).toBe(999999_000000n)
    })
  })
})
