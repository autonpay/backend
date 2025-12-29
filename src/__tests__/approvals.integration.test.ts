/**
 * Approval Integration Tests
 *
 * Tests the complete approval flow including:
 * - Approval creation when transaction requires approval
 * - Listing and retrieving approvals
 * - Approving transactions (single and multi-approver)
 * - Rejecting transactions
 * - Expiration handling
 * - Authorization and validation
 */

import request from 'supertest';
import { Application } from 'express';
import { prisma } from '../database/client';
import { createServer } from '../server';
import { RuleType } from '../services/rules';
import { ApprovalStatus } from '../services/approvals/approval.types';

describe('Approval Integration Tests', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.approvalAction.deleteMany({
      where: {
        approval: {
          transaction: {
            metadata: { path: ['test'], equals: true },
          },
        },
      },
    });

    await prisma.approval.deleteMany({
      where: {
        transaction: {
          metadata: { path: ['test'], equals: true },
        },
      },
    });

    await prisma.transaction.deleteMany({
      where: { metadata: { path: ['test'], equals: true } },
    });

    await prisma.spendingRule.deleteMany({
      where: { conditions: { path: ['test'], equals: true } },
    });

    await prisma.agent.deleteMany({
      where: { name: { contains: 'Approval Test Agent' } },
    });

    await prisma.user.deleteMany({
      where: { email: { contains: 'approval-int-' } },
    });

    await prisma.organization.deleteMany({
      where: { email: { contains: 'approval-int-' } },
    });

    await prisma.$disconnect();
  });

  const registerTestOrg = async () => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const email = `approval-int-${unique}@example.com`;
    const organizationName = `Approval Integration Org ${unique}`;

    const response = await request(app)
      .post('/v1/auth/register')
      .send({
        email,
        password: 'SecurePass123',
        organizationName,
      })
      .expect(201);

    return {
      token: response.body.data.token as string,
      organizationId: response.body.data.organization.id as string,
      userId: response.body.data.user.id as string,
    };
  };

  const createAgent = async (token: string) => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    const response = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Approval Test Agent ${suffix}`,
        description: 'Test agent for approvals',
      })
      .expect(201);

    return response.body.data;
  };

  const fundAgent = async (agentId: string, amount: number) => {
    await prisma.agentBalance.upsert({
      where: { agentId },
      create: {
        agentId,
        balanceUsd: amount,
        balanceUsdc: 0,
        pendingUsd: 0,
      },
      update: {
        balanceUsd: amount,
      },
    });

    await prisma.ledgerEntry.create({
      data: {
        account: `agent:${agentId}`,
        debit: '0',
        credit: amount.toString(),
        balance: amount.toString(),
        currency: 'USD',
        description: 'Test funding',
        metadata: { test: true },
      },
    });
  };

  const createApprovalRule = async (token: string, agentId: string) => {
    const response = await request(app)
      .post('/v1/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        agentId,
        ruleType: RuleType.PER_TRANSACTION,
        limitAmount: 100,
        limitCurrency: 'USD',
        priority: 1,
        conditions: {
          approvalThreshold: 500, // Amounts > 100 but <= 500 require approval
          requiredApprovers: 1,
          test: true,
        },
      })
      .expect(201);

    return response.body.data;
  };

  const createTransactionRequiringApproval = async (
    token: string,
    agentId: string,
    amount: number
  ) => {
    const response = await request(app)
      .post(`/v1/agents/${agentId}/spend`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount,
        currency: 'USD',
        toAddress: '0x742D35CC6634c0532925A3b844BC9E7595F0BEb0',
        metadata: { test: true },
      })
      .expect(201);

    return response.body.data;
  };

  describe('Approval Creation', () => {
    it('should create approval when transaction requires approval', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token, agent.id);

      const transaction = await createTransactionRequiringApproval(token, agent.id, 200);

      expect(transaction.status).toBe('pending_approval');
      expect(transaction.requiresApproval).toBe(true);

      // Check that approval was created
      const approvalResponse = await request(app)
        .get(`/v1/transactions/${transaction.id}/approval`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const approval = approvalResponse.body.data;
      expect(approval).toBeTruthy();
      expect(approval.status).toBe(ApprovalStatus.PENDING);
      expect(approval.transactionId).toBe(transaction.id);
      expect(approval.requiredApprovers).toBe(1);
      expect(approval.currentApprovers).toBe(0);
    });

    it('should not create approval when transaction does not require approval', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token, agent.id);

      // Amount below limit - should not require approval
      const transaction = await createTransactionRequiringApproval(token, agent.id, 50);

      expect(transaction.status).toBe('pending');
      expect(transaction.requiresApproval).toBe(false);

      // Check that no approval was created
      const approvalResponse = await request(app)
        .get(`/v1/transactions/${transaction.id}/approval`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(approvalResponse.body.data).toBeNull();
    });
  });

  describe('Listing Approvals', () => {
    it('should list all approvals for organization', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token, agent.id);

      // Create two transactions requiring approval
      const tx1 = await createTransactionRequiringApproval(token, agent.id, 200);
      await createTransactionRequiringApproval(token, agent.id, 300);

      const response = await request(app)
        .get('/v1/approvals')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);

      const approvalIds = response.body.data.map((a: any) => a.id);
      const tx1Approval = (
        await request(app)
          .get(`/v1/transactions/${tx1.id}/approval`)
          .set('Authorization', `Bearer ${token}`)
      ).body.data;
      expect(approvalIds).toContain(tx1Approval.id);
    });

    it('should filter approvals by status', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token, agent.id);

      const transaction = await createTransactionRequiringApproval(token, agent.id, 200);
      const approval = (
        await request(app)
          .get(`/v1/transactions/${transaction.id}/approval`)
          .set('Authorization', `Bearer ${token}`)
      ).body.data;

      // Approve it
      await request(app)
        .post(`/v1/approvals/${approval.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      // List pending approvals - should not include the approved one
      const pendingResponse = await request(app)
        .get('/v1/approvals?status=pending')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const pendingApprovals = pendingResponse.body.data.filter(
        (a: any) => a.id === approval.id
      );
      expect(pendingApprovals.length).toBe(0);

      // List approved approvals - should include it
      const approvedResponse = await request(app)
        .get('/v1/approvals?status=approved')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const approvedApprovals = approvedResponse.body.data.filter(
        (a: any) => a.id === approval.id
      );
      expect(approvedApprovals.length).toBeGreaterThan(0);
    });

    it('should filter approvals by transactionId', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token, agent.id);

      const transaction = await createTransactionRequiringApproval(token, agent.id, 200);
      const approval = (
        await request(app)
          .get(`/v1/transactions/${transaction.id}/approval`)
          .set('Authorization', `Bearer ${token}`)
      ).body.data;

      const response = await request(app)
        .get(`/v1/approvals?transactionId=${transaction.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].id).toBe(approval.id);
    });
  });

  describe('Getting Approval Details', () => {
    it('should get approval by ID', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token, agent.id);

      const transaction = await createTransactionRequiringApproval(token, agent.id, 200);
      const approval = (
        await request(app)
          .get(`/v1/transactions/${transaction.id}/approval`)
          .set('Authorization', `Bearer ${token}`)
      ).body.data;

      const response = await request(app)
        .get(`/v1/approvals/${approval.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(approval.id);
      expect(response.body.data.transactionId).toBe(transaction.id);
      expect(response.body.data.status).toBe(ApprovalStatus.PENDING);
      expect(response.body.data.actions).toBeDefined();
      expect(Array.isArray(response.body.data.actions)).toBe(true);
    });

    it('should return 404 for non-existent approval', async () => {
      const { token } = await registerTestOrg();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await request(app)
        .get(`/v1/approvals/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should not allow accessing approvals from other organizations', async () => {
      const { token: token1 } = await registerTestOrg();
      const { token: token2 } = await registerTestOrg();

      const agent = await createAgent(token1);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token1, agent.id);

      const transaction = await createTransactionRequiringApproval(token1, agent.id, 200);
      const approval = (
        await request(app)
          .get(`/v1/transactions/${transaction.id}/approval`)
          .set('Authorization', `Bearer ${token1}`)
      ).body.data;

      // Try to access from different organization
      await request(app)
        .get(`/v1/approvals/${approval.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(404);
    });
  });

  describe('Approving Transactions', () => {
    it('should approve transaction with single approver', async () => {
      const { token, userId } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token, agent.id);

      const transaction = await createTransactionRequiringApproval(token, agent.id, 200);
      const approval = (
        await request(app)
          .get(`/v1/transactions/${transaction.id}/approval`)
          .set('Authorization', `Bearer ${token}`)
      ).body.data;

      const response = await request(app)
        .post(`/v1/approvals/${approval.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          comment: 'Looks good to me',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(ApprovalStatus.APPROVED);
      expect(response.body.data.currentApprovers).toBe(1);
      expect(response.body.data.actions.length).toBe(1);
      expect(response.body.data.actions[0].action).toBe('approved');
      expect(response.body.data.actions[0].comment).toBe('Looks good to me');

      // Check transaction status was updated
      const txResponse = await request(app)
        .get(`/v1/transactions/${transaction.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(txResponse.body.data.status).toBe('pending');
      expect(txResponse.body.data.approvedBy).toBe(userId);
      expect(txResponse.body.data.approvedAt).toBeTruthy();
    });

    it('should require multiple approvers when configured', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);

      // Create rule with 2 required approvers
      await request(app)
        .post('/v1/rules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          agentId: agent.id,
          ruleType: RuleType.PER_TRANSACTION,
          limitAmount: 100,
          limitCurrency: 'USD',
          priority: 1,
          conditions: {
            approvalThreshold: 500,
            requiredApprovers: 2,
            test: true,
          },
        })
        .expect(201);

      const transaction = await createTransactionRequiringApproval(token, agent.id, 200);
      const approval = (
        await request(app)
          .get(`/v1/transactions/${transaction.id}/approval`)
          .set('Authorization', `Bearer ${token}`)
      ).body.data;

      expect(approval.requiredApprovers).toBe(2);

      // First approval - should still be pending (needs 2 approvers)
      const response1 = await request(app)
        .post(`/v1/approvals/${approval.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      expect(response1.body.data.status).toBe(ApprovalStatus.PENDING);
      expect(response1.body.data.currentApprovers).toBe(1);

      // Try to approve again with same user - should fail
      await request(app)
        .post(`/v1/approvals/${approval.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400); // Should fail because same user can't approve twice

      // Transaction should still be pending_approval (needs second approver)
      const txResponse = await request(app)
        .get(`/v1/transactions/${transaction.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(txResponse.body.data.status).toBe('pending_approval');
    });

    it('should not allow same user to approve twice', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token, agent.id);

      const transaction = await createTransactionRequiringApproval(token, agent.id, 200);
      const approval = (
        await request(app)
          .get(`/v1/transactions/${transaction.id}/approval`)
          .set('Authorization', `Bearer ${token}`)
      ).body.data;

      // First approval
      await request(app)
        .post(`/v1/approvals/${approval.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      // Try to approve again
      await request(app)
        .post(`/v1/approvals/${approval.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('should not allow approving non-pending approval', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token, agent.id);

      const transaction = await createTransactionRequiringApproval(token, agent.id, 200);
      const approval = (
        await request(app)
          .get(`/v1/transactions/${transaction.id}/approval`)
          .set('Authorization', `Bearer ${token}`)
      ).body.data;

      // Approve it
      await request(app)
        .post(`/v1/approvals/${approval.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      // Try to approve again (already approved)
      await request(app)
        .post(`/v1/approvals/${approval.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });
  });

  describe('Rejecting Transactions', () => {
    it('should reject transaction', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token, agent.id);

      const transaction = await createTransactionRequiringApproval(token, agent.id, 200);
      const approval = (
        await request(app)
          .get(`/v1/transactions/${transaction.id}/approval`)
          .set('Authorization', `Bearer ${token}`)
      ).body.data;

      const response = await request(app)
        .post(`/v1/approvals/${approval.id}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          reason: 'Transaction amount too high',
          comment: 'Need to verify merchant first',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(ApprovalStatus.REJECTED);
      expect(response.body.data.actions.length).toBe(1);
      expect(response.body.data.actions[0].action).toBe('rejected');
      expect(response.body.data.actions[0].comment).toBe('Need to verify merchant first');

      // Check transaction status was updated
      const txResponse = await request(app)
        .get(`/v1/transactions/${transaction.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(txResponse.body.data.status).toBe('rejected');
      expect(txResponse.body.data.rejectionReason).toBe('Transaction amount too high');
    });

    it('should require rejection reason', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token, agent.id);

      const transaction = await createTransactionRequiringApproval(token, agent.id, 200);
      const approval = (
        await request(app)
          .get(`/v1/transactions/${transaction.id}/approval`)
          .set('Authorization', `Bearer ${token}`)
      ).body.data;

      await request(app)
        .post(`/v1/approvals/${approval.id}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          comment: 'No reason provided',
        })
        .expect(400);
    });

    it('should not allow rejecting non-pending approval', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);
      await fundAgent(agent.id, 1000);
      await createApprovalRule(token, agent.id);

      const transaction = await createTransactionRequiringApproval(token, agent.id, 200);
      const approval = (
        await request(app)
          .get(`/v1/transactions/${transaction.id}/approval`)
          .set('Authorization', `Bearer ${token}`)
      ).body.data;

      // Approve it first
      await request(app)
        .post(`/v1/approvals/${approval.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      // Try to reject (already approved)
      await request(app)
        .post(`/v1/approvals/${approval.id}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          reason: 'Changed my mind',
        })
        .expect(400);
    });
  });

  describe('Authorization', () => {
    it('should only show approvals from user organization', async () => {
      const { token: token1 } = await registerTestOrg();
      const { token: token2 } = await registerTestOrg();

      const agent1 = await createAgent(token1);
      await fundAgent(agent1.id, 1000);
      await createApprovalRule(token1, agent1.id);

      const transaction = await createTransactionRequiringApproval(token1, agent1.id, 200);

      // User from org2 should not see org1's approvals
      const response = await request(app)
        .get('/v1/approvals')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      const org1ApprovalIds = response.body.data
        .map((a: any) => a.transactionId)
        .filter((txId: string) => txId === transaction.id);
      expect(org1ApprovalIds.length).toBe(0);
    });
  });
});

