/**
 * Agent Service
 *
 * Business logic for managing AI agents.
 * This service is self-contained and can be extracted into a microservice.
 */

import {
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
  ListAgentsQuery,
  AgentBalance
} from './agent.types';
import { AgentRepository } from './agent.repository';
import { NotFoundError, UnauthorizedError } from '../../shared/errors';
import { logger } from '../../shared/logger';

export class AgentService {
  constructor(
    private repository: AgentRepository
  ) {}

  /**
   * Get agent by ID
   */
  async getAgent(id: string): Promise<Agent> {
    logger.debug({ agentId: id }, 'Getting agent');

    const agent = await this.repository.findById(id);

    if (!agent) {
      throw new NotFoundError('Agent', id);
    }

    return agent;
  }

  /**
   * List agents for organization
   */
  async listAgents(query: ListAgentsQuery): Promise<Agent[]> {
    logger.debug({ query }, 'Listing agents');

    return this.repository.findByOrganization(query);
  }

  /**
   * Create new agent
   */
  async createAgent(input: CreateAgentInput): Promise<Agent> {
    logger.info({ input }, 'Creating agent');

    // Validation
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Agent name is required');
    }

    // Create agent
    const agent = await this.repository.create({
      ...input,
      metadata: input.metadata || {},
    });

    logger.info({ agentId: agent.id }, 'Agent created successfully');

    return agent;
  }

  /**
   * Update agent
   */
  async updateAgent(id: string, input: UpdateAgentInput): Promise<Agent> {
    logger.info({ agentId: id, input }, 'Updating agent');

    // Check if agent exists
    await this.getAgent(id);

    // Update agent
    const agent = await this.repository.update(id, input);

    logger.info({ agentId: id }, 'Agent updated successfully');

    return agent;
  }

  /**
   * Delete agent (soft delete)
   */
  async deleteAgent(id: string): Promise<void> {
    logger.info({ agentId: id }, 'Deleting agent');

    // Check if agent exists
    await this.getAgent(id);

    // TODO: Check if agent has pending transactions
    // const hasPendingTransactions = await this.checkPendingTransactions(id);
    // if (hasPendingTransactions) {
    //   throw new ConflictError('Cannot delete agent with pending transactions');
    // }

    // Soft delete
    await this.repository.delete(id);

    logger.info({ agentId: id }, 'Agent deleted successfully');
  }

  /**
   * Get agent balance
   *
   * Note: This delegates to the Ledger service (injected).
   * This shows how services communicate through dependency injection.
   */
  async getAgentBalance(id: string, ledgerService?: any): Promise<AgentBalance> {
    logger.debug({ agentId: id }, 'Getting agent balance');

    // Check if agent exists
    await this.getAgent(id);

    // If ledger service is provided, use it
    if (ledgerService) {
      return ledgerService.getAgentBalance(id);
    }

    // Fallback: Get from agent_balances table
    const balance = await this.repository.getBalance(id);

    return {
      agentId: id,
      available: balance.available,
      pending: balance.pending,
      currency: 'USD',
      lastUpdated: balance.lastUpdated,
    };
  }

  /**
   * Verify agent ownership
   */
  async verifyOwnership(agentId: string, organizationId: string): Promise<void> {
    const agent = await this.getAgent(agentId);

    if (agent.organizationId !== organizationId) {
      throw new UnauthorizedError('Cannot access this agent');
    }
  }
}

