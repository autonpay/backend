import request from 'supertest';
import { Application } from 'express';
import { prisma } from '../database/client';
import { createServer } from '../server';

describe('Agent Integration Tests', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    await prisma.agent.deleteMany({
      where: { name: { contains: 'Agent Int Test' } },
    });

    await prisma.user.deleteMany({
      where: { email: { contains: 'agent-int-' } },
    });

    await prisma.organization.deleteMany({
      where: { email: { contains: 'agent-int-' } },
    });

    await prisma.$disconnect();
  });

  const registerTestOrg = async () => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const email = `agent-int-${unique}@example.com`;
    const organizationName = `Agent Integration Org ${unique}`;

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
      organizationEmail: response.body.data.organization.email as string,
    };
  };

  const createAgent = async (
    token: string,
    overrides: Partial<{ name: string; description: string; metadata: Record<string, unknown> }> = {}
  ) => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    const payload = {
      name: overrides.name ?? `Agent Int Test ${suffix}`,
      description: overrides.description ?? 'Integration test agent',
      metadata: overrides.metadata ?? { kind: 'test-agent' },
    };

    const response = await request(app)
      .post('/v1/agents')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);

    return {
      agent: response.body.data,
      payload,
    };
  };

  describe('POST /v1/agents', () => {
    it('creates a new agent for the organization', async () => {
      const { token, organizationId } = await registerTestOrg();

      const { agent, payload } = await createAgent(token);

      expect(agent.organizationId).toBe(organizationId);
      expect(agent.name).toBe(payload.name);
      expect(agent.metadata).toMatchObject(payload.metadata);
      expect(agent.status).toBe('active');
    });

    it('rejects invalid payloads', async () => {
      const { token } = await registerTestOrg();

      const response = await request(app)
        .post('/v1/agents')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('BAD_REQUEST');
    });
  });

  describe('GET /v1/agents', () => {
    it('lists agents belonging to the organization', async () => {
      const { token } = await registerTestOrg();

      const { agent: first } = await createAgent(token);
      const { agent: second } = await createAgent(token);

      const response = await request(app)
        .get('/v1/agents')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const agentIds = response.body.data.map((agent: { id: string }) => agent.id);
      expect(agentIds).toEqual(expect.arrayContaining([first.id, second.id]));
    });
  });

  describe('GET /v1/agents/:id', () => {
    it('retrieves agent details for the owning organization', async () => {
      const { token } = await registerTestOrg();
      const { agent } = await createAgent(token);

      const response = await request(app)
        .get(`/v1/agents/${agent.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(agent.id);
      expect(response.body.data.name).toBe(agent.name);
    });

    it('blocks access from a different organization', async () => {
      const owner = await registerTestOrg();
      const other = await registerTestOrg();

      const { agent } = await createAgent(owner.token);

      const response = await request(app)
        .get(`/v1/agents/${agent.id}`)
        .set('Authorization', `Bearer ${other.token}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /v1/agents/:id', () => {
    it('updates agent fields', async () => {
      const { token } = await registerTestOrg();
      const { agent } = await createAgent(token);

      const updatedName = `Agent Int Test Updated ${Date.now()}`;
      const response = await request(app)
        .patch(`/v1/agents/${agent.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: updatedName,
          status: 'paused',
          metadata: { updated: true },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updatedName);
      expect(response.body.data.status).toBe('paused');
      expect(response.body.data.metadata).toMatchObject({ updated: true });
    });

    it('enforces org ownership on update', async () => {
      const owner = await registerTestOrg();
      const other = await registerTestOrg();
      const { agent } = await createAgent(owner.token);

      const response = await request(app)
        .patch(`/v1/agents/${agent.id}`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ name: 'Should Fail' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /v1/agents/:id', () => {
    it('soft deletes the agent', async () => {
      const { token } = await registerTestOrg();
      const { agent } = await createAgent(token);

      const response = await request(app)
        .delete(`/v1/agents/${agent.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      const fetchResponse = await request(app)
        .get(`/v1/agents/${agent.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(fetchResponse.body.data.status).toBe('deleted');
    });
  });

  describe('GET /v1/agents/:id/balance', () => {
    it('returns the agent balance summary', async () => {
      const { token } = await registerTestOrg();
      const { agent } = await createAgent(token);

      const response = await request(app)
        .get(`/v1/agents/${agent.id}/balance`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.agentId).toBe(agent.id);
      expect(response.body.data).toHaveProperty('available');
      expect(response.body.data).toHaveProperty('pending');
    });
  });

  describe('POST /v1/agents/:id/deposit', () => {
    it('deposits funds to agent and updates balance', async () => {
      const { token } = await registerTestOrg();
      const { agent } = await createAgent(token);

      // Initial balance should be 0
      const initialBalance = await request(app)
        .get(`/v1/agents/${agent.id}/balance`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(initialBalance.body.data.available).toBe(0);

      // Deposit funds
      const depositResponse = await request(app)
        .post(`/v1/agents/${agent.id}/deposit`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 500,
          description: 'Test deposit',
        })
        .expect(200);

      expect(depositResponse.body.success).toBe(true);
      expect(depositResponse.body.data.available).toBe(500);
      expect(depositResponse.body.message).toContain('500');
    });

    it('allows multiple deposits and accumulates balance', async () => {
      const { token } = await registerTestOrg();
      const { agent } = await createAgent(token);

      // First deposit
      await request(app)
        .post(`/v1/agents/${agent.id}/deposit`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 100 })
        .expect(200);

      // Second deposit
      const response = await request(app)
        .post(`/v1/agents/${agent.id}/deposit`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 250 })
        .expect(200);

      expect(response.body.data.available).toBe(350);
    });

    it('rejects deposit with invalid amount', async () => {
      const { token } = await registerTestOrg();
      const { agent } = await createAgent(token);

      // Negative amount
      const negativeResponse = await request(app)
        .post(`/v1/agents/${agent.id}/deposit`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: -100 })
        .expect(400);

      expect(negativeResponse.body.success).toBe(false);
      expect(negativeResponse.body.error).toBe('BAD_REQUEST');

      // Zero amount
      const zeroResponse = await request(app)
        .post(`/v1/agents/${agent.id}/deposit`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 0 })
        .expect(400);

      expect(zeroResponse.body.success).toBe(false);
    });

    it('rejects deposit without amount', async () => {
      const { token } = await registerTestOrg();
      const { agent } = await createAgent(token);

      const response = await request(app)
        .post(`/v1/agents/${agent.id}/deposit`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('blocks deposit from different organization', async () => {
      const owner = await registerTestOrg();
      const other = await registerTestOrg();
      const { agent } = await createAgent(owner.token);

      const response = await request(app)
        .post(`/v1/agents/${agent.id}/deposit`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({ amount: 100 })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('requires authentication', async () => {
      const { token } = await registerTestOrg();
      const { agent } = await createAgent(token);

      const response = await request(app)
        .post(`/v1/agents/${agent.id}/deposit`)
        .send({ amount: 100 })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});

