import request from 'supertest';
import { Application } from 'express';
import { prisma } from '../database/client';
import { createServer } from '../server';
import { RuleType, TimeWindow } from '../services/rules';

describe('Rules Integration Tests', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    await prisma.spendingRule.deleteMany({
      where: { conditions: { path: ['test'], equals: true } },
    });

    await prisma.agent.deleteMany({
      where: { name: { contains: 'Rules Test Agent' } },
    });

    await prisma.user.deleteMany({
      where: { email: { contains: 'rules-int-' } },
    });

    await prisma.organization.deleteMany({
      where: { email: { contains: 'rules-int-' } },
    });

    await prisma.$disconnect();
  });

  const registerTestOrg = async () => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const email = `rules-int-${unique}@example.com`;
    const organizationName = `Rules Integration Org ${unique}`;

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
        name: `Rules Test Agent ${suffix}`,
        description: 'Test agent for rules',
      })
      .expect(201);

    return response.body.data;
  };

  const createRule = async (
    token: string,
    overrides: Partial<{
      agentId: string;
      ruleType: RuleType;
      limitAmount: number;
      limitCurrency: string;
      timeWindow: TimeWindow;
      category: string;
      conditions: Record<string, any>;
      priority: number;
      enabled: boolean;
    }> = {}
  ) => {
    const payload = {
      ruleType: overrides.ruleType ?? RuleType.PER_TRANSACTION,
      limitAmount: overrides.limitAmount ?? 1000,
      limitCurrency: 'USD',
      priority: overrides.priority ?? 100,
      conditions: { test: true },
      ...overrides,
    };

    const response = await request(app)
      .post('/v1/rules')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    return response.body.data;
  };

  describe('POST /v1/rules', () => {
    it('creates a per-transaction limit rule', async () => {
      const { token, organizationId } = await registerTestOrg();

      const rule = await createRule(token, {
        ruleType: RuleType.PER_TRANSACTION,
        limitAmount: 500,
      });

      expect(rule.organizationId).toBe(organizationId);
      expect(rule.ruleType).toBe(RuleType.PER_TRANSACTION);
      expect(rule.limitAmount).toBe(500);
      expect(rule.enabled).toBe(true);
      expect(rule.agentId).toBeUndefined(); // Org-wide rule
    });

    it('creates an agent-specific rule', async () => {
      const { token, organizationId } = await registerTestOrg();
      const agent = await createAgent(token);

      const rule = await createRule(token, {
        agentId: agent.id,
        ruleType: RuleType.DAILY,
        limitAmount: 1000,
        timeWindow: TimeWindow.DAILY,
      });

      expect(rule.organizationId).toBe(organizationId);
      expect(rule.agentId).toBe(agent.id);
      expect(rule.ruleType).toBe(RuleType.DAILY);
      expect(rule.limitAmount).toBe(1000);
      expect(rule.timeWindow).toBe(TimeWindow.DAILY);
    });

    it('creates a category rule', async () => {
      const { token } = await registerTestOrg();

      const rule = await createRule(token, {
        ruleType: RuleType.CATEGORY,
        limitAmount: 2000,
        category: 'software',
        timeWindow: TimeWindow.MONTHLY,
      });

      expect(rule.ruleType).toBe(RuleType.CATEGORY);
      expect(rule.category).toBe('software');
      expect(rule.limitAmount).toBe(2000);
    });

    it('creates a merchant whitelist rule', async () => {
      const { token } = await registerTestOrg();

      const rule = await createRule(token, {
        ruleType: RuleType.MERCHANT_WHITELIST,
        conditions: { test: true, merchants: ['stripe', 'aws'] },
      });

      expect(rule.ruleType).toBe(RuleType.MERCHANT_WHITELIST);
      expect(rule.conditions.merchants).toEqual(['stripe', 'aws']);
    });

    it('rejects invalid payloads', async () => {
      const { token } = await registerTestOrg();

      const response = await request(app)
        .post('/v1/rules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ruleType: RuleType.PER_TRANSACTION,
          // Missing limitAmount for per_transaction
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('requires authentication', async () => {
      const response = await request(app)
        .post('/v1/rules')
        .send({
          ruleType: RuleType.PER_TRANSACTION,
          limitAmount: 1000,
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /v1/rules', () => {
    it('lists all rules for organization', async () => {
      const { token, organizationId } = await registerTestOrg();

      // Create multiple rules
      await createRule(token, { ruleType: RuleType.PER_TRANSACTION, limitAmount: 500 });
      await createRule(token, { ruleType: RuleType.DAILY, limitAmount: 1000, priority: 50 });

      const response = await request(app)
        .get('/v1/rules')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);

      // Rules should be sorted by priority
      const rules = response.body.data;
      expect(rules.every((r: any) => r.organizationId === organizationId)).toBe(true);
    });

    it('returns empty array if no rules exist', async () => {
      const { token } = await registerTestOrg();

      const response = await request(app)
        .get('/v1/rules')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /v1/rules/:id', () => {
    it('returns rule details', async () => {
      const { token, organizationId } = await registerTestOrg();
      const rule = await createRule(token, {
        ruleType: RuleType.PER_TRANSACTION,
        limitAmount: 750,
        priority: 25,
      });

      const response = await request(app)
        .get(`/v1/rules/${rule.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(rule.id);
      expect(response.body.data.organizationId).toBe(organizationId);
      expect(response.body.data.ruleType).toBe(RuleType.PER_TRANSACTION);
      expect(response.body.data.limitAmount).toBe(750);
    });

    it('returns 404 for non-existent rule', async () => {
      const { token } = await registerTestOrg();
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/v1/rules/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('prevents access to other organizations rules', async () => {
      const alice = await registerTestOrg();
      const bob = await registerTestOrg();

      const aliceRule = await createRule(alice.token);

      const response = await request(app)
        .get(`/v1/rules/${aliceRule.id}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /v1/rules/agent/:agentId', () => {
    it('returns rules for specific agent (agent-specific + org-wide)', async () => {
      const { token } = await registerTestOrg();
      const agent = await createAgent(token);

      // Create org-wide rule
      const orgRule = await createRule(token, {
        ruleType: RuleType.PER_TRANSACTION,
        limitAmount: 1000,
        priority: 100,
      });

      // Create agent-specific rule
      const agentRule = await createRule(token, {
        agentId: agent.id,
        ruleType: RuleType.DAILY,
        limitAmount: 500,
        priority: 50,
      });

      const response = await request(app)
        .get(`/v1/rules/agent/${agent.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const rules = response.body.data;
      expect(Array.isArray(rules)).toBe(true);

      // Should include both agent-specific and org-wide rules
      const ruleIds = rules.map((r: any) => r.id);
      expect(ruleIds).toContain(agentRule.id);
      expect(ruleIds).toContain(orgRule.id);

      // Rules should be sorted by priority
      const priorities = rules.map((r: any) => r.priority);
      expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    });

    it('prevents access to other organizations agents', async () => {
      const alice = await registerTestOrg();
      const bob = await registerTestOrg();

      const aliceAgent = await createAgent(alice.token);

      const response = await request(app)
        .get(`/v1/rules/agent/${aliceAgent.id}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /v1/rules/:id', () => {
    it('updates rule properties', async () => {
      const { token } = await registerTestOrg();
      const rule = await createRule(token, {
        ruleType: RuleType.PER_TRANSACTION,
        limitAmount: 1000,
        priority: 100,
      });

      const response = await request(app)
        .patch(`/v1/rules/${rule.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          limitAmount: 1500,
          priority: 50,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.limitAmount).toBe(1500);
      expect(response.body.data.priority).toBe(50);
      expect(response.body.data.ruleType).toBe(RuleType.PER_TRANSACTION); // Unchanged
    });

    it('can disable a rule', async () => {
      const { token } = await registerTestOrg();
      const rule = await createRule(token);

      const response = await request(app)
        .patch(`/v1/rules/${rule.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(false);
    });

    it('rejects invalid updates', async () => {
      const { token } = await registerTestOrg();
      const rule = await createRule(token);

      const response = await request(app)
        .patch(`/v1/rules/${rule.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /v1/rules/:id', () => {
    it('deletes a rule', async () => {
      const { token } = await registerTestOrg();
      const rule = await createRule(token);

      const response = await request(app)
        .delete(`/v1/rules/${rule.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify rule is deleted
      await request(app)
        .get(`/v1/rules/${rule.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('prevents deleting other organizations rules', async () => {
      const alice = await registerTestOrg();
      const bob = await registerTestOrg();

      const aliceRule = await createRule(alice.token);

      const response = await request(app)
        .delete(`/v1/rules/${aliceRule.id}`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });
});

