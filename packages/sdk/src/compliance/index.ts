/**
 * Enterprise Compliance Module for SIP Protocol
 *
 * Provides compliance management, auditor access control,
 * transaction disclosure, and reporting functionality.
 *
 * @example
 * ```typescript
 * import { ComplianceManager } from '@sip-protocol/sdk'
 *
 * // Create compliance manager
 * const compliance = await ComplianceManager.create({
 *   organizationName: 'Acme Corp',
 * })
 *
 * // Register an auditor
 * const auditor = await compliance.registerAuditor({
 *   organization: 'Big Four Audit',
 *   contactName: 'John Auditor',
 *   contactEmail: 'john@bigfour.com',
 *   publicKey: '0x...',
 *   scope: {
 *     transactionTypes: ['all'],
 *     chains: ['ethereum'],
 *     tokens: [],
 *     startDate: Date.now() / 1000 - 365 * 24 * 60 * 60,
 *   },
 * }, adminAddress)
 *
 * // Generate compliance report
 * const report = await compliance.generateReport({
 *   type: 'transaction_summary',
 *   title: 'Q4 Report',
 *   format: 'json',
 *   startDate: quarterStart,
 *   endDate: quarterEnd,
 * }, requesterAddress)
 * ```
 *
 * @module compliance
 */

export { ComplianceManager } from './compliance-manager'
