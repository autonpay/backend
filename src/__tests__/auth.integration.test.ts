/**
 * Auth Integration Tests
 *
 * Tests the complete auth flow including:
 * - User registration
 * - User login
 * - JWT authentication
 * - API key generation and validation
 * - Password management
 */

import request from 'supertest';
import { createServer } from '../server';
import { Application } from 'express';
import { prisma } from '../database/client';

describe('Auth Integration Tests', () => {
  let app: Application;
  let authToken: string;
  let organizationId: string;
  let userId: string;
  let apiKeyValue: string;

  beforeAll(async () => {
    app = await createServer();
  });

  afterAll(async () => {
    // Clean up test data
    if (userId) {
      await prisma.user.deleteMany({
        where: { email: { contains: 'test-auth-' } },
      });
    }
    if (organizationId) {
      await prisma.organization.deleteMany({
        where: { email: { contains: 'test-auth-' } },
      });
    }
    await prisma.$disconnect();
  });

  describe('POST /v1/auth/register', () => {
    it('should register a new user and create organization', async () => {
      const timestamp = Date.now();
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          email: `test-auth-${timestamp}@example.com`,
          password: 'SecurePass123',
          organizationName: `Test Auth Org ${timestamp}`,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user).toHaveProperty('email');
      expect(response.body.data.user.role).toBe('owner');
      expect(response.body.data.organization).toHaveProperty('id');
      expect(response.body.data.organization.name).toBe(`Test Auth Org ${timestamp}`);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.message).toBe('Account created successfully');

      // Save for other tests
      authToken = response.body.data.token;
      organizationId = response.body.data.organization.id;
      userId = response.body.data.user.id;
    });

    it('should fail with weak password', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
          organizationName: 'Test Org',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('BAD_REQUEST');
      expect(response.body.message).toBe('Validation failed');
      expect(
        response.body.details?.details?.some((detail: any) =>
          detail.message.toLowerCase().includes('password')
        )
      ).toBe(true);
    });

    it('should fail with invalid email', async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123',
          organizationName: 'Test Org',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with duplicate email', async () => {
      const timestamp = Date.now();
      const email = `test-dup-${timestamp}@example.com`;

      // First registration
      await request(app)
        .post('/v1/auth/register')
        .send({
          email,
          password: 'SecurePass123',
          organizationName: 'Test Org 1',
        })
        .expect(201);

      // Duplicate registration
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          email,
          password: 'SecurePass123',
          organizationName: 'Test Org 2',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('CONFLICT');
    });
  });

  describe('POST /v1/auth/login', () => {
    const testEmail = `test-login-${Date.now()}@example.com`;
    const testPassword = 'SecurePass123';

    beforeAll(async () => {
      // Create a user for login tests
      await request(app)
        .post('/v1/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          organizationName: `Test Login Org ${Date.now()}`,
        });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/v1/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe(testEmail);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.message).toBe('Login successful');
    });

    it('should fail with invalid password', async () => {
      const response = await request(app)
        .post('/v1/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should fail with non-existent email', async () => {
      const response = await request(app)
        .post('/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePass123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should fail with missing credentials', async () => {
      await request(app)
        .post('/v1/auth/login')
        .send({
          email: testEmail,
        })
        .expect(400);
    });
  });

  describe('GET /v1/auth/me', () => {
    it('should get current user with valid token', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data.organizationId).toBe(organizationId);
    });

    it('should fail without token', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /v1/auth/change-password', () => {
    const testEmail = `test-password-${Date.now()}@example.com`;
    const oldPassword = 'OldPassword123';
    const newPassword = 'NewPassword456';
    let token: string;

    beforeAll(async () => {
      const response = await request(app)
        .post('/v1/auth/register')
        .send({
          email: testEmail,
          password: oldPassword,
          organizationName: `Test Password Org ${Date.now()}`,
        });
      token = response.body.data.token;
    });

    it('should change password with valid credentials', async () => {
      const response = await request(app)
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: oldPassword,
          newPassword: newPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/v1/auth/login')
        .send({
          email: testEmail,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should fail with incorrect current password', async () => {
      const response = await request(app)
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPassword123',
          newPassword: 'NewPassword789',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Current password is incorrect');
    });

    it('should fail with weak new password', async () => {
      const response = await request(app)
        .post('/v1/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: newPassword,
          newPassword: 'weak',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      const detailMessages = response.body.details?.details?.map((detail: any) => detail.message ?? '') ?? [];
      expect(detailMessages.some((message: string) => message.toLowerCase().includes('password'))).toBe(true);
    });
  });

  describe('API Key Management', () => {
    describe('POST /v1/auth/api-keys', () => {
      it('should generate a live API key', async () => {
        const response = await request(app)
          .post('/v1/auth/api-keys')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Live Key',
            prefix: 'live',
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('key');
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data.key).toMatch(/^sk_live_/);
        expect(response.body.data.environment).toBe('live');
        expect(response.body.message).toContain('Save it now');

        // Save for validation test
        apiKeyValue = response.body.data.key;
      });

      it('should generate a test API key', async () => {
        const response = await request(app)
          .post('/v1/auth/api-keys')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test API Key',
            prefix: 'test',
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.key).toMatch(/^sk_test_/);
        expect(response.body.data.environment).toBe('test');
      });

      it('should fail without authentication', async () => {
        const response = await request(app)
          .post('/v1/auth/api-keys')
          .send({
            name: 'Test Key',
          })
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /v1/auth/api-keys', () => {
      it('should list all API keys for organization', async () => {
        const response = await request(app)
          .get('/v1/auth/api-keys')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0]).toHaveProperty('id');
        expect(response.body.data[0]).toHaveProperty('name');
        expect(response.body.data[0]).toHaveProperty('environment');
        expect(response.body.data[0]).toHaveProperty('createdAt');
      });

      it('should fail without authentication', async () => {
        await request(app)
          .get('/v1/auth/api-keys')
          .expect(401);
      });
    });

    describe('API Key Authentication', () => {
      it('should authenticate with valid API key', async () => {
        const response = await request(app)
          .get('/v1/auth/me')
          .set('Authorization', apiKeyValue)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.organizationId).toBe(organizationId);
      });

      it('should fail with invalid API key', async () => {
        const response = await request(app)
          .get('/v1/auth/me')
          .set('Authorization', 'sk_live_invalid_key_123')
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /v1/auth/api-keys/:id', () => {
      let keyIdToDelete: string;

      beforeAll(async () => {
        const response = await request(app)
          .post('/v1/auth/api-keys')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Key to Delete',
            prefix: 'test',
          });
        keyIdToDelete = response.body.data.id;
      });

      it('should revoke an API key', async () => {
        const response = await request(app)
          .delete(`/v1/auth/api-keys/${keyIdToDelete}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('API key revoked successfully');

        // Verify key is deleted
        const listResponse = await request(app)
          .get('/v1/auth/api-keys')
          .set('Authorization', `Bearer ${authToken}`);

        const deletedKey = listResponse.body.data.find((k: any) => k.id === keyIdToDelete);
        expect(deletedKey).toBeUndefined();
      });

      it('should fail to revoke non-existent key', async () => {
        const response = await request(app)
          .delete('/v1/auth/api-keys/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(500);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('JWT Token Validation', () => {
    it('should validate JWT structure', async () => {
      const response = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // JWT should have 3 parts separated by dots
      const parts = authToken.split('.');
      expect(parts.length).toBe(3);
    });

    it('should fail with expired token', async () => {
      // This would require mocking time or using a very short expiry
      // For now, we just test with a malformed token
      const response = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.structure')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Auth Flow Integration', () => {
    it('should complete full auth flow: register -> login -> access protected route', async () => {
      const timestamp = Date.now();
      const email = `test-flow-${timestamp}@example.com`;
      const password = 'FlowTest123';

      // 1. Register
      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send({
          email,
          password,
          organizationName: `Flow Test Org ${timestamp}`,
        })
        .expect(201);

      const { token: registerToken } = registerResponse.body.data;

      // 2. Access protected route with registration token
      const meResponse1 = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${registerToken}`)
        .expect(200);

      expect(meResponse1.body.data.email).toBe(email);

      // 3. Login
      const loginResponse = await request(app)
        .post('/v1/auth/login')
        .send({ email, password })
        .expect(200);

      const { token: loginToken } = loginResponse.body.data;

      // 4. Access protected route with login token
      const meResponse2 = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${loginToken}`)
        .expect(200);

      expect(meResponse2.body.data.email).toBe(email);

      // 5. Generate API key
      const apiKeyResponse = await request(app)
        .post('/v1/auth/api-keys')
        .set('Authorization', `Bearer ${loginToken}`)
        .send({ name: 'Flow Test Key', prefix: 'test' })
        .expect(201);

      const { key: apiKey } = apiKeyResponse.body.data;

      // 6. Access protected route with API key
      const meResponse3 = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', apiKey)
        .expect(200);

      expect(meResponse3.body.data.organizationId).toBe(
        registerResponse.body.data.organization.id
      );
    });
  });
});

