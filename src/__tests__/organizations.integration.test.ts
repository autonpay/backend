import request from 'supertest';
import { Application } from 'express';
import { prisma } from '../database/client';
import { createServer } from '../server';

describe('Organization Integration Tests', () => {
  let app: Application;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'org-int-' },
      },
    });

    await prisma.organization.deleteMany({
      where: {
        email: { contains: 'org-int-' },
      },
    });

    await prisma.$disconnect();
  });

  const registerTestOrganization = async () => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const email = `org-int-${unique}@example.com`;
    const organizationName = `Org Integration Test ${unique}`;

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
      organizationName: response.body.data.organization.name as string,
      organizationEmail: response.body.data.organization.email as string,
      ownerEmail: response.body.data.user.email as string,
    };
  };

  describe('GET /v1/organizations/:id', () => {
    it('returns organization details for the owner', async () => {
      const { token, organizationId, organizationName, organizationEmail } =
        await registerTestOrganization();

      const response = await request(app)
        .get(`/v1/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(organizationId);
      expect(response.body.data.name).toBe(organizationName);
      expect(response.body.data.email).toBe(organizationEmail);
    });

    it('requires authentication', async () => {
      const { organizationId } = await registerTestOrganization();

      const response = await request(app)
        .get(`/v1/organizations/${organizationId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('prevents access to other organizations', async () => {
      const alice = await registerTestOrganization();
      const bob = await registerTestOrganization();

      const response = await request(app)
        .get(`/v1/organizations/${bob.organizationId}`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /v1/organizations/:id', () => {
    it('allows an owner to update name and email', async () => {
      const { token, organizationId } = await registerTestOrganization();
      const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const updatedName = `Updated Org ${suffix}`;
      const updatedEmail = `org-int-updated-${suffix}@example.com`;

      const response = await request(app)
        .patch(`/v1/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: updatedName,
          email: updatedEmail,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updatedName);
      expect(response.body.data.email).toBe(updatedEmail);
    });

    it('validates that at least one field is provided', async () => {
      const { token, organizationId } = await registerTestOrganization();

      const response = await request(app)
        .patch(`/v1/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('BAD_REQUEST');
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /v1/organizations/:id/users', () => {
    it('returns the users within the organization', async () => {
      const { token, organizationId, ownerEmail } = await registerTestOrganization();

      const response = await request(app)
        .get(`/v1/organizations/${organizationId}/users`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(
        response.body.data.some((user: { email: string }) => user.email === ownerEmail)
      ).toBe(true);
    });
  });
});

