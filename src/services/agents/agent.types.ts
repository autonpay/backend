/**
 * Agent Service Types
 *
 * All types for the Agent domain.
 * This service is responsible for managing AI agents.
 */

export interface Agent {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  walletAddress?: string;
  status: AgentStatus;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum AgentStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  DELETED = 'deleted',
}

export interface CreateAgentInput {
  organizationId: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  status?: AgentStatus;
  metadata?: Record<string, any>;
}

export interface AgentBalance {
  agentId: string;
  available: number;
  pending: number;
  currency: string;
  lastUpdated: Date;
}

export interface ListAgentsQuery {
  organizationId: string;
  status?: AgentStatus;
  limit?: number;
  offset?: number;
}

