# Auton Backend

AI Agent Payment Orchestration Platform - Backend API

## 🏗️ Architecture

This is a **modular monolith** designed for easy extraction into microservices.

### Service Boundaries

Each service is self-contained with:
- Own business logic
- Own data access
- Own types/interfaces
- Clear public API
- No direct imports between services (use dependency injection)

```
/services
  /agents          → Agent management
  /rules           → Rules engine
  /transactions    → Transaction orchestration
  /blockchain      → Base L2 + x402 integration
  /ledger          → Financial ledger (double-entry)
  /webhooks        → Webhook delivery
  /approvals       → Approval workflows
  /auth            → Authentication & authorization
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16+ (via Docker)
- Redis 7+ (via Docker)

### Installation

```bash
# Install dependencies
npm install

# Start infrastructure (Postgres + Redis)
npm run docker:up

# Copy environment variables
cp .env.example .env

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed database (optional)
npm run db:seed

# Start development server
npm run dev
```

Server will start at: `http://localhost:3000`

## 📁 Project Structure

```
backend/
├── src/
│   ├── index.ts                    # Application entry point
│   ├── server.ts                   # Express server setup
│   │
│   ├── api/                        # HTTP API Layer
│   │   ├── routes.ts               # Route registration
│   │   ├── middleware/             # Express middleware
│   │   └── endpoints/              # REST endpoints
│   │       ├── agents.ts
│   │       ├── transactions.ts
│   │       └── ...
│   │
│   ├── services/                   # Business Logic (Decoupled Services)
│   │   ├── agents/                 # Agent Service
│   │   │   ├── agent.service.ts
│   │   │   ├── agent.types.ts
│   │   │   ├── agent.repository.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── rules/                  # Rules Engine Service
│   │   │   ├── rules.service.ts
│   │   │   ├── rules-engine.ts
│   │   │   ├── rule-evaluators/
│   │   │   └── index.ts
│   │   │
│   │   ├── transactions/           # Transaction Service
│   │   │   ├── transaction.service.ts
│   │   │   ├── transaction.orchestrator.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── blockchain/             # Blockchain Service
│   │   │   ├── blockchain.service.ts
│   │   │   ├── x402-client.ts
│   │   │   ├── contracts/
│   │   │   └── index.ts
│   │   │
│   │   ├── ledger/                 # Ledger Service
│   │   │   ├── ledger.service.ts
│   │   │   ├── double-entry.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── webhooks/               # Webhook Service
│   │   │   ├── webhook.service.ts
│   │   │   ├── webhook-delivery.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── approvals/              # Approval Service
│   │   │   ├── approval.service.ts
│   │   │   └── index.ts
│   │   │
│   │   └── auth/                   # Auth Service
│   │       ├── auth.service.ts
│   │       ├── jwt.ts
│   │       └── index.ts
│   │
│   ├── queues/                     # BullMQ Job Queues
│   │   ├── transaction.queue.ts
│   │   ├── webhook.queue.ts
│   │   ├── reconciliation.queue.ts
│   │   └── index.ts
│   │
│   ├── workers/                    # Queue Workers
│   │   ├── transaction.worker.ts
│   │   ├── webhook.worker.ts
│   │   ├── reconciliation.worker.ts
│   │   └── index.ts
│   │
│   ├── database/                   # Database Layer
│   │   ├── schema.prisma           # Prisma schema
│   │   ├── client.ts               # Prisma client singleton
│   │   ├── migrations/             # Database migrations
│   │   └── seed.ts                 # Seed data
│   │
│   ├── shared/                     # Shared Utilities
│   │   ├── types/                  # Global types
│   │   ├── errors/                 # Custom error classes
│   │   ├── utils/                  # Helper functions
│   │   ├── config/                 # Configuration
│   │   ├── logger/                 # Logging setup
│   │   └── validators/             # Zod schemas
│   │
│   └── tests/                      # Test files
│       ├── unit/
│       ├── integration/
│       └── helpers/
│
├── prisma/                         # Prisma files
│   └── schema.prisma
│
├── docker-compose.yml              # Local development infrastructure
├── package.json
├── tsconfig.json
└── README.md
```

## 🎯 Service Design Principles

### 1. **Service Independence**
Each service has:
- Own folder
- Own types/interfaces
- Own repository layer (if needed)
- Clear public API exported via `index.ts`

### 2. **Dependency Injection**
Services don't import each other directly:

```typescript
// ❌ Bad: Direct import
import { AgentService } from '../agents/agent.service';

// ✅ Good: Inject dependency
class TransactionService {
  constructor(
    private agentService: AgentService,
    private rulesService: RulesService
  ) {}
}
```

### 3. **Single Responsibility**
Each service owns one domain:
- **AgentService** → Agent CRUD only
- **RulesService** → Rule evaluation only
- **TransactionOrchestrator** → Coordinates services

### 4. **Database Access**
Services use repository pattern:

```typescript
// service/agents/agent.repository.ts
export class AgentRepository {
  async findById(id: string) {
    return prisma.agent.findUnique({ where: { id } });
  }
}

// service/agents/agent.service.ts
export class AgentService {
  constructor(private repo: AgentRepository) {}

  async getAgent(id: string) {
    return this.repo.findById(id);
  }
}
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run build            # Build for production
npm run start            # Run production build

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:push          # Push schema (dev only)
npm run db:seed          # Seed database

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report

# Code Quality
npm run lint             # Lint code
npm run lint:fix         # Fix linting issues
npm run format           # Format code with Prettier

# Docker
npm run docker:up        # Start Postgres + Redis
npm run docker:down      # Stop containers
```

## 🌐 API Endpoints

Base URL: `http://localhost:3000/v1`

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### Organizations
- `POST /organizations` - Create organization
- `GET /organizations/:id` - Get organization

### Agents
- `POST /agents` - Create agent
- `GET /agents` - List agents
- `GET /agents/:id` - Get agent details
- `PATCH /agents/:id` - Update agent
- `DELETE /agents/:id` - Deactivate agent

### Spending Rules
- `POST /rules` - Create spending rule
- `GET /rules` - List rules
- `GET /rules/:id` - Get rule details
- `PATCH /rules/:id` - Update rule
- `DELETE /rules/:id` - Delete rule

### Transactions
- `POST /agents/:id/spend` - Initiate spend
- `GET /transactions` - List transactions
- `GET /transactions/:id` - Get transaction details

### Webhooks
- `POST /webhooks` - Register webhook
- `GET /webhooks` - List webhooks
- `DELETE /webhooks/:id` - Delete webhook

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- agent.service.test.ts

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## 📊 Monitoring

- Health check: `GET /health`
- Metrics: `GET /metrics`
- Queue dashboard: `GET /admin/queues` (Bull Board)

## 🔐 Security

- All endpoints require authentication (JWT or API Key)
- Rate limiting: 100 requests per 15 minutes
- Helmet.js for security headers
- Input validation with Zod
- SQL injection protection (Prisma)

## 📝 Environment Variables

See `.env.example` for all required environment variables.

Critical variables:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - JWT signing secret (32+ chars)
- `BASE_RPC_URL` - Base L2 RPC endpoint
- `WALLET_PRIVATE_KEY` - Hot wallet private key

## 🚀 Deployment

### Railway (Recommended for MVP)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

### Docker (Production)

```bash
# Build image
docker build -t auton-backend .

# Run container
docker run -p 3000:3000 --env-file .env auton-backend
```

## 🛠️ Development Guidelines

### Adding a New Service

1. Create folder: `src/services/my-service/`
2. Add service class: `my-service.service.ts`
3. Add types: `my-service.types.ts`
4. Add repository (if needed): `my-service.repository.ts`
5. Export public API: `index.ts`
6. Register in dependency container

### Adding a New Endpoint

1. Create endpoint: `src/api/endpoints/my-endpoint.ts`
2. Add validation schema (Zod)
3. Use service via DI
4. Add tests: `src/tests/integration/my-endpoint.test.ts`

### Database Changes

1. Update `prisma/schema.prisma`
2. Run `npm run db:migrate`
3. Update seed data if needed
4. Update types

## 📚 Documentation

- API Docs: [Coming Soon]
- Architecture: [Coming Soon]
- Contributing: [Coming Soon]

## 🤝 Contributing

1. Create feature branch
2. Write tests
3. Update documentation
4. Submit PR

## 📄 License

MIT License - see LICENSE file

# backend
# backend
# backend
