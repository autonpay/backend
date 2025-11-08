/**
 * Agent Repository
 *
 * Data access layer for Agent service.
 * Handles all database operations for agents.
 */

import { prisma } from '../../database/client';
import { Agent, CreateAgentInput, UpdateAgentInput, ListAgentsQuery, AgentStatus } from './agent.types';

export class AgentRepository {
  /**
   * Find agent by ID
   */
  async findById(id: string): Promise<Agent | null> {
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        balance: true,
      },
    });

    if (!agent) return null;

    return this.mapToAgent(agent);
  }

  /**
   * Find agents by organization
   */
  async findByOrganization(query: ListAgentsQuery): Promise<Agent[]> {
    const agents = await prisma.agent.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.status && { status: query.status }),
      },
      include: {
        balance: true,
      },
      take: query.limit || 50,
      skip: query.offset || 0,
      orderBy: { createdAt: 'desc' },
    });

    return agents.map(agent => this.mapToAgent(agent));
  }

  /**
   * Create new agent
   */
  async create(input: CreateAgentInput): Promise<Agent> {
    const agent = await prisma.agent.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        description: input.description,
        status: AgentStatus.ACTIVE,
        metadata: input.metadata || {},
      },
      include: {
        balance: true,
      },
    });

    // Create initial balance record
    await prisma.agentBalance.create({
      data: {
        agentId: agent.id,
        balanceUsd: 0,
        balanceUsdc: 0,
        pendingUsd: 0,
      },
    });

    return this.mapToAgent(agent);
  }

  /**
   * Update agent
   */
  async update(id: string, input: UpdateAgentInput): Promise<Agent> {
    const agent = await prisma.agent.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.status && { status: input.status }),
        ...(input.metadata && { metadata: input.metadata }),
      },
      include: {
        balance: true,
      },
    });

    return this.mapToAgent(agent);
  }

  /**
   * Delete agent (soft delete)
   */
  async delete(id: string): Promise<void> {
    await prisma.agent.update({
      where: { id },
      data: { status: AgentStatus.DELETED },
    });
  }

  /**
   * Check if agent exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await prisma.agent.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Find agent by wallet address
   */
  async findByWalletAddress(walletAddress: string): Promise<Agent | null> {
    const agent = await prisma.agent.findFirst({
      where: { walletAddress },
      include: {
        balance: true,
      },
    });

    if (!agent) return null;

    return this.mapToAgent(agent);
  }

  /**
   * Update agent wallet address
   */
  async updateWalletAddress(id: string, walletAddress: string): Promise<void> {
    await prisma.agent.update({
      where: { id },
      data: { walletAddress },
    });
  }

  /**
   * Get agent balance from cache
   */
  async getBalance(id: string): Promise<{
    available: number;
    pending: number;
    lastUpdated: Date;
  }> {
    const balance = await prisma.agentBalance.findUnique({
      where: { agentId: id },
    });

    if (!balance) {
      return {
        available: 0,
        pending: 0,
        lastUpdated: new Date(),
      };
    }

    return {
      available: Number(balance.balanceUsd),
      pending: Number(balance.pendingUsd),
      lastUpdated: balance.lastUpdatedAt,
    };
  }

  /**
   * Map Prisma model to Agent type
   */
  private mapToAgent(agent: any): Agent {
    return {
      id: agent.id,
      organizationId: agent.organizationId,
      name: agent.name,
      description: agent.description,
      walletAddress: agent.walletAddress,
      status: agent.status as AgentStatus,
      metadata: agent.metadata as Record<string, any>,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }
}

