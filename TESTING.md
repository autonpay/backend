# Testing Guide

## Auth Integration Tests

Comprehensive integration tests for the authentication system.

---

## 🧪 Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run with coverage
```bash
npm run test:coverage
```

### Run specific test file
```bash
npm test -- auth.integration.test
```

---

## 📋 Test Coverage

### Auth Tests Cover:

#### 1. User Registration (`POST /v1/auth/register`)
- ✅ Successful registration with organization creation
- ✅ Password validation (weak passwords rejected)
- ✅ Email validation (invalid emails rejected)
- ✅ Duplicate email prevention
- ✅ JWT token generation
- ✅ Default role assignment (owner)

#### 2. User Login (`POST /v1/auth/login`)
- ✅ Successful login with valid credentials
- ✅ Invalid password rejection
- ✅ Non-existent email handling
- ✅ Missing credentials validation
- ✅ JWT token generation

#### 3. Current User (`GET /v1/auth/me`)
- ✅ Get user with valid JWT token
- ✅ Get user with valid API key
- ✅ Missing token rejection
- ✅ Invalid token rejection

#### 4. Password Management (`POST /v1/auth/change-password`)
- ✅ Successful password change
- ✅ Verification with new password (login test)
- ✅ Incorrect current password rejection
- ✅ Weak new password rejection

#### 5. API Key Management
**Generation (`POST /v1/auth/api-keys`)**
- ✅ Generate live API key (`sk_live_*`)
- ✅ Generate test API key (`sk_test_*`)
- ✅ Environment field validation
- ✅ Missing authentication rejection
- ✅ Key format validation

**Listing (`GET /v1/auth/api-keys`)**
- ✅ List all keys for organization
- ✅ Environment field presence
- ✅ Missing authentication rejection

**Validation (via `GET /v1/auth/me`)**
- ✅ Authenticate with valid API key
- ✅ Invalid API key rejection
- ✅ Environment tracking

**Revocation (`DELETE /v1/auth/api-keys/:id`)**
- ✅ Successful key revocation
- ✅ Verification key is deleted
- ✅ Non-existent key handling

#### 6. JWT Token Validation
- ✅ JWT structure validation (3 parts)
- ✅ Token expiration handling
- ✅ Malformed token rejection

#### 7. Complete Auth Flow
- ✅ Register → Login → Protected Route
- ✅ API Key Generation → Authentication
- ✅ Multiple authentication methods (JWT + API Key)

---

## 🛠️ Setup

### Prerequisites
```bash
# Install dependencies
npm install

# Setup database
npm run db:push

# Generate Prisma client
npm run db:generate
```

### Environment Variables
Create a `.env` file:
```bash
DATABASE_URL="postgresql://user@localhost:5432/auton_dev"
JWT_SECRET="test-secret-key"
JWT_EXPIRY="7d"
NODE_ENV="test"
```

---

## 📊 Test Structure

```
src/__tests__/
├── setup.ts                    # Jest setup
└── auth.integration.test.ts    # Auth integration tests
```

### Test Pattern
```typescript
describe('Feature', () => {
  // Setup
  beforeAll(async () => {
    // Create test data
  });

  // Cleanup
  afterAll(async () => {
    // Clean up test data
  });

  describe('Endpoint', () => {
    it('should succeed with valid input', async () => {
      // Arrange
      // Act
      // Assert
    });

    it('should fail with invalid input', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

---

## 🎯 Test Best Practices

### 1. Use Unique Test Data
```typescript
const email = `test-${Date.now()}@example.com`;
```
Prevents conflicts between test runs.

### 2. Clean Up After Tests
```typescript
afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { contains: 'test-' } },
  });
});
```

### 3. Test Both Success and Failure Cases
```typescript
it('should succeed with valid input', ...);
it('should fail with invalid input', ...);
```

### 4. Use Descriptive Test Names
```typescript
// ✅ Good
it('should register a new user and create organization', ...);

// ❌ Bad
it('works', ...);
```

### 5. Test Real Flows
```typescript
// Register → Login → Access Protected Route
```
Tests the actual user journey.

---

## 📈 Coverage Goals

| Category | Current | Target |
|----------|---------|--------|
| Auth Service | 95%+ | 95% |
| User Service | TBD | 90% |
| Agent Service | TBD | 90% |
| Transaction Service | TBD | 85% |
| Overall | TBD | 85% |

---

## 🐛 Debugging Tests

### Run single test
```bash
npm test -- -t "should register a new user"
```

### Enable verbose output
```bash
npm test -- --verbose
```

### Show console logs
```typescript
// Comment out in setup.ts:
// global.console = { ... };
```

---

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: auton_test
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - run: npm install
      - run: npm run db:push
      - run: npm test
      - run: npm run test:coverage
```

---

## 📝 Adding New Tests

### 1. Create Test File
```typescript
// src/__tests__/feature.integration.test.ts
import request from 'supertest';
import { createServer } from '../server';

describe('Feature Tests', () => {
  let app;

  beforeAll(async () => {
    app = await createServer();
  });

  it('should do something', async () => {
    const response = await request(app)
      .get('/endpoint')
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});
```

### 2. Run Tests
```bash
npm test
```

### 3. Check Coverage
```bash
npm run test:coverage
```

---

## 🎉 Summary

- ✅ **41 test cases** covering auth flow
- ✅ **supertest** for HTTP testing
- ✅ **Jest** for test framework
- ✅ **Real database** integration
- ✅ **Complete flows** tested
- ✅ **Both success and failure** cases

**Run tests with:** `npm test`

