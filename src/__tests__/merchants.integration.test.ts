/**
 * Merchant Service Integration Tests
 *
 * Tests the complete merchant flow including:
 * - Merchant CRUD operations
 * - Merchant verification
 * - Wallet address validation and normalization
 * - Merchant service integration with blockchain
 */

import request from 'supertest';
import { Application } from 'express';
import { prisma } from '../database/client';
import { createServer } from '../server';
import { container } from '../services/container';
import { MerchantService } from '../services/merchants';

describe('Merchant Integration Tests', () => {
  let app: Application;
  let merchantService: MerchantService;

  beforeAll(async () => {
    app = await createServer();
    merchantService = container.merchantService;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.merchant.deleteMany({
      where: {
        name: {
          contains: 'Test Merchant',
        },
      },
    });

    await prisma.user.deleteMany({
      where: { email: { contains: 'merchant-int-' } },
    });

    await prisma.organization.deleteMany({
      where: { email: { contains: 'merchant-int-' } },
    });

    await prisma.$disconnect();
  });

  const registerTestOrg = async () => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const email = `merchant-int-${unique}@example.com`;
    const organizationName = `Merchant Integration Org ${unique}`;

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

  describe('POST /v1/merchants', () => {
    it('should create a merchant successfully', async () => {
      const { token } = await registerTestOrg();

      const response = await request(app)
        .post('/v1/merchants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Merchant 1',
          category: 'E-commerce',
          walletAddress: '0x4444444444444444444444444444444444444444',
          website: 'https://example.com',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Merchant 1');
      expect(response.body.data.category).toBe('E-commerce');
      expect(response.body.data.walletAddress).toBe('0x4444444444444444444444444444444444444444'); // Normalized
      expect(response.body.data.website).toBe('https://example.com');
      expect(response.body.data.verified).toBe(false);
      expect(response.body.data.reputationScore).toBe(50); // Default
      expect(response.body.data.id).toBeDefined();
    });

    it('should create a merchant with minimal fields', async () => {
      const { token } = await registerTestOrg();

      const response = await request(app)
        .post('/v1/merchants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Merchant 2',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Merchant 2');
      expect(response.body.data.walletAddress).toBeNull();
      expect(response.body.data.category).toBeNull();
      expect(response.body.data.website).toBeNull();
    });

    it('should normalize wallet address to checksummed format', async () => {
      const { token } = await registerTestOrg();

      const response = await request(app)
        .post('/v1/merchants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Merchant 3',
          walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', // Lowercase
        })
        .expect(201);

      // Address should be normalized to checksummed format (exact format depends on viem)
      expect(response.body.data.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(response.body.data.walletAddress).not.toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'); // Should be checksummed
    });

    it('should reject invalid wallet address', async () => {
      const { token } = await registerTestOrg();

      const response = await request(app)
        .post('/v1/merchants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Merchant Invalid',
          walletAddress: 'invalid-address',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      // Validation error message should indicate the issue
    });

    it('should reject duplicate wallet address', async () => {
      const { token } = await registerTestOrg();

      const duplicateAddress = '0x1111111111111111111111111111111111111111';

      // Create first merchant
      await request(app)
        .post('/v1/merchants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Merchant Duplicate 1',
          walletAddress: duplicateAddress,
        })
        .expect(201);

      // Try to create second merchant with same address
      const response = await request(app)
        .post('/v1/merchants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Merchant Duplicate 2',
          walletAddress: duplicateAddress,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already associated');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/v1/merchants')
        .send({
          name: 'Test Merchant',
        })
        .expect(401);
    });

    it('should validate required fields', async () => {
      const { token } = await registerTestOrg();

      const response = await request(app)
        .post('/v1/merchants')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate reputation score range', async () => {
      const { token } = await registerTestOrg();

      const response = await request(app)
        .post('/v1/merchants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Merchant',
          reputationScore: 150, // Invalid: > 100
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /v1/merchants', () => {
    it('should list all merchants', async () => {
      const { token } = await registerTestOrg();

      // Create test merchants
      await merchantService.createMerchant({
        name: 'Test Merchant List 1',
        category: 'E-commerce',
        verified: true,
      });
      await merchantService.createMerchant({
        name: 'Test Merchant List 2',
        category: 'Services',
        verified: false,
      });
      await merchantService.createMerchant({
        name: 'Test Merchant List 3',
        category: 'E-commerce',
        verified: true,
      });

      const response = await request(app)
        .get('/v1/merchants')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by verified status', async () => {
      const { token } = await registerTestOrg();

      await merchantService.createMerchant({
        name: 'Test Merchant Verified',
        verified: true,
      });
      await merchantService.createMerchant({
        name: 'Test Merchant Unverified',
        verified: false,
      });

      const response = await request(app)
        .get('/v1/merchants?verified=true')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((merchant: any) => {
        expect(merchant.verified).toBe(true);
      });
    });

    it('should filter by category', async () => {
      const { token } = await registerTestOrg();

      await merchantService.createMerchant({
        name: 'Test Merchant E-commerce',
        category: 'E-commerce',
      });
      await merchantService.createMerchant({
        name: 'Test Merchant Services',
        category: 'Services',
      });

      const response = await request(app)
        .get('/v1/merchants?category=E-commerce')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach((merchant: any) => {
        expect(merchant.category).toBe('E-commerce');
      });
    });

    it('should search by name', async () => {
      const { token } = await registerTestOrg();

      await merchantService.createMerchant({
        name: 'Test Merchant Search Target',
      });
      await merchantService.createMerchant({
        name: 'Test Merchant Other',
      });

      const response = await request(app)
        .get('/v1/merchants?search=Search Target')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].name).toContain('Search Target');
    });

    it('should require authentication', async () => {
      await request(app).get('/v1/merchants').expect(401);
    });
  });

  describe('GET /v1/merchants/:id', () => {
    it('should get merchant by ID', async () => {
      const { token } = await registerTestOrg();

      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Get',
        category: 'E-commerce',
        walletAddress: '0x2222222222222222222222222222222222222222',
      });

      const response = await request(app)
        .get(`/v1/merchants/${merchant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(merchant.id);
      expect(response.body.data.name).toBe('Test Merchant Get');
    });

    it('should return 404 for non-existent merchant', async () => {
      const { token } = await registerTestOrg();

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/v1/merchants/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Get Auth',
      });

      await request(app).get(`/v1/merchants/${merchant.id}`).expect(401);
    });

    it('should validate UUID format', async () => {
      const { token } = await registerTestOrg();

      const response = await request(app)
        .get('/v1/merchants/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /v1/merchants/:id', () => {
    it('should update merchant', async () => {
      const { token } = await registerTestOrg();

      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Update',
        category: 'E-commerce',
      });

      // Use a unique address based on timestamp to avoid conflicts
      const uniqueAddress = `0x${Date.now().toString(16).padEnd(40, '0').slice(0, 40)}`;

      const response = await request(app)
        .patch(`/v1/merchants/${merchant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Merchant Name',
          category: 'Services',
          walletAddress: uniqueAddress,
          verified: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Merchant Name');
      expect(response.body.data.category).toBe('Services');
      expect(response.body.data.walletAddress).toBe(uniqueAddress);
      expect(response.body.data.verified).toBe(true);
    });

    it('should update partial fields', async () => {
      const { token } = await registerTestOrg();

      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Update Partial',
        category: 'E-commerce',
      });

      const response = await request(app)
        .patch(`/v1/merchants/${merchant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Partially Updated',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Partially Updated');
      // Category should remain unchanged
      expect(response.body.data.category).toBe('E-commerce');
    });

    it('should clear fields when set to null', async () => {
      const { token } = await registerTestOrg();

      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Update Null',
        category: 'E-commerce',
      });

      const response = await request(app)
        .patch(`/v1/merchants/${merchant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          category: null,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBeNull();
    });

    it('should reject invalid wallet address', async () => {
      const { token } = await registerTestOrg();

      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Update Invalid',
      });

      const response = await request(app)
        .patch(`/v1/merchants/${merchant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          walletAddress: 'invalid',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent merchant', async () => {
      const { token } = await registerTestOrg();

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .patch(`/v1/merchants/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Auth',
      });

      await request(app)
        .patch(`/v1/merchants/${merchant.id}`)
        .send({ name: 'Updated' })
        .expect(401);
    });
  });

  describe('DELETE /v1/merchants/:id', () => {
    it('should delete merchant', async () => {
      const { token } = await registerTestOrg();

      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Delete',
      });

      const response = await request(app)
        .delete(`/v1/merchants/${merchant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify merchant is deleted
      const getResponse = await request(app)
        .get(`/v1/merchants/${merchant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(getResponse.body.success).toBe(false);
    });

    it('should return 404 for non-existent merchant', async () => {
      const { token } = await registerTestOrg();

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/v1/merchants/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Delete Auth',
      });

      await request(app).delete(`/v1/merchants/${merchant.id}`).expect(401);
    });
  });

  describe('POST /v1/merchants/:id/verify', () => {
    it('should verify merchant', async () => {
      const { token } = await registerTestOrg();

      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Verify',
        verified: false,
      });

      const response = await request(app)
        .post(`/v1/merchants/${merchant.id}/verify`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verified).toBe(true);
    });

    it('should return 404 for non-existent merchant', async () => {
      const { token } = await registerTestOrg();

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post(`/v1/merchants/${fakeId}/verify`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Verify Auth',
        verified: false,
      });

      await request(app).post(`/v1/merchants/${merchant.id}/verify`).expect(401);
    });
  });

  describe('POST /v1/merchants/:id/unverify', () => {
    it('should unverify merchant', async () => {
      const { token } = await registerTestOrg();

      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Unverify',
        verified: true,
      });

      const response = await request(app)
        .post(`/v1/merchants/${merchant.id}/unverify`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verified).toBe(false);
    });

    it('should return 404 for non-existent merchant', async () => {
      const { token } = await registerTestOrg();

      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post(`/v1/merchants/${fakeId}/unverify`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Unverify Auth',
        verified: true,
      });

      await request(app).post(`/v1/merchants/${merchant.id}/unverify`).expect(401);
    });
  });

  describe('Merchant Service Integration', () => {
    it('should resolve merchant wallet address for payment', async () => {
      const walletAddress = '0x9876543210987654321098765432109876543210';
      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant Payment',
        walletAddress,
      });

      const resolvedAddress = await merchantService.getMerchantWalletAddress(merchant.id);
      expect(resolvedAddress).toBe('0x9876543210987654321098765432109876543210'); // Normalized
    });

    it('should throw error when merchant has no wallet address', async () => {
      const merchant = await merchantService.createMerchant({
        name: 'Test Merchant No Wallet',
      });

      await expect(
        merchantService.getMerchantWalletAddress(merchant.id)
      ).rejects.toThrow('does not have a wallet address configured');
    });
  });
});

