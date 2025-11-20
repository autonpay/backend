import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Auton API',
    version: '1.0.0',
    description: 'API documentation for Auton - Autonomous AI Agent Spend Management Platform',
    contact: {
      name: 'Auton Team',
      email: 'support@auton.dev',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: 'https://api.auton.dev',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT authentication for dashboard users',
      },
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key authentication for programmatic access',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          error: {
            type: 'string',
            example: 'VALIDATION_ERROR',
          },
          message: {
            type: 'string',
            example: 'Request validation failed',
          },
          details: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          email: {
            type: 'string',
            format: 'email',
          },
          organizationId: {
            type: 'string',
            format: 'uuid',
          },
          role: {
            type: 'string',
            enum: ['owner', 'admin', 'member'],
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Organization: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
          },
          slug: {
            type: 'string',
          },
          settings: {
            type: 'object',
            additionalProperties: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Agent: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
          },
          description: {
            type: 'string',
            nullable: true,
          },
          organizationId: {
            type: 'string',
            format: 'uuid',
          },
          type: {
            type: 'string',
            enum: ['autonomous', 'semi_autonomous', 'human_in_loop'],
          },
          status: {
            type: 'string',
            enum: ['active', 'paused', 'suspended'],
          },
          config: {
            type: 'object',
            additionalProperties: true,
          },
          deletedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      AgentBalance: {
        type: 'object',
        properties: {
          agentId: {
            type: 'string',
            format: 'uuid',
          },
          balance: {
            type: 'string',
            description: 'Decimal balance as string',
          },
          currency: {
            type: 'string',
            example: 'USD',
          },
        },
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          name: {
            type: 'string',
          },
          key: {
            type: 'string',
            description: 'Full key only returned on creation',
          },
          keyPrefix: {
            type: 'string',
            description: 'First 8 characters for identification',
          },
          environment: {
            type: 'string',
            enum: ['live', 'test'],
          },
          lastUsedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      SpendingRule: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          organizationId: {
            type: 'string',
            format: 'uuid',
          },
          agentId: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'null for org-wide rules',
          },
          ruleType: {
            type: 'string',
            enum: ['per_transaction', 'daily', 'weekly', 'monthly', 'category', 'velocity', 'merchant_whitelist', 'merchant_blacklist'],
          },
          limitAmount: {
            type: 'number',
            nullable: true,
          },
          limitCurrency: {
            type: 'string',
            example: 'USD',
          },
          timeWindow: {
            type: 'string',
            enum: ['hourly', 'daily', 'weekly', 'monthly'],
            nullable: true,
          },
          category: {
            type: 'string',
            nullable: true,
          },
          conditions: {
            type: 'object',
            additionalProperties: true,
          },
          priority: {
            type: 'number',
            description: 'Lower number = higher priority',
          },
          enabled: {
            type: 'boolean',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Auth',
      description: 'Authentication and authorization endpoints',
    },
    {
      name: 'Organizations',
      description: 'Organization management',
    },
    {
      name: 'Users',
      description: 'User management',
    },
    {
      name: 'Agents',
      description: 'AI agent lifecycle and management',
    },
    {
      name: 'Rules',
      description: 'Spending rules and limits management',
    },
    {
      name: 'Dashboard',
      description: 'Dashboard analytics and overview',
    },
  ],
};

const options = {
  definition: swaggerDefinition,
  apis: [
    './src/api/routes/*.ts',
    './src/api/routes/*.js',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

