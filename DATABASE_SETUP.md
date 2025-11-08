# 🗄️ Database Setup Guide

This guide walks you through setting up the Auton database from scratch.

---

## ✅ What We've Built

### Database Schema
- **11 tables** with full relationships
- **Double-entry ledger** for financial accuracy
- **Audit logging** for compliance
- **Proper indexes** for performance

### Repositories Implemented
- ✅ **AgentRepository** - Full CRUD + balance lookup
- ✅ **LedgerRepository** - Double-entry accounting + balance caching
- ⏳ **RulesRepository** - Coming next
- ⏳ **TransactionRepository** - Coming next

---

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
cd /Users/victorjonah/Desktop/Projects/auton/backend
npm install
```

### Step 2: Start Infrastructure

```bash
# Start PostgreSQL + Redis
npm run docker:up

# Verify containers are running
docker ps
# Should show: auton-postgres and auton-redis
```

### Step 3: Set Environment Variables

```bash
# Copy example env file
cp .env.example .env

# Edit .env and set DATABASE_URL
DATABASE_URL="postgresql://auton:dev_password_change_in_production@localhost:5432/auton_dev"
```

### Step 4: Generate Prisma Client

```bash
npm run db:generate
```

This reads `prisma/schema.prisma` and generates TypeScript types.

### Step 5: Run Migrations

```bash
npm run db:migrate
```

This creates all tables in PostgreSQL.

You should see:
```
✔ Generated Prisma Client
✔ Applied 1 migration
```

### Step 6: Seed Test Data

```bash
npm run db:seed
```

This populates the database with:
- 2 organizations
- 2 users
- 3 AI agents
- 4 spending rules
- 3 merchants
- 3 sample transactions

You should see:
```
🎉 Database seeding completed successfully!

📊 Summary:
  - Organizations: 2
  - Users: 2
  - Agents: 3
  - Spending Rules: 4
  - Merchants: 3
  - Transactions: 3

🔐 Test Credentials:
  Email: founder@acme.ai
  Password: password123
```

### Step 7: Verify Database

```bash
# Connect to PostgreSQL
docker exec -it auton-postgres psql -U auton -d auton_dev

# List tables
\dt

# You should see:
# organizations
# users
# api_keys
# agents
# agent_balances
# spending_rules
# transactions
# merchants
# approvals
# approval_actions
# webhooks
# webhook_events
# ledger_entries
# audit_logs

# Check data
SELECT id, name, status FROM agents;

# Exit
\q
```

---

## 📊 Database Schema Overview

### Core Tables

```
organizations (2 rows)
  ├─ users (2 rows)
  ├─ api_keys (1 row)
  ├─ agents (3 rows)
  │   └─ agent_balances (3 rows)
  ├─ spending_rules (4 rows)
  ├─ transactions (3 rows)
  └─ webhooks (1 row)
      └─ webhook_events (0 rows)

merchants (3 rows)
ledger_entries (2 rows)
approvals (0 rows)
audit_logs (0 rows)
```

### Relationships

```mermaid
graph TD
    Org[Organization] --> User[User]
    Org --> Agent[Agent]
    Org --> Rule[Spending Rule]
    Org --> Txn[Transaction]
    Agent --> Balance[Agent Balance]
    Agent --> Rule
    Agent --> Txn
    Merchant --> Txn
    Txn --> Approval[Approval]
    Approval --> Action[Approval Action]
    User --> Action
```

---

## 🔧 Database Operations

### View All Agents

```typescript
import { prisma } from './src/database/client';

const agents = await prisma.agent.findMany({
  include: {
    balance: true,
    organization: true,
  },
});

console.log(agents);
```

### Create New Agent

```typescript
const agent = await prisma.agent.create({
  data: {
    organizationId: 'org_id_here',
    name: 'My New Agent',
    description: 'Does cool stuff',
    status: 'active',
    metadata: {},
  },
});

// Create balance
await prisma.agentBalance.create({
  data: {
    agentId: agent.id,
    balanceUsd: 0,
    balanceUsdc: 0,
    pendingUsd: 0,
  },
});
```

### Check Balance

```typescript
const balance = await prisma.agentBalance.findUnique({
  where: { agentId: 'agent_id_here' },
});

console.log('Available:', Number(balance.balanceUsd));
console.log('Pending:', Number(balance.pendingUsd));
```

### Create Transaction

```typescript
const transaction = await prisma.transaction.create({
  data: {
    organizationId: 'org_id',
    agentId: 'agent_id',
    amount: 50.00,
    currency: 'USD',
    merchantName: 'Test Merchant',
    category: 'data',
    status: 'pending',
    paymentMethod: 'onchain',
    requiresApproval: false,
    metadata: {},
  },
});
```

---

## 🧪 Testing Repository Methods

### Test Agent Repository

```typescript
import { AgentRepository } from './src/services/agents/agent.repository';

const repo = new AgentRepository();

// Find by ID
const agent = await repo.findById('agent_id_here');
console.log(agent);

// List all agents
const agents = await repo.findByOrganization({
  organizationId: 'org_id_here',
  limit: 10,
});
console.log(agents);

// Create agent
const newAgent = await repo.create({
  organizationId: 'org_id',
  name: 'Test Agent',
  description: 'Test',
});
console.log('Created:', newAgent.id);
```

### Test Ledger Repository

```typescript
import { LedgerRepository } from './src/services/ledger/ledger.repository';

const repo = new LedgerRepository();

// Get balance
const balance = await repo.getAgentBalance('agent_id_here');
console.log('Balance:', balance);

// Create ledger entry
const entry = await repo.createEntry({
  account: 'agent:agent_id_here',
  debit: 0,
  credit: 100, // Add $100
  description: 'Test deposit',
});
console.log('New balance:', entry.balance);
```

---

## 📝 Common Migrations

### Add New Column

```bash
# Edit prisma/schema.prisma
# Add column to model

# Generate migration
npx prisma migrate dev --name add_new_column

# Apply to database
npm run db:migrate
```

### Rename Column

```bash
# Edit prisma/schema.prisma
# Change field name

# Generate migration
npx prisma migrate dev --name rename_column

# Prisma will detect the change
```

### Add New Table

```bash
# Edit prisma/schema.prisma
# Add new model

# Generate migration
npx prisma migrate dev --name add_new_table
```

---

## 🐛 Troubleshooting

### "Can't reach database server"

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not, start it
npm run docker:up

# Check connection
docker exec -it auton-postgres psql -U auton -d auton_dev
```

### "Table already exists"

```bash
# Reset database (DANGER: deletes all data)
npx prisma migrate reset

# Re-seed
npm run db:seed
```

### "Prisma Client not found"

```bash
# Regenerate client
npm run db:generate

# Restart your dev server
npm run dev
```

### "Migration failed"

```bash
# Check migration status
npx prisma migrate status

# If stuck, reset
npx prisma migrate reset

# Then run migrations again
npm run db:migrate
```

---

## 🔐 Production Considerations

### Before Deploying to Production:

1. **Change Passwords**
   ```bash
   # In .env
   DATABASE_URL="postgresql://prod_user:STRONG_PASSWORD@db.server.com:5432/auton_prod"
   ```

2. **Enable SSL**
   ```bash
   DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
   ```

3. **Use Connection Pooling**
   ```typescript
   // Use PgBouncer or similar
   DATABASE_URL="postgresql://user:pass@pgbouncer:6432/db"
   ```

4. **Set Up Backups**
   ```bash
   # Automated daily backups
   pg_dump -h host -U user -d auton_prod > backup.sql
   ```

5. **Monitor Performance**
   ```sql
   -- Slow queries
   SELECT query, mean_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

6. **Add Read Replicas** (for scale)
   ```typescript
   // Use Prisma read replicas
   const prisma = new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL,
       },
       replica: {
         url: process.env.DATABASE_REPLICA_URL,
       },
     },
   });
   ```

---

## 📚 Next Steps

Now that the database is set up:

1. ✅ **Test repositories** - Run test queries
2. ⏳ **Build API endpoints** - Create REST endpoints
3. ⏳ **Add authentication** - JWT + API keys
4. ⏳ **Implement rules repository** - Complete rules service
5. ⏳ **Add transaction repository** - Complete transaction service

---

## 🎯 Success Criteria

You know the database is working when:

- [x] All tables created (`\dt` shows 14 tables)
- [x] Seed data loaded (3 agents, 3 transactions)
- [x] Agent repository methods work
- [x] Ledger repository methods work
- [x] Can query via Prisma Client
- [ ] API endpoints use repositories
- [ ] Tests pass

---

## 📖 Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)

---

**Database setup complete! 🎉**

Next: Build API endpoints that use these repositories.

