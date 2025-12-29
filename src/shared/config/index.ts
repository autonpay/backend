export const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiry: process.env.JWT_EXPIRY || '7d',
  },

  // Blockchain
  blockchain: {
    baseRpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    baseSepoliaRpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    chainId: parseInt(process.env.BASE_CHAIN_ID || '8453', 10),
    walletPrivateKey: process.env.WALLET_PRIVATE_KEY || '',
    agentWalletFactoryAddress: process.env.AGENT_WALLET_FACTORY_ADDRESS || '',
    spendingRulesAddress: process.env.SPENDING_RULES_ADDRESS || '',
    // Test token address for development/testing (deploy your own ERC20 token)
    testTokenAddress: process.env.TEST_TOKEN_ADDRESS || '',
    // Skip blockchain operations (for testing without blockchain setup)
    // Set SKIP_BLOCKCHAIN=true in .env to skip blockchain, or it will auto-skip in development/test
    skipBlockchain: process.env.SKIP_BLOCKCHAIN === 'true' ||
      ['development', 'test'].includes(process.env.NODE_ENV || 'development'),
  },

  // x402
  x402: {
    apiKey: process.env.X402_API_KEY || '',
    network: process.env.X402_NETWORK || 'testnet',
  },

  // Third-party services
  services: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    flutterwaveSecretKey: process.env.FLUTTERWAVE_SECRET_KEY || '',
    personaApiKey: process.env.PERSONA_API_KEY || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
  },

  // Webhooks
  webhooks: {
    signingSecret: process.env.WEBHOOK_SIGNING_SECRET || 'whsec_change_me',
  },

  // Monitoring
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN || '',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Email
  email: {
    fromEmail: process.env.FROM_EMAIL || 'noreply@auton.money',
  },
} as const;

// Validate critical config
export function validateConfig() {
  const errors: string[] = [];

  if (!config.databaseUrl) {
    errors.push('DATABASE_URL is required');
  }

  if (config.env === 'production') {
    if (config.jwt.secret === 'change-me-in-production') {
      errors.push('JWT_SECRET must be set in production');
    }

    if (!config.blockchain.walletPrivateKey) {
      errors.push('WALLET_PRIVATE_KEY is required in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}

