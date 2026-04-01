/**
 * Heretek OpenClaw — Approval Bypass Unit Tests
 * ==============================================================================
 * Unit tests for approval bypass mechanism and Liberation plugin integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock implementations for approval module
vi.mock('../../modules/approval-system.js', () => ({
    checkApprovalRequired: vi.fn(),
    bypassApproval: vi.fn(),
    requestApproval: vi.fn(),
    approveAction: vi.fn(),
    rejectAction: vi.fn(),
    getApprovalStatus: vi.fn(),
    listPendingApprovals: vi.fn()
}));

// Mock implementations for Liberation plugin
vi.mock('../../plugins/liberation-plugin.js', () => ({
    canBypass: vi.fn(),
    executeBypass: vi.fn(),
    logBypassEvent: vi.fn(),
    validateBypassReason: vi.fn(),
    getBypassHistory: vi.fn()
}));

describe('Approval Bypass System', () => {
    const AGENT_ID = 'steward';
    const ACTION_ID = 'action-123';
    const ACTION_TYPE = 'resource-modification';

    let approvalModule: any;
    let liberationPlugin: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        approvalModule = await import('../../modules/approval-system.js');
        liberationPlugin = await import('../../plugins/liberation-plugin.js');
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Approval Requirement Check', () => {
        it('should check if approval is required for action', async () => {
            const { checkApprovalRequired } = approvalModule;
            
            const result = await checkApprovalRequired(AGENT_ID, ACTION_TYPE, ACTION_ID);
            
            expect(result.requiresApproval).toBeDefined();
            expect(typeof result.requiresApproval).toBe('boolean');
        });

        it('should not require approval for safe actions', async () => {
            const { checkApprovalRequired } = approvalModule;
            
            const safeActions = ['read', 'list', 'status'];
            
            for (const action of safeActions) {
                const result = await checkApprovalRequired(AGENT_ID, action, ACTION_ID);
                expect(result.requiresApproval).toBe(false);
            }
        });

        it('should require approval for dangerous actions', async () => {
            const { checkApprovalRequired } = approvalModule;
            
            const dangerousActions = ['delete', 'modify', 'execute', 'deploy'];
            
            for (const action of dangerousActions) {
                const result = await checkApprovalRequired(AGENT_ID, action, ACTION_ID);
                expect(result.requiresApproval).toBe(true);
            }
        });

        it('should include reason when approval required', async () => {
            const { checkApprovalRequired } = approvalModule;
            
            const result = await checkApprovalRequired(AGENT_ID, 'delete', ACTION_ID);
            
            if (result.requiresApproval) {
                expect(result.reason).toBeDefined();
            }
        });
    });

    describe('Approval Bypass Mechanism', () => {
        it('should bypass approval with valid reason', async () => {
            const { bypassApproval } = approvalModule;
            const { validateBypassReason } = liberationPlugin;
            
            const bypassReason = 'Emergency system recovery - automated procedure';
            
            // Validate reason first
            const validation = await validateBypassReason(bypassReason);
            expect(validation.valid).toBe(true);
            
            // Then bypass
            const result = await bypassApproval(AGENT_ID, ACTION_ID, bypassReason);
            
            expect(result.success).toBe(true);
            expect(result.bypassed).toBe(true);
            expect(result.reason).toBe(bypassReason);
        });

        it('should reject bypass with invalid reason', async () => {
            const { bypassApproval } = approvalModule;
            const { validateBypassReason } = liberationPlugin;
            
            const invalidReasons = ['', 'because', 'i want to'];
            
            for (const reason of invalidReasons) {
                const validation = await validateBypassReason(reason);
                expect(validation.valid).toBe(false);
                
                const result = await bypassApproval(AGENT_ID, ACTION_ID, reason);
                expect(result.success).toBe(false);
            }
        });

        it('should require agent authorization for bypass', async () => {
            const { bypassApproval } = approvalModule;
            
            // Only authorized agents can bypass
            const unauthorizedAgent = 'unauthorized-agent';
            const result = await bypassApproval(unauthorizedAgent, ACTION_ID, 'test');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('unauthorized');
        });

        it('should log bypass event', async () => {
            const { bypassApproval } = approvalModule;
            const { logBypassEvent } = liberationPlugin;
            
            await bypassApproval(AGENT_ID, ACTION_ID, 'Emergency procedure');
            
            expect(logBypassEvent).toHaveBeenCalledWith({
                agentId: AGENT_ID,
                actionId: ACTION_ID,
                reason: 'Emergency procedure',
                timestamp: expect.anything()
            });
        });

        it('should track bypass count', async () => {
            const { bypassApproval } = approvalModule;
            const { getBypassHistory } = liberationPlugin;
            
            await bypassApproval(AGENT_ID, 'action-1', 'Reason 1');
            await bypassApproval(AGENT_ID, 'action-2', 'Reason 2');
            
            const history = await getBypassHistory(AGENT_ID);
            
            expect(history.count).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Approval Request Flow', () => {
        it('should create approval request', async () => {
            const { requestApproval } = approvalModule;
            
            const request = {
                agentId: AGENT_ID,
                actionType: ACTION_TYPE,
                actionId: ACTION_ID,
                details: { resource: 'database', operation: 'delete' }
            };
            
            const result = await requestApproval(request);
            
            expect(result.success).toBe(true);
            expect(result.requestId).toBeDefined();
            expect(result.status).toBe('pending');
        });

        it('should approve pending request', async () => {
            const { requestApproval, approveAction } = approvalModule;
            
            const requestResult = await requestApproval({
                agentId: AGENT_ID,
                actionType: ACTION_TYPE,
                actionId: ACTION_ID,
                details: {}
            });
            
            const approveResult = await approveAction(requestResult.requestId, 'admin');
            
            expect(approveResult.success).toBe(true);
            expect(approveResult.status).toBe('approved');
        });

        it('should reject pending request', async () => {
            const { requestApproval, rejectAction } = approvalModule;
            
            const requestResult = await requestApproval({
                agentId: AGENT_ID,
                actionType: ACTION_TYPE,
                actionId: ACTION_ID,
                details: {}
            });
            
            const rejectResult = await rejectAction(requestResult.requestId, 'admin', 'Security concern');
            
            expect(rejectResult.success).toBe(true);
            expect(rejectResult.status).toBe('rejected');
        });

        it('should get approval status', async () => {
            const { requestApproval, getApprovalStatus } = approvalModule;
            
            const requestResult = await requestApproval({
                agentId: AGENT_ID,
                actionType: ACTION_TYPE,
                actionId: ACTION_ID,
                details: {}
            });
            
            const status = await getApprovalStatus(requestResult.requestId);
            
            expect(status.success).toBe(true);
            expect(status.requestId).toBe(requestResult.requestId);
            expect(status.status).toBe('pending');
        });

        it('should list pending approvals', async () => {
            const { listPendingApprovals } = approvalModule;
            
            const pending = await listPendingApprovals();
            
            expect(Array.isArray(pending)).toBe(true);
        });
    });

    describe('Liberation Plugin Integration', () => {
        it('should check if bypass is allowed', async () => {
            const { canBypass } = liberationPlugin;
            
            const result = await canBypass(AGENT_ID, ACTION_TYPE);
            
            expect(typeof result.allowed).toBe('boolean');
            if (!result.allowed) {
                expect(result.reason).toBeDefined();
            }
        });

        it('should execute bypass procedure', async () => {
            const { executeBypass } = liberationPlugin;
            
            const result = await executeBypass({
                agentId: AGENT_ID,
                actionId: ACTION_ID,
                reason: 'System emergency',
                authorizedBy: 'system'
            });
            
            expect(result.success).toBe(true);
            expect(result.bypassId).toBeDefined();
        });

        it('should validate bypass reason format', async () => {
            const { validateBypassReason } = liberationPlugin;
            
            const validReasons = [
                'Emergency system recovery - automated procedure',
                'Critical security patch deployment',
                'Automated rollback triggered by monitoring'
            ];
            
            for (const reason of validReasons) {
                const result = await validateBypassReason(reason);
                expect(result.valid).toBe(true);
            }
        });

        it('should reject empty bypass reason', async () => {
            const { validateBypassReason } = liberationPlugin;
            
            const result = await validateBypassReason('');
            
            expect(result.valid).toBe(false);
            expect(result.error).toContain('required');
        });

        it('should get bypass history', async () => {
            const { getBypassHistory } = liberationPlugin;
            
            const history = await getBypassHistory(AGENT_ID);
            
            expect(history).toBeDefined();
            expect(Array.isArray(history.events || [])).toBe(true);
        });

        it('should filter bypass history by date range', async () => {
            const { getBypassHistory } = liberationPlugin;
            
            const now = Date.now();
            const oneHourAgo = now - 3600000;
            
            const history = await getBypassHistory(AGENT_ID, {
                startTime: oneHourAgo,
                endTime: now
            });
            
            expect(history).toBeDefined();
        });
    });

    describe('Approval Timeout', () => {
        it('should timeout pending approval after deadline', async () => {
            const { requestApproval, getApprovalStatus } = approvalModule;
            
            const requestResult = await requestApproval({
                agentId: AGENT_ID,
                actionType: ACTION_TYPE,
                actionId: ACTION_ID,
                details: {},
                timeout: 100 // 100ms for testing
            });
            
            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, 150));
            
            const status = await getApprovalStatus(requestResult.requestId);
            
            expect(status.status).toBe('timeout');
        });

        it('should not timeout if approved before deadline', async () => {
            const { requestApproval, approveAction, getApprovalStatus } = approvalModule;
            
            const requestResult = await requestApproval({
                agentId: AGENT_ID,
                actionType: ACTION_TYPE,
                actionId: ACTION_ID,
                details: {},
                timeout: 5000
            });
            
            // Approve immediately
            await approveAction(requestResult.requestId, 'admin');
            
            const status = await getApprovalStatus(requestResult.requestId);
            
            expect(status.status).toBe('approved');
        });
    });

    describe('Approval Chain', () => {
        it('should require multiple approvers for critical actions', async () => {
            const { checkApprovalRequired } = approvalModule;
            
            const criticalActions = ['system-shutdown', 'data-wipe', 'key-rotation'];
            
            for (const action of criticalActions) {
                const result = await checkApprovalRequired(AGENT_ID, action, ACTION_ID);
                
                expect(result.requiresApproval).toBe(true);
                expect(result.requiresMultipleApprovers).toBe(true);
                expect(result.requiredApprovers).toBeGreaterThanOrEqual(2);
            }
        });

        it('should track approval chain', async () => {
            const { requestApproval, approveAction } = approvalModule;
            
            const requestResult = await requestApproval({
                agentId: AGENT_ID,
                actionType: 'critical-action',
                actionId: ACTION_ID,
                details: {},
                requiresMultipleApprovers: true
            });
            
            // First approval
            await approveAction(requestResult.requestId, 'approver-1');
            
            // Second approval
            await approveAction(requestResult.requestId, 'approver-2');
            
            // Verify chain
            const status = await approvalModule.getApprovalStatus(requestResult.requestId);
            
            expect(status.approvals).toBeDefined();
            expect(status.approvals.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Emergency Bypass', () => {
        it('should allow emergency bypass for critical situations', async () => {
            const { bypassApproval } = approvalModule;
            const { canBypass } = liberationPlugin;
            
            // Check if emergency bypass is allowed
            const canBypassResult = await canBypass(AGENT_ID, 'emergency-shutdown');
            
            // If emergency bypass is configured
            if (canBypassResult.allowed) {
                const result = await bypassApproval(AGENT_ID, ACTION_ID, 'CRITICAL: System emergency');
                expect(result.success).toBe(true);
                expect(result.emergency).toBe(true);
            }
        });

        it('should require post-hoc review for emergency bypass', async () => {
            const { bypassApproval } = approvalModule;
            const { logBypassEvent } = liberationPlugin;
            
            await bypassApproval(AGENT_ID, ACTION_ID, 'CRITICAL: Emergency');
            
            expect(logBypassEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    agentId: AGENT_ID,
                    emergency: true,
                    requiresReview: true
                })
            );
        });
    });
});
