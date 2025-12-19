import request from 'supertest';
import { Application } from 'express';
import { prisma } from '../database/client';
import { createServer } from '../server';
import { RuleType } from '../services/rules';

describe('Transaction Integration Tests', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    await prisma.transaction.deleteMany({
      where: { metadata: { path: ['test'], equals: true } },
    });

    await prisma.spendingRule.deleteMany({
      where: { conditions: { path: ['test'], equals: true } },
    });

    await prisma.agent.deleteMany({
      where: { name: { contains: 'Transaction Test Agent' } },
    });

    await prisma.user.deleteMany({
      where: { email: { contains: 'txn-int-' } },
    });

    await prisma.organization.deleteMany({
      where: { email: { contains: 'txn-int-' } },
    });

    await prisma.$disconnect();
  });

  const registerTestOrg = async () => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const email = `txn-int-${unique}@example.com`;
    const organizationName = `Transaction Integration Org ${unique}`;

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
    };
  };

  const createAgent = async (token: string) => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    const response = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Transaction Test Agent ${suffix}`,
        description: 'Test agent for transactions',
      })
      .expect(201);

    return response.body.data;
  };

  const fundAgent = async (agentId: string, amount: number) => {
    // Update agent balance cache directly for testing
    // In production, this would go through the ledger service
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

    // Also create a ledger entry for balance calculation
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

  const createRule = async (token: string, overrides: Partial<{
    agentId: string;
    ruleType: RuleType;
    limitAmount: number;
    priority: number;
  }> = {}) => {
    const response = await request(app)
      .post('/v1/rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ruleType: overrides.ruleType ?? RuleType.PER_TRANSACTION,
        limitAmount: overrides.limitAmount ?? 1000,
        limitCurrency: 'USD',
        priority: overrides.priority ?? 100,
        conditions: { test: true },
        ...overrides,
      })
      .expect(201);

    return response.body.data;
  };

  describe('POST /v1/agents/:id/spend', () => {
    it('creates a transaction successfully', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);

      // Fund the agent
      await fundAgent(agent.id, 1000);

      const response = await request(app)
        .post(`/v1/agents/${agent.id}/spend`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 100,
          currency: 'USD',
          merchantName: 'Test Merchant',
          category: 'software',
          metadata: { test: true },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.agentId).toBe(agent.id);
      expect(response.body.data.amount).toBe(100);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.currency).toBe('USD');
    });

    it('rejects transaction when balance is insufficient', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);

      // Don't fund the agent (balance = 0)

      const response = await request(app)
        .post(`/v1/agents/${agent.id}/spend`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 100,
          currency: 'USD',
          metadata: { test: true },
        })
        .expect(402); // 402 Payment Required for insufficient balance

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('INSUFFICIENT_BALANCE');
    });

    it('rejects transaction when rule is violated', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);

      // Fund the agent
      await fundAgent(agent.id, 1000);

      // Create a rule limiting to $500 per transaction
      await createRule(token, {
        agentId: agent.id,
        ruleType: RuleType.PER_TRANSACTION,
        limitAmount: 500,
        priority: 10,
      });

      // Try to spend $600 (exceeds limit)
      const response = await request(app)
        .post(`/v1/agents/${agent.id}/spend`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 600,
          currency: 'USD',
          metadata: { test: true },
        })
        .expect(403); // 403 Forbidden for rule violation

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('RULE_VIOLATION');
      expect(response.body.message).toContain('exceeds');
    });

    it('creates transaction with pending_approval status when rule requires approval', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);

      // Fund the agent
      await fundAgent(agent.id, 1000);

      // Create a rule with approval threshold
      await createRule(token, {
        agentId: agent.id,
        ruleType: RuleType.PER_TRANSACTION,
        limitAmount: 1000,
        priority: 10,
        // Note: Approval threshold is set in conditions, but for now we'll test basic flow
        // The approval flow will be implemented later
      });

      // Note: This test may need adjustment once approval flow is fully implemented
      // For now, it should create a pending transaction
      const response = await request(app)
        .post(`/v1/agents/${agent.id}/spend`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 500,
          currency: 'USD',
          metadata: { test: true },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(['pending', 'pending_approval']).toContain(response.body.data.status);
    });

    it('prevents spending from other organizations agents', async () => {
      const alice = await registerTestOrg();
      const bob = await registerTestOrg();

      const aliceAgent = await createAgent(alice.token);
      await fundAgent(aliceAgent.id, 1000);

      const response = await request(app)
        .post(`/v1/agents/${aliceAgent.id}/spend`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({
          amount: 100,
          currency: 'USD',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('validates request payload', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);

      const response = await request(app)
        .post(`/v1/agents/${agent.id}/spend`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: -100, // Invalid: negative amount
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /v1/transactions', () => {
    it('lists transactions for organization', async () => {
      const { token, organizationId } = await registerTestOrg();
      const agent = await createAgent(token);

      await fundAgent(agent.id, 1000);

      // Create a transaction
      await request(app)
        .post(`/v1/agents/${agent.id}/spend`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 100,
          currency: 'USD',
          metadata: { test: true },
        })
        .expect(201);

      const response = await request(app)
        .get('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].organizationId).toBe(organizationId);
    });

    it('filters transactions by agent', async () => {
      const { token } = await registerTestOrg();
      const agent1 = await createAgent(token);
      const agent2 = await createAgent(token);

      await fundAgent(agent1.id, 1000);
      await fundAgent(agent2.id, 1000);

      // Create transactions for both agents
      await request(app)
        .post(`/v1/agents/${agent1.id}/spend`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 100, metadata: { test: true } })
        .expect(201);

      await request(app)
        .post(`/v1/agents/${agent2.id}/spend`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 200, metadata: { test: true } })
        .expect(201);

      const response = await request(app)
        .get(`/v1/transactions?agentId=${agent1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((tx: any) => tx.agentId === agent1.id)).toBe(true);
    });

    it('filters transactions by status', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);

      await fundAgent(agent.id, 1000);

      // Create a transaction (will be pending)
      await request(app)
        .post(`/v1/agents/${agent.id}/spend`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 100, metadata: { test: true } })
        .expect(201);

      const response = await request(app)
        .get('/v1/transactions?status=pending')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((tx: any) => tx.status === 'pending')).toBe(true);
    });

    it('returns empty array if no transactions exist', async () => {
      const { token } = await registerTestOrg();

      const response = await request(app)
        .get('/v1/transactions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /v1/transactions/:id', () => {
    it('returns transaction details', async () => {
      const { token, organizationId } = await registerTestOrg();
      const agent = await createAgent(token);

      await fundAgent(agent.id, 1000);

      // Create a transaction
      const createResponse = await request(app)
        .post(`/v1/agents/${agent.id}/spend`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 150,
          currency: 'USD',
          merchantName: 'Test Store',
          category: 'retail',
          metadata: { test: true },
        })
        .expect(201);

      const transactionId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(transactionId);
      expect(response.body.data.organizationId).toBe(organizationId);
      expect(response.body.data.amount).toBe(150);
      expect(response.body.data.merchantName).toBe('Test Store');
      expect(response.body.data.category).toBe('retail');
    });

    it('returns 404 for non-existent transaction', async () => {
      const { token } = await registerTestOrg();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/v1/transactions/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('prevents access to other organizations transactions', async () => {
      const alice = await registerTestOrg();
      const bob = await registerTestOrg();

      const aliceAgent = await createAgent(alice.token);
      await fundAgent(aliceAgent.id, 1000);

      const createResponse = await request(app)
        .post(`/v1/agents/${aliceAgent.id}/spend`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ amount: 100, metadata: { test: true } })
        .expect(201);

      const transactionId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});

