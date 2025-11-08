# Auton Backend Architecture

## 🏗️ System Overview

Auton is built as a **modular monolith** - a single codebase with clear service boundaries that can be extracted into microservices later.

```
┌─────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST                             │
│                              ↓                                    │
├─────────────────────────────────────────────────────────────────┤
│                      API LAYER                                   │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Express Server                                         │     │
│  │  ├─ Middleware (Auth, Logging, Rate Limit)            │     │
│  │  ├─ Routes (v1/agents, v1/transactions, etc.)         │     │
│  │  └─ Endpoints (REST controllers)                      │     │
│  └────────────────────────────────────────────────────────┘     │
│                              ↓                                    │
├─────────────────────────────────────────────────────────────────┤
│                   SERVICE CONTAINER (DI)                         │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Wires all services together with dependencies         │     │
│  └────────────────────────────────────────────────────────┘     │
│                              ↓                                    │
├─────────────────────────────────────────────────────────────────┤
│                     SERVICE LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Agent     │  │    Rules     │  │ Transaction  │          │
│  │   Service    │  │   Service    │  │ Orchestrator │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Blockchain  │  │    Ledger    │  │   Webhook    │          │
│  │   Service    │  │   Service    │  │   Service    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                              ↓                                    │
├─────────────────────────────────────────────────────────────────┤
│                    REPOSITORY LAYER                              │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Data Access (Prisma ORM)                              │     │
│  └────────────────────────────────────────────────────────┘     │
│                              ↓                                    │
├─────────────────────────────────────────────────────────────────┤
│                    DATABASE LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  PostgreSQL  │  │    Redis     │  │  Base L2     │          │
│  │  (Main DB)   │  │   (Cache)    │  │ (Blockchain) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## 📂 Directory Structure

```
backend/
├── src/
│   ├── index.ts                      # Application entry point
│   ├── server.ts                     # Express server setup
│   │
│   ├── api/                          # HTTP API Layer
│   │   ├── routes.ts                 # Route registration
│   │   ├── middleware/               # Express middleware
│   │   │   ├── authenticate.ts
│   │   │   ├── error-handler.ts
│   │   │   └── request-logger.ts
│   │   └── endpoints/                # REST endpoints
│   │       ├── agents.ts
│   │       ├── transactions.ts
│   │       ├── rules.ts
│   │       └── webhooks.ts
│   │
│   ├── services/                     # Business Logic (Decoupled)
│   │   ├── container.ts              # DI Container
│   │   ├── README.md                 # Service architecture docs
│   │   │
│   │   ├── agents/                   # Agent Service
│   │   │   ├── agent.types.ts
│   │   │   ├── agent.repository.ts
│   │   │   ├── agent.service.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── rules/                    # Rules Service
│   │   │   ├── rules.types.ts
│   │   │   ├── rules.service.ts
│   │   │   ├── rules-engine.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── transactions/             # Transaction Service
│   │   │   ├── transaction.types.ts
│   │   │   ├── transaction.orchestrator.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── blockchain/               # Blockchain Service (TODO)
│   │   ├── ledger/                   # Ledger Service (TODO)
│   │   ├── webhooks/                 # Webhook Service (TODO)
│   │   ├── approvals/                # Approval Service (TODO)
│   │   └── auth/                     # Auth Service (TODO)
│   │
│   ├── queues/                       # BullMQ Queues
│   │   ├── transaction.queue.ts
│   │   ├── webhook.queue.ts
│   │   ├── reconciliation.queue.ts
│   │   └── index.ts
│   │
│   ├── workers/                      # Queue Workers
│   │   ├── transaction.worker.ts
│   │   ├── webhook.worker.ts
│   │   └── reconciliation.worker.ts
│   │
│   ├── database/                     # Database Layer
│   │   ├── client.ts                 # Prisma client
│   │   └── seed.ts                   # Seed data
│   │
│   ├── shared/                       # Shared Utilities
│   │   ├── config/                   # Configuration
│   │   │   └── index.ts
│   │   ├── errors/                   # Custom errors
│   │   │   └── index.ts
│   │   ├── logger/                   # Logging
│   │   │   └── index.ts
│   │   ├── types/                    # Global types
│   │   ├── utils/                    # Helper functions
│   │   └── validators/               # Zod schemas
│   │
│   └── tests/                        # Tests
│       ├── unit/
│       ├── integration/
│       └── helpers/
│
├── prisma/
│   └── schema.prisma                 # Database schema
│
├── package.json
├── tsconfig.json
├── docker-compose.yml
└── README.md
```

## 🔄 Request Flow

### Example: Agent Spending $50

```
1. HTTP Request
   POST /v1/agents/agent_123/spend
   Body: { amount: 50, merchant: "Data Store" }

   ↓

2. API Layer
   - Authenticate (JWT/API Key)
   - Rate limit check
   - Route to endpoint

   ↓

3. Endpoint Handler
   /api/endpoints/agents.ts
   - Parse & validate request (Zod)
   - Call TransactionOrchestrator

   ↓

4. TransactionOrchestrator
   services/transactions/transaction.orchestrator.ts

   Step 4a: Get Agent
   ├─→ AgentService.getAgent()
   │   └─→ AgentRepository.findById()
   │       └─→ Prisma → PostgreSQL

   Step 4b: Check Balance
   ├─→ AgentService.getBalance()
   │   └─→ LedgerService.getBalance()
   │       └─→ Prisma → PostgreSQL

   Step 4c: Evaluate Rules
   ├─→ RulesService.evaluateSpend()
   │   ├─→ Get rules from DB (cached in Redis)
   │   └─→ RulesEngine.evaluate()
   │       ├─ Check per-transaction limit
   │       ├─ Check daily limit
   │       └─ Check category limit

   Step 4d: Create Transaction
   ├─→ TransactionOrchestrator.createTransaction()
   │   └─→ Prisma → PostgreSQL (INSERT)

   Step 4e: Queue for Processing
   └─→ QueueService.queueTransaction()
       └─→ BullMQ → Redis (job queue)

5. Return Response
   HTTP 202 Accepted
   { id: "txn_123", status: "pending", ... }

   ===== API request completes here =====

6. Background Worker (BullMQ)
   workers/transaction.worker.ts
   - Picks up job from queue
   - Calls TransactionOrchestrator.processTransaction()

   ↓

7. Process Transaction

   Step 7a: Update Status
   └─→ UPDATE status = 'processing'

   Step 7b: Execute Payment
   ├─→ BlockchainService.executeSpend()
   │   ├─ Create x402 intent
   │   ├─ Submit to Base L2
   │   ├─ Wait for confirmation (~5 seconds)
   │   └─ Return tx hash

   Step 7c: Record in Ledger
   ├─→ LedgerService.recordEntry()
   │   ├─ Debit agent account
   │   ├─ Credit merchant account
   │   └─ Update balances

   Step 7d: Update Transaction
   ├─→ UPDATE status = 'completed', tx_hash = '0x...'

   Step 7e: Send Webhook
   └─→ WebhookService.trigger('transaction.completed')
       └─→ Queue webhook delivery (BullMQ)

8. Webhook Delivery
   workers/webhook.worker.ts
   - POST to customer's webhook URL
   - Retry on failure (exponential backoff)
   - Log delivery status
```

## 🎯 Service Boundaries

Each service is **completely independent** with clear boundaries:

### **Agent Service**
```
Owns:
- agents table
- agent_balances table (cache)

Provides:
- CRUD operations
- Ownership verification
- Balance lookup (delegates to Ledger)

Depends on:
- Nothing (standalone)
```

### **Rules Service**
```
Owns:
- spending_rules table

Provides:
- CRUD operations for rules
- Rule evaluation engine
- Rule caching

Depends on:
- Nothing (standalone)
```

### **Transaction Orchestrator**
```
Owns:
- transactions table
- transaction_state_history table

Provides:
- Initiate spend flow
- Process transaction flow
- Status updates

Depends on:
- AgentService (verify agent)
- RulesService (evaluate rules)
- LedgerService (check balance)
- BlockchainService (execute payment)
- WebhookService (send notifications)
```

### **Blockchain Service**
```
Owns:
- Smart contract interactions
- x402 protocol integration
- Wallet management

Provides:
- Execute on-chain transfers
- Get on-chain balance
- Create payment intents
- Monitor transactions

Depends on:
- Nothing (standalone)
```

### **Ledger Service**
```
Owns:
- ledger_entries table (double-entry)
- balance calculations

Provides:
- Get balance
- Record entry (debit/credit)
- Reconciliation

Depends on:
- Nothing (standalone)
```

## 🔗 Inter-Service Communication

Services communicate through **dependency injection**:

```typescript
// Bad: Direct import
import { AgentService } from '../agents/agent.service';
const agent = await new AgentService().getAgent(id);

// Good: Dependency injection
class TransactionOrchestrator {
  constructor(private agentService: AgentService) {}

  async process() {
    const agent = await this.agentService.getAgent(id);
  }
}

// Even better: Use container
import { container } from '@/services/container';
const agent = await container.agentService.getAgent(id);
```

## 🧪 Testing Strategy

### Unit Tests
Test each service in isolation:

```typescript
// Mock dependencies
const mockAgentService = {
  getAgent: jest.fn(),
  getBalance: jest.fn(),
};

// Test orchestrator with mocks
const orchestrator = new TransactionOrchestrator(
  mockAgentService,
  mockRulesService
);

await orchestrator.initiateSpend(input);

// Verify interactions
expect(mockAgentService.getAgent).toHaveBeenCalledWith('agent_123');
```

### Integration Tests
Test services with real database:

```typescript
// Use test database
beforeAll(async () => {
  await setupTestDatabase();
});

// Test full flow
const agent = await container.agentService.createAgent(input);
const result = await container.transactionOrchestrator.initiateSpend({
  agentId: agent.id,
  amount: 50,
});

expect(result.status).toBe('pending');
```

## 🚀 Path to Microservices

When ready to extract a service:

### Before (Monolith)
```typescript
// In monolith
const agent = await container.agentService.getAgent(id);
```

### After (Microservice)
```typescript
// AgentService is now a separate service
const agent = await httpClient.get(`http://agent-service/agents/${id}`);
```

**That's it!** The business logic doesn't change - just how it's invoked.

### Migration Steps

1. **Copy service code** to new repo
2. **Add HTTP endpoints** around existing service methods
3. **Deploy independently**
4. **Replace direct calls** with HTTP clients
5. **Monitor and rollback if needed**

## 🔐 Security Layers

```
┌─────────────────────────────────────────┐
│  1. API Gateway                          │
│     - Rate limiting                      │
│     - DDoS protection                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  2. Authentication                       │
│     - JWT verification                   │
│     - API key validation                 │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  3. Authorization                        │
│     - Check org ownership                │
│     - Check permissions                  │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  4. Business Rules                       │
│     - Spending limits                    │
│     - Approval requirements              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  5. Data Access                          │
│     - Row-level security (Prisma)        │
│     - Encrypted fields                   │
└─────────────────────────────────────────┘
```

## 📊 Monitoring & Observability

### Metrics to Track
- Request latency (p50, p95, p99)
- Error rate per endpoint
- Transaction success rate
- Queue depth (BullMQ)
- Database query time
- Blockchain gas costs

### Logging
```typescript
// Structured logging with context
logger.info({
  transactionId: 'txn_123',
  agentId: 'agent_456',
  amount: 50,
  duration: 120,
}, 'Transaction completed');
```

### Tracing
- Track request through entire system
- See which service is slow
- Debug failures easily

## 🎯 Design Goals Achieved

✅ **Modular** - Clear service boundaries
✅ **Testable** - Each service tested independently
✅ **Scalable** - Can extract to microservices
✅ **Maintainable** - Single Responsibility Principle
✅ **Flexible** - Easy to change implementations
✅ **Fast to develop** - Start simple, scale later

## 📚 Further Reading

- [Modular Monolith Pattern](https://www.kamilgrzybek.com/design/modular-monolith-primer/)
- [Dependency Injection in TypeScript](https://www.typescriptlang.org/docs/handbook/2/classes.html#dependency-injection)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [Service Layer Pattern](https://martinfowler.com/eaaCatalog/serviceLayer.html)

