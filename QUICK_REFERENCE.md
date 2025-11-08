# 🚀 Quick Reference - Auton Backend

## 📦 Setup Commands

```bash
# Install dependencies
npm install

# Start infrastructure (Postgres + Redis)
npm run docker:up

# Stop infrastructure
npm run docker:down

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed test data
npm run db:seed

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

---

## 🗄️ Database Quick Access

```bash
# Connect to PostgreSQL
docker exec -it auton-postgres psql -U auton -d auton_dev

# List tables
\dt

# Query agents
SELECT id, name, status FROM agents;

# Query balances
SELECT agent_id, balance_usd, pending_usd FROM agent_balances;

# Exit
\q
```

---

## 💻 Using Services in Code

```typescript
import { container } from '@/services/container';

// Agent Service
const agent = await container.agentService.getAgent('id');
const agents = await container.agentService.listAgents({ organizationId: 'org_id' });
const newAgent = await container.agentService.createAgent({ ... });

// Ledger Service
const balance = await container.ledgerService.getAgentBalance('agent_id');
await container.ledgerService.deposit('agent_id', 1000);
await container.ledgerService.recordTransaction({ ... });

// Rules Service
const result = await container.rulesService.evaluateSpend({ ... });

// Transaction Orchestrator
const txn = await container.transactionOrchestrator.initiateSpend({ ... });
```

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── index.ts                    # Entry point
│   ├── server.ts                   # Express setup
│   ├── api/                        # REST API
│   │   ├── routes.ts
│   │   ├── middleware/
│   │   └── endpoints/
│   ├── services/                   # Business logic
│   │   ├── agents/                 # ✅ DONE
│   │   ├── rules/                  # ✅ DONE
│   │   ├── ledger/                 # ✅ DONE
│   │   ├── transactions/           # ✅ DONE
│   │   └── container.ts
│   ├── database/                   # Database
│   │   ├── client.ts               # ✅ DONE
│   │   └── seed.ts                 # ✅ DONE
│   └── shared/                     # Utilities
│       ├── config/
│       ├── errors/
│       └── logger/
└── prisma/
    └── schema.prisma               # ✅ DONE
```

---

## 🎯 Service Methods Reference

### AgentService
```typescript
getAgent(id: string): Promise<Agent>
listAgents(query: ListAgentsQuery): Promise<Agent[]>
createAgent(input: CreateAgentInput): Promise<Agent>
updateAgent(id: string, input: UpdateAgentInput): Promise<Agent>
deleteAgent(id: string): Promise<void>
verifyOwnership(agentId: string, orgId: string): Promise<boolean>
```

### LedgerService
```typescript
getAgentBalance(agentId: string): Promise<AgentBalance>
recordTransaction(input: RecordTransactionInput): Promise<void>
deposit(agentId: string, amount: number): Promise<void>
lockFunds(agentId: string, amount: number): Promise<void>
unlockFunds(agentId: string, amount: number): Promise<void>
getAgentHistory(agentId: string, limit?: number): Promise<LedgerEntry[]>
reconcileAgentBalance(agentId: string): Promise<ReconcileResult>
```

### RulesService
```typescript
evaluateSpend(request: SpendRequest): Promise<RuleEvaluationResult>
createRule(input: CreateRuleInput): Promise<SpendingRule>
updateRule(id: string, updates: Partial<CreateRuleInput>): Promise<SpendingRule>
deleteRule(id: string): Promise<void>
```

### TransactionOrchestrator
```typescript
initiateSpend(input: CreateTransactionInput): Promise<Transaction>
processTransaction(transactionId: string): Promise<void>
```

---

## 🔑 Test Credentials (from seed)

```
Organization: Acme AI Labs
Email: founder@acme.ai
Password: password123

Agents:
- Data Buyer Bot (active, $1,500 balance)
- Ad Campaign Manager (active, $5,000 balance)
- Cloud Resource Optimizer (paused, $250 balance)
```

---

## 🐛 Common Issues & Fixes

### "Can't connect to database"
```bash
npm run docker:up
```

### "Prisma Client not generated"
```bash
npm run db:generate
```

### "Table doesn't exist"
```bash
npm run db:migrate
```

### "No data in database"
```bash
npm run db:seed
```

### "Port 3000 already in use"
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in .env
PORT=3001
```

---

## 📊 Database Tables

```
organizations       - Company accounts
users              - People managing orgs
api_keys           - API authentication
agents             - AI agents
agent_balances     - Cached balances
spending_rules     - Spending limits
transactions       - Payment records
merchants          - Payment recipients
approvals          - Transaction approvals
approval_actions   - Approval history
webhooks           - Webhook config
webhook_events     - Webhook delivery log
ledger_entries     - Double-entry ledger
audit_logs         - Audit trail
```

---

## 🔗 Useful Links

- **Setup Guide:** DATABASE_SETUP.md
- **Architecture:** ARCHITECTURE.md
- **Implementation Summary:** IMPLEMENTATION_SUMMARY.md
- **Service Docs:** src/services/README.md

---

## ⚡ Quick Test Script

Create `test.ts`:
```typescript
import { container } from './src/services/container';

async function test() {
  // List agents
  const agents = await container.agentService.listAgents({
    organizationId: 'org_id_from_seed',
  });

  console.log('Agents:', agents.length);

  // Get balance
  if (agents[0]) {
    const balance = await container.ledgerService.getAgentBalance(agents[0].id);
    console.log('Balance:', balance);
  }
}

test().catch(console.error);
```

Run: `npx tsx test.ts`

---

## 🎯 Next Steps Checklist

- [ ] Build REST API endpoints
- [ ] Add JWT authentication
- [ ] Write integration tests
- [ ] Implement remaining services (Blockchain, Webhook, Approval)
- [ ] Set up BullMQ queues
- [ ] Add request validation (Zod)
- [ ] Create Swagger docs
- [ ] Deploy to staging

---

**Keep this file handy for quick reference!** 📌

