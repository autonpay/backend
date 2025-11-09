# Dashboard Signup & Auth Flow 🚀

Complete authentication and dashboard flow implementation for Auton.

---

## 📋 Overview

The signup flow creates both an **organization** and a **user** in a single request, then returns a JWT token for immediate dashboard access.

---

## 🔐 Authentication Endpoints

### Base URL
```
http://localhost:3000/v1/auth
```

---

## 1️⃣ Sign Up Flow

### POST `/v1/auth/register`

Create new organization and user account.

**Request:**
```json
{
  "email": "founder@startup.com",
  "password": "SecurePass123",
  "organizationName": "My Startup",
  "organizationEmail": "admin@startup.com"  // Optional, defaults to user email
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_abc123",
      "email": "founder@startup.com",
      "organizationId": "org_xyz789",
      "role": "owner"
    },
    "organization": {
      "id": "org_xyz789",
      "name": "My Startup",
      "email": "admin@startup.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Account created successfully"
}
```

**What Happens:**
1. Creates organization
2. Creates user as "owner" role
3. Generates JWT token (valid for 7 days)
4. Returns everything needed for dashboard

---

## 2️⃣ Login Flow

### POST `/v1/auth/login`

Login existing user.

**Request:**
```json
{
  "email": "founder@startup.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_abc123",
      "email": "founder@startup.com",
      "organizationId": "org_xyz789",
      "role": "owner"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

---

## 3️⃣ Get Current User

### GET `/v1/auth/me`

Get current user profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_abc123",
    "email": "founder@startup.com",
    "organizationId": "org_xyz789",
    "role": "owner",
    "createdAt": "2025-11-09T10:00:00Z",
    "updatedAt": "2025-11-09T10:00:00Z"
  }
}
```

---

## 4️⃣ Change Password

### POST `/v1/auth/change-password`

Change user password.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "currentPassword": "SecurePass123",
  "newPassword": "NewSecurePass456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## 5️⃣ API Key Management

### Generate API Key

**POST `/v1/auth/api-keys`**

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Production API Key",
  "prefix": "live"  // or "test"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "sk_live_abc123xyz...",  // ⚠️ Save this! Won't be shown again
    "keyHash": "...",
    "id": "key_abc123"
  },
  "message": "API key generated successfully. Save it now - you won't see it again!"
}
```

### List API Keys

**GET `/v1/auth/api-keys`**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "key_abc123",
      "name": "Production API Key",
      "createdAt": "2025-11-09T10:00:00Z",
      "lastUsedAt": "2025-11-09T12:30:00Z"
    }
  ]
}
```

### Revoke API Key

**DELETE `/v1/auth/api-keys/:id`**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

---

## 📊 Dashboard Endpoints

### Base URL
```
http://localhost:3000/v1/dashboard
```

All dashboard endpoints require authentication.

---

### 1️⃣ Dashboard Overview

**GET `/v1/dashboard/overview`**

Get dashboard stats and organization info.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "organization": {
      "id": "org_xyz789",
      "name": "My Startup",
      "email": "admin@startup.com",
      "kycStatus": "pending"
    },
    "stats": {
      "agents": 5,
      "users": 3,
      "transactions": 142,
      "totalSpend": "12450.50"
    }
  }
}
```

### 2️⃣ Activity Feed

**GET `/v1/dashboard/activity?limit=20`**

Get recent activity.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": []  // TODO: Implement activity feed
}
```

### 3️⃣ Analytics

**GET `/v1/dashboard/analytics?startDate=2025-11-01&endDate=2025-11-09&granularity=day`**

Get analytics data for charts.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "spending": {
      "total": 12450.50,
      "byDay": [],
      "byCategory": []
    },
    "agents": {
      "active": 5,
      "total": 5
    },
    "transactions": {
      "successful": 140,
      "failed": 2,
      "pending": 0
    }
  }
}
```

---

## 🏢 Organization Endpoints

### Base URL
```
http://localhost:3000/v1/organizations
```

---

### 1️⃣ Get Organization

**GET `/v1/organizations/:id`**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "org_xyz789",
    "name": "My Startup",
    "email": "admin@startup.com",
    "kycStatus": "pending",
    "createdAt": "2025-11-09T10:00:00Z",
    "updatedAt": "2025-11-09T10:00:00Z"
  }
}
```

### 2️⃣ Update Organization

**PATCH `/v1/organizations/:id`**

Only organization owners can update.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "My Startup Inc",
  "email": "admin@mystartup.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "org_xyz789",
    "name": "My Startup Inc",
    "email": "admin@mystartup.com",
    "kycStatus": "pending",
    "createdAt": "2025-11-09T10:00:00Z",
    "updatedAt": "2025-11-09T14:00:00Z"
  },
  "message": "Organization updated successfully"
}
```

### 3️⃣ Get Organization Stats

**GET `/v1/organizations/:id/stats`**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userCount": 3,
    "agentCount": 5,
    "transactionCount": 142,
    "totalSpend": "12450.50"
  }
}
```

### 4️⃣ List Users

**GET `/v1/organizations/:id/users`**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_abc123",
      "email": "founder@startup.com",
      "role": "owner",
      "createdAt": "2025-11-09T10:00:00Z"
    },
    {
      "id": "user_def456",
      "email": "dev@startup.com",
      "role": "member",
      "createdAt": "2025-11-09T11:00:00Z"
    }
  ]
}
```

---

## 🤖 Agent Endpoints

### Base URL
```
http://localhost:3000/v1/agents
```

---

### 1️⃣ List Agents

**GET `/v1/agents`**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "agent_abc123",
      "organizationId": "org_xyz789",
      "name": "Marketing Bot",
      "description": "Handles ad spend",
      "walletAddress": "0x123...",
      "status": "active",
      "metadata": {},
      "createdAt": "2025-11-09T10:00:00Z",
      "updatedAt": "2025-11-09T10:00:00Z"
    }
  ]
}
```

### 2️⃣ Create Agent

**POST `/v1/agents`**

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Marketing Bot",
  "description": "Handles ad spend",
  "metadata": {
    "purpose": "advertising",
    "maxDailySpend": 1000
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "agent_abc123",
    "organizationId": "org_xyz789",
    "name": "Marketing Bot",
    "description": "Handles ad spend",
    "walletAddress": null,
    "status": "active",
    "metadata": {
      "purpose": "advertising",
      "maxDailySpend": 1000
    },
    "createdAt": "2025-11-09T10:00:00Z",
    "updatedAt": "2025-11-09T10:00:00Z"
  },
  "message": "Agent created successfully"
}
```

### 3️⃣ Get Agent

**GET `/v1/agents/:id`**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "agent_abc123",
    "organizationId": "org_xyz789",
    "name": "Marketing Bot",
    "description": "Handles ad spend",
    "walletAddress": "0x123...",
    "status": "active",
    "metadata": {},
    "createdAt": "2025-11-09T10:00:00Z",
    "updatedAt": "2025-11-09T10:00:00Z"
  }
}
```

### 4️⃣ Update Agent

**PATCH `/v1/agents/:id`**

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Marketing Bot Pro",
  "status": "paused"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "agent_abc123",
    "organizationId": "org_xyz789",
    "name": "Marketing Bot Pro",
    "description": "Handles ad spend",
    "walletAddress": "0x123...",
    "status": "paused",
    "metadata": {},
    "createdAt": "2025-11-09T10:00:00Z",
    "updatedAt": "2025-11-09T14:00:00Z"
  },
  "message": "Agent updated successfully"
}
```

### 5️⃣ Delete Agent

**DELETE `/v1/agents/:id`**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Agent deleted successfully"
}
```

### 6️⃣ Get Agent Balance

**GET `/v1/agents/:id/balance`**

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "agentId": "agent_abc123",
    "balanceUsd": "1250.50",
    "balanceUsdc": "1250.45",
    "pendingUsd": "100.00",
    "lastUpdatedAt": "2025-11-09T14:00:00Z"
  }
}
```

---

## 🔄 Complete Signup → Dashboard Flow

### Step-by-Step User Journey

```
1. User visits signup page
   ↓
2. User fills form:
   - Email
   - Password
   - Organization Name
   ↓
3. Frontend sends POST /v1/auth/register
   ↓
4. Backend creates:
   - Organization (as owner)
   - User (linked to org)
   - Returns JWT token
   ↓
5. Frontend saves token in localStorage/cookie
   ↓
6. Frontend redirects to /dashboard
   ↓
7. Frontend sends GET /v1/dashboard/overview
   with Authorization: Bearer <token>
   ↓
8. Backend verifies JWT, returns dashboard data
   ↓
9. User sees dashboard with:
   - Organization info
   - Stats (agents, transactions, spend)
   - Quick actions
```

---

## 🧪 Testing the Flow

### Using cURL

```bash
# 1. Register
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "founder@startup.com",
    "password": "SecurePass123",
    "organizationName": "My Startup"
  }'

# Save the token from response

# 2. Get dashboard overview
curl -X GET http://localhost:3000/v1/dashboard/overview \
  -H "Authorization: Bearer <your-token>"

# 3. Create an agent
curl -X POST http://localhost:3000/v1/agents \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Marketing Bot",
    "description": "Handles ad spend"
  }'

# 4. List agents
curl -X GET http://localhost:3000/v1/agents \
  -H "Authorization: Bearer <your-token>"

# 5. Generate API key
curl -X POST http://localhost:3000/v1/auth/api-keys \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key",
    "prefix": "live"
  }'
```

---

## 🔒 Security Features

### ✅ Password Security
- Minimum 8 characters
- Requires uppercase, lowercase, numbers
- bcrypt hashing (salt rounds = 10)

### ✅ JWT Security
- 7-day expiration
- Configurable secret
- Verified on every request

### ✅ API Key Security
- Cryptographically secure generation
- Hashed storage
- Last used tracking

### ✅ Authorization
- Organization-scoped access
- Role-based permissions (owner, admin, member)
- Ownership verification

---

## 📁 File Structure

```
src/api/routes/
├── auth.routes.ts           # Auth endpoints
├── dashboard.routes.ts      # Dashboard endpoints
├── organizations.routes.ts  # Organization management
└── agents.routes.ts         # Agent management

src/api/middleware/
└── authenticate.ts          # JWT/API key verification

src/services/
├── auth/                    # Auth service
├── organizations/           # Organization service
├── users/                   # User service
└── agents/                  # Agent service
```

---

## 🚀 Next Steps

1. ✅ Run migrations: `npm run db:push`
2. ✅ Start server: `npm run dev`
3. ✅ Test signup flow with cURL or Postman
4. ✅ Build frontend signup/login pages
5. ✅ Build dashboard UI

---

## 🎉 Summary

We now have a complete authentication and dashboard system with:

- ✅ User registration (creates org + user)
- ✅ User login
- ✅ JWT authentication
- ✅ API key management
- ✅ Dashboard overview
- ✅ Organization management
- ✅ Agent CRUD operations
- ✅ Role-based access control
- ✅ Multi-tenant architecture

**Ready for frontend integration!** 🚀

