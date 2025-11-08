/**
 * Quick test script for Organization Service
 *
 * Run with: npx tsx test-organization.ts
 */

import { container } from './src/services/container';
import { logger } from './src/shared/logger';

async function testOrganizationService() {
  try {
    logger.info('🧪 Testing Organization Service...\n');

    // 1. Create organization
    logger.info('1️⃣ Creating organization...');
    const org = await container.organizationService.createOrganization({
      name: 'Test AI Company',
      email: 'test@example.com',
    });
    logger.info(`✅ Created: ${org.name} (${org.id})\n`);

    // 2. Get organization
    logger.info('2️⃣ Getting organization...');
    const fetchedOrg = await container.organizationService.getOrganization(org.id);
    logger.info(`✅ Fetched: ${fetchedOrg.name}\n`);

    // 3. Update organization
    logger.info('3️⃣ Updating organization...');
    const updatedOrg = await container.organizationService.updateOrganization(org.id, {
      name: 'Updated AI Company',
    });
    logger.info(`✅ Updated: ${updatedOrg.name}\n`);

    // 4. Get stats
    logger.info('4️⃣ Getting organization stats...');
    const stats = await container.organizationService.getOrganizationStats(org.id);
    logger.info(`✅ Stats:`, stats);
    logger.info('');

    // 5. List organizations
    logger.info('5️⃣ Listing all organizations...');
    const orgs = await container.organizationService.listOrganizations({});
    logger.info(`✅ Found ${orgs.length} organizations\n`);

    // 6. Delete organization
    logger.info('6️⃣ Deleting organization...');
    await container.organizationService.deleteOrganization(org.id);
    logger.info(`✅ Deleted organization\n`);

    logger.info('🎉 All tests passed!\n');

    // Test with seed data
    logger.info('📊 Testing with seed data...');
    const seedOrgs = await container.organizationService.listOrganizations({});
    if (seedOrgs.length > 0) {
      logger.info(`Found ${seedOrgs.length} organizations from seed:`);
      seedOrgs.forEach(o => {
        logger.info(`  - ${o.name} (${o.email}) - KYC: ${o.kycStatus}`);
      });
    } else {
      logger.info('No seed data found. Run: npm run db:seed');
    }

  } catch (error) {
    logger.error('❌ Test failed:', error);
    throw error;
  }
}

// Run test
testOrganizationService()
  .then(() => {
    logger.info('\n✅ Organization Service is working!\n');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('\n❌ Organization Service test failed\n');
    console.error(error);
    process.exit(1);
  });

