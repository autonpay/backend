# Services Architecture

This directory contains all business logic services. Each service is **self-contained** and can be extracted into a microservice with minimal refactoring.

## 🎯 Design Principles

### 1. **Service Independence**
Each service:
- Lives in its own folder
- Has its own types (`.types.ts`)
- Has its own repository for data access (`.repository.ts`)
- Exports a clean public API (`index.ts`)
- Does NOT directly import other services

### 2. **Dependency Injection**
Services receive dependencies through their constructor:

```typescript
// ✅ Good: Dependencies injected
class TransactionOrchestrator {
  constructor(
    private agentService: AgentService,
    private rulesService: RulesService
  ) {}
}

// ❌ Bad: Direct import
import { AgentService } from '../agents/agent.service';
const agentService = new AgentService();
```

### 3. **Single Responsibility**
Each service owns ONE domain:
- **AgentService** → Manage agents only
- **RulesService** → Evaluate rules only
- **TransactionOrchestrator** → Coordinate transactions

### 4. **Clear Boundaries**
Services communicate through well-defined interfaces:

```typescript
// Other services only see this public interface
export interface AgentService {
  getAgent(id: string): Promise<Agent>;
  createAgent(input: CreateAgentInput): Promise<Agent>;
  // ... etc
}
```

## 📁 Service Structure

Each service follows this structure:

```
/services/my-service/
├── my-service.types.ts       # TypeScript types/interfaces
├── my-service.repository.ts  # Data access layer (Prisma)
├── my-service.service.ts     # Business logic
└── index.ts                  # Public API (exports only)
```

### Example: Agent Service

```
/services/agents/
├── agent.types.ts
├── agent.repository.ts
├── agent.service.ts
└── index.ts
```

## 🔧 Available Services

### **1. Agent Service** (`/agents`)
Manages AI agents.

**Responsibilities:**
- CRUD operations for agents
- Agent validation
- Agent balance lookup (delegates to Ledger)

**Public API:**
```typescript
import { AgentService } from '@/services/agents';

const service = container.agentService;
const agent = await service.getAgent('agent_123');
```

---

### **2. Rules Service** (`/rules`)
Manages and evaluates spending rules.

**Responsibilities:**
- CRUD operations for rules
- Rule evaluation (via RulesEngine)
- Rule caching

**Public API:**
```typescript
import { RulesService, SpendRequest } from '@/services/rules';

const service = container.rulesService;
const result = await service.evaluateSpend(spendRequest);
```

**Contains:**
- `RulesService` - High-level service
- `RulesEngine` - Core evaluation logic

---

### **3. Transaction Orchestrator** (`/transactions`)
Coordinates the entire transaction flow.

**Responsibilities:**
- Orchestrate spend requests
- Coordinate: Agent → Rules → Balance → Queue
- Create transaction records
- Process transactions (via workers)

**Public API:**
```typescript
import { TransactionOrchestrator } from '@/services/transactions';

const orchestrator = container.transactionOrchestrator;
const txn = await orchestrator.initiateSpend(input);
```

---

### **4. Blockchain Service** (`/blockchain`) - TODO
Handles all blockchain interactions.

**Responsibilities:**
- Smart contract calls (Base L2)
- x402 protocol integration
- Wallet management
- Gas estimation

---

### **5. Ledger Service** (`/ledger`) - TODO
Double-entry accounting ledger.

**Responsibilities:**
- Record all financial transactions
- Calculate balances
- Ledger entries (debit/credit)
- Reconciliation

---

### **6. Webhook Service** (`/webhooks`) - TODO
Manages webhook delivery.

**Responsibilities:**
- Register webhooks
- Queue webhook events
- Deliver with retries
- Signature verification

---

### **7. Approval Service** (`/approvals`) - TODO
Handles transaction approvals.

**Responsibilities:**
- Create approval requests
- Approve/reject transactions
- Notification to approvers
- Timeout handling

---

### **8. Auth Service** (`/auth`) - TODO
Authentication and authorization.

**Responsibilities:**
- User login/registration
- JWT generation/verification
- API key management
- Permission checks

---

## 🔗 Service Communication

Services communicate through **dependency injection**:

```typescript
// In container.ts
class ServiceContainer {
  get transactionOrchestrator(): TransactionOrchestrator {
    return new TransactionOrchestrator(
      this.agentService,     // ← Inject AgentService
      this.rulesService,     // ← Inject RulesService
      this.ledgerService,    // ← Inject LedgerService
      this.blockchainService // ← Inject BlockchainService
    );
  }
}
```

### Flow Example: Agent Spending

```
API Endpoint
    ↓
TransactionOrchestrator.initiateSpend()
    ├─→ AgentService.getAgent()
    ├─→ AgentService.getBalance() ──→ LedgerService.getBalance()
    ├─→ RulesService.evaluateSpend()
    ├─→ TransactionOrchestrator.createTransaction()
    └─→ QueueService.queueTransaction()
         ↓
    (BullMQ Worker)
         ↓
TransactionOrchestrator.processTransaction()
    ├─→ BlockchainService.executeSpend()
    ├─→ LedgerService.recordEntry()
    └─→ WebhookService.trigger()
```

## 🧪 Testing Services

Each service can be tested in isolation by mocking dependencies:

```typescript
// agent.service.test.ts
import { AgentService } from './agent.service';
import { AgentRepository } from './agent.repository';

describe('AgentService', () => {
  let service: AgentService;
  let mockRepo: jest.Mocked<AgentRepository>;

  beforeEach(() => {
    // Mock the repository
    mockRepo = {
      findById: jest.fn(),
      create: jest.fn(),
      // ... etc
    } as any;

    // Inject mock
    service = new AgentService(mockRepo);
  });

  it('should get agent by id', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'agent_123',
      name: 'Test Agent',
      // ... etc
    });

    const agent = await service.getAgent('agent_123');

    expect(agent.id).toBe('agent_123');
    expect(mockRepo.findById).toHaveBeenCalledWith('agent_123');
  });
});
```

## 🚀 Extracting to Microservices

When you're ready to extract a service:

### Step 1: Copy the service folder
```bash
cp -r services/agents ../microservices/agent-service/src/
```

### Step 2: Add HTTP API
```typescript
// In microservice
app.post('/agents', async (req, res) => {
  const agent = await agentService.createAgent(req.body);
  res.json(agent);
});
```

### Step 3: Replace service call with HTTP call
```typescript
// In monolith (replace direct call)
const agent = await agentService.getAgent(id);

// With HTTP client
const agent = await agentServiceClient.getAgent(id);
```

### Step 4: Deploy independently
```bash
docker build -t agent-service .
docker push agent-service
kubectl apply -f agent-service.yaml
```

**That's it!** The service code doesn't change - only how it's invoked.

## 📦 Adding a New Service

### Step 1: Create folder structure
```bash
mkdir -p src/services/my-service
touch src/services/my-service/my-service.types.ts
touch src/services/my-service/my-service.repository.ts
touch src/services/my-service/my-service.service.ts
touch src/services/my-service/index.ts
```

### Step 2: Define types
```typescript
// my-service.types.ts
export interface MyEntity {
  id: string;
  name: string;
  // ...
}

export interface CreateMyEntityInput {
  name: string;
  // ...
}
```

### Step 3: Create repository
```typescript
// my-service.repository.ts
export class MyServiceRepository {
  async findById(id: string): Promise<MyEntity | null> {
    return prisma.myEntity.findUnique({ where: { id } });
  }

  async create(input: CreateMyEntityInput): Promise<MyEntity> {
    return prisma.myEntity.create({ data: input });
  }
}
```

### Step 4: Create service
```typescript
// my-service.service.ts
export class MyService {
  constructor(
    private repository: MyServiceRepository
  ) {}

  async getEntity(id: string): Promise<MyEntity> {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError('MyEntity', id);
    return entity;
  }
}
```

### Step 5: Export public API
```typescript
// index.ts
export { MyService } from './my-service.service';
export { MyServiceRepository } from './my-service.repository';
export * from './my-service.types';
```

### Step 6: Register in container
```typescript
// container.ts
class ServiceContainer {
  private _myService?: MyService;

  get myService(): MyService {
    if (!this._myService) {
      const repository = new MyServiceRepository();
      this._myService = new MyService(repository);
    }
    return this._myService;
  }
}
```

### Step 7: Use it!
```typescript
import { container } from '@/services/container';

const entity = await container.myService.getEntity('id_123');
```

## 🎯 Best Practices

### ✅ DO

- Keep services focused on one domain
- Use dependency injection
- Export clean public APIs
- Write unit tests for each service
- Use TypeScript types strictly
- Log important operations
- Handle errors gracefully

### ❌ DON'T

- Import services directly (use container)
- Mix concerns (e.g., don't put blockchain logic in AgentService)
- Access database directly from services (use repositories)
- Expose internal implementation details
- Share mutable state between services
- Skip error handling

## 📚 Further Reading

- [Dependency Injection Pattern](https://en.wikipedia.org/wiki/Dependency_injection)
- [Microservices Pattern](https://microservices.io/)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [Service Layer Pattern](https://martinfowler.com/eaaCatalog/serviceLayer.html)

