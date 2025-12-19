/**
 * Database Seed Script
 *
 * Populates the database with test data for development.
 */

import { prisma } from './client';
import { logger } from '../shared/logger';
import * as bcrypt from 'bcryptjs';

async function seed() {
  logger.info('🌱 Starting database seed...');

  try {
    // Clean existing data (development only!)
    if (process.env.NODE_ENV === 'development') {
      logger.info('🧹 Cleaning existing data...');
      await prisma.webhookEvent.deleteMany();
      await prisma.webhook.deleteMany();
      await prisma.approvalAction.deleteMany();
      await prisma.approval.deleteMany();
      await prisma.transaction.deleteMany();
      await prisma.spendingRule.deleteMany();
      await prisma.agentBalance.deleteMany();
      await prisma.agent.deleteMany();
      await prisma.ledgerEntry.deleteMany();
      await prisma.merchant.deleteMany();
      await prisma.apiKey.deleteMany();
      await prisma.user.deleteMany();
      await prisma.organization.deleteMany();
      await prisma.auditLog.deleteMany();
    }

    // 1. Create Organizations
    logger.info('📦 Creating organizations...');
    const org1 = await prisma.organization.create({
      data: {
        name: 'Acme AI Labs',
        email: 'contact@acme.ai',
        kycStatus: 'approved',
      },
    });

    const org2 = await prisma.organization.create({
      data: {
        name: 'DataFlow Inc',
        email: 'hello@dataflow.com',
        kycStatus: 'pending',
      },
    });

    logger.info(`✅ Created organizations: ${org1.id}, ${org2.id}`);

    // 2. Create Users
    logger.info('👤 Creating users...');
    const passwordHash = await bcrypt.hash('password123', 10);

    const user1 = await prisma.user.create({
      data: {
        organizationId: org1.id,
        email: 'founder@acme.ai',
        passwordHash,
        role: 'owner',
      },
    });

    const user2 = await prisma.user.create({
      data: {
        organizationId: org1.id,
        email: 'admin@acme.ai',
        passwordHash,
        role: 'admin',
      },
    });

    logger.info(`✅ Created users: ${user1.email}, ${user2.email}`);

    // 3. Create API Keys
    logger.info('🔑 Creating API keys...');
    const apiKey1 = await prisma.apiKey.create({
      data: {
        organizationId: org1.id,
        keyHash: await bcrypt.hash('sk_test_acme_123', 10),
        name: 'Production API Key',
      },
    });

    logger.info(`✅ Created API key: ${apiKey1.id}`);

    // 4. Create Agents
    logger.info('🤖 Creating AI agents...');
    const agent1 = await prisma.agent.create({
      data: {
        organizationId: org1.id,
        name: 'Data Buyer Bot',
        description: 'Autonomously purchases datasets from marketplaces',
        status: 'active',
        metadata: {
          version: '1.0',
          category: 'procurement',
        },
      },
    });

    const agent2 = await prisma.agent.create({
      data: {
        organizationId: org1.id,
        name: 'Ad Campaign Manager',
        description: 'Manages advertising spend across platforms',
        status: 'active',
        metadata: {
          version: '1.0',
          category: 'marketing',
        },
      },
    });

    const agent3 = await prisma.agent.create({
      data: {
        organizationId: org1.id,
        name: 'Cloud Resource Optimizer',
        description: 'Automatically scales and purchases cloud resources',
        status: 'paused',
        metadata: {
          version: '1.0',
          category: 'infrastructure',
        },
      },
    });

    logger.info(`✅ Created agents: ${agent1.name}, ${agent2.name}, ${agent3.name}`);

    // 5. Create Agent Balances
    logger.info('💰 Creating agent balances...');
    await prisma.agentBalance.create({
      data: {
        agentId: agent1.id,
        balanceUsd: 1500.50,
        balanceUsdc: 1500.50,
        pendingUsd: 50.00,
      },
    });

    await prisma.agentBalance.create({
      data: {
        agentId: agent2.id,
        balanceUsd: 5000.00,
        balanceUsdc: 5000.00,
        pendingUsd: 0,
      },
    });

    await prisma.agentBalance.create({
      data: {
        agentId: agent3.id,
        balanceUsd: 250.75,
        balanceUsdc: 250.75,
        pendingUsd: 0,
      },
    });

    logger.info('✅ Created agent balances');

    // 6. Create Spending Rules
    logger.info('📏 Creating spending rules...');

    // Per-transaction limit
    await prisma.spendingRule.create({
      data: {
        organizationId: org1.id,
        agentId: agent1.id,
        ruleType: 'per_transaction',
        limitAmount: 100,
        limitCurrency: 'USD',
        priority: 10,
        enabled: true,
        conditions: {},
      },
    });

    // Daily limit
    await prisma.spendingRule.create({
      data: {
        organizationId: org1.id,
        agentId: agent1.id,
        ruleType: 'daily',
        limitAmount: 500,
        limitCurrency: 'USD',
        timeWindow: 'daily',
        priority: 20,
        enabled: true,
        conditions: {},
      },
    });

    // Category limit (advertising)
    await prisma.spendingRule.create({
      data: {
        organizationId: org1.id,
        agentId: agent2.id,
        ruleType: 'category',
        category: 'advertising',
        limitAmount: 10000,
        limitCurrency: 'USD',
        timeWindow: 'monthly',
        priority: 30,
        enabled: true,
        conditions: {},
      },
    });

    // Org-wide velocity rule
    await prisma.spendingRule.create({
      data: {
        organizationId: org1.id,
        agentId: null, // Org-wide
        ruleType: 'velocity',
        priority: 100,
        enabled: true,
        conditions: {
          maxTransactions: 10,
          timeWindowMinutes: 60,
        },
      },
    });

    logger.info('✅ Created spending rules');

    // 7. Create Merchants
    logger.info('🏪 Creating merchants...');
    const merchant1 = await prisma.merchant.create({
      data: {
        name: 'Data Marketplace Inc',
        category: 'data',
        website: 'https://datamarket.example.com',
        verified: true,
        reputationScore: 85,
      },
    });

    const merchant2 = await prisma.merchant.create({
      data: {
        name: 'Google Ads',
        category: 'advertising',
        website: 'https://ads.google.com',
        verified: true,
        reputationScore: 95,
      },
    });

    const merchant3 = await prisma.merchant.create({
      data: {
        name: 'AWS Marketplace',
        category: 'cloud',
        website: 'https://aws.amazon.com',
        verified: true,
        reputationScore: 100,
      },
    });

    logger.info(`✅ Created merchants: ${merchant1.name}, ${merchant2.name}, ${merchant3.name}`);

    // 8. Create Sample Transactions
    logger.info('💳 Creating sample transactions...');

    await prisma.transaction.create({
      data: {
        organizationId: org1.id,
        agentId: agent1.id,
        amount: 50.00,
        currency: 'USD',
        merchantId: merchant1.id,
        merchantName: merchant1.name,
        category: 'data',
        status: 'completed',
        paymentMethod: 'onchain',
        blockchainTxHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        blockchainNetwork: 'base-mainnet',
        requiresApproval: false,
        metadata: {
          dataset: 'climate-data-2025',
          size_mb: 1024,
        },
        completedAt: new Date(),
      },
    });

    await prisma.transaction.create({
      data: {
        organizationId: org1.id,
        agentId: agent2.id,
        amount: 250.00,
        currency: 'USD',
        merchantId: merchant2.id,
        merchantName: merchant2.name,
        category: 'advertising',
        status: 'completed',
        paymentMethod: 'card',
        requiresApproval: false,
        metadata: {
          campaign_id: 'campaign_123',
          platform: 'google_ads',
        },
        completedAt: new Date(),
      },
    });

    await prisma.transaction.create({
      data: {
        organizationId: org1.id,
        agentId: agent1.id,
        amount: 75.00,
        currency: 'USD',
        merchantId: merchant1.id,
        merchantName: merchant1.name,
        category: 'data',
        status: 'pending',
        paymentMethod: 'onchain',
        requiresApproval: false,
        metadata: {},
      },
    });

    logger.info('✅ Created sample transactions');

    // 9. Create Ledger Entries
    logger.info('📒 Creating ledger entries...');

    // Agent 1 deposit
    await prisma.ledgerEntry.create({
      data: {
        account: `agent:${agent1.id}`,
        debit: 0,
        credit: 1500,
        balance: 1500,
        currency: 'USD',
        description: 'Initial deposit',
      },
    });

    // Agent 1 spent $50
    await prisma.ledgerEntry.create({
      data: {
        account: `agent:${agent1.id}`,
        debit: 50,
        credit: 0,
        balance: 1450,
        currency: 'USD',
        description: `Payment to ${merchant1.name}`,
      },
    });

    logger.info('✅ Created ledger entries');

    // 10. Create Webhooks
    logger.info('🪝 Creating webhooks...');

    await prisma.webhook.create({
      data: {
        organizationId: org1.id,
        url: 'https://acme.ai/webhooks/auton',
        events: ['transaction.completed', 'transaction.failed', 'balance.low'],
        secret: 'whsec_test_secret_123',
        enabled: true,
      },
    });

    logger.info('✅ Created webhooks');

    logger.info('🎉 Database seeding completed successfully!');
    logger.info('');
    logger.info('📊 Summary:');
    logger.info(`  - Organizations: 2`);
    logger.info(`  - Users: 2`);
    logger.info(`  - Agents: 3`);
    logger.info(`  - Spending Rules: 4`);
    logger.info(`  - Merchants: 3`);
    logger.info(`  - Transactions: 3`);
    logger.info('');
    logger.info('🔐 Test Credentials:');
    logger.info(`  Email: founder@acme.ai`);
    logger.info(`  Password: password123`);

  } catch (error) {
    logger.error({ err: error }, '❌ Seed failed');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed
seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

