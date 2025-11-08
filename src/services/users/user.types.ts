/**
 * User Service Types
 *
 * Users are people who manage organizations and agents.
 * Each user belongs to exactly one organization.
 */

export interface User {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  OWNER = 'owner',      // Full access, can delete org
  ADMIN = 'admin',      // Can manage users and agents
  MEMBER = 'member',    // Can view and create agents
}

export interface CreateUserInput {
  organizationId: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
}

export interface UpdateUserInput {
  email?: string;
  passwordHash?: string;
  role?: UserRole;
}

export interface ListUsersQuery {
  organizationId?: string;
  role?: UserRole;
  limit?: number;
  offset?: number;
}

export interface UserWithOrganization extends User {
  organization: {
    id: string;
    name: string;
    email: string;
  };
}

