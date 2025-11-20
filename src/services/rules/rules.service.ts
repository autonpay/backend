/**
 * Rules Service
 *
 * Manages spending rules and evaluates spend requests against rules.
 * This service is self-contained and can be extracted into a microservice.
 */

import {
  SpendingRule,
  CreateRuleInput,
  UpdateRuleInput,
  SpendRequest,
  RuleEvaluationResult,
  RuleType,
} from './rules.types';
import { RulesRepository } from './rules.repository';
import { AgentService } from '../agents';
import { NotFoundError, UnauthorizedError, BadRequestError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { RulesEngine } from './rules-engine';

export class RulesService {
  private engine: RulesEngine;

  constructor(
    private repository: RulesRepository,
    private agentService: AgentService
  ) {
    this.engine = new RulesEngine();
  }

  /**
   * Evaluate a spend request against all applicable rules
   */
  async evaluateSpend(request: SpendRequest): Promise<RuleEvaluationResult> {
    logger.debug({ request }, 'Evaluating spend request');

    // Get all rules for this agent
    const rules = await this.getRulesForAgent(request.agentId);

    if (rules.length === 0) {
      logger.debug('No rules found, auto-approving');
      return { approved: true };
    }

    // Evaluate rules in priority order
    const result = await this.engine.evaluate(request, rules);

    logger.info({
      agentId: request.agentId,
      approved: result.approved,
      requiresApproval: result.requiresApproval,
    }, 'Rule evaluation complete');

    return result;
  }

  /**
   * Get all rules for an agent (including org-wide rules)
   */
  async getRulesForAgent(agentId: string): Promise<SpendingRule[]> {
    logger.debug({ agentId }, 'Getting rules for agent');

    // Get agent to find organizationId
    const agent = await this.agentService.getAgent(agentId);

    // Get agent-specific rules + org-wide rules
    return this.repository.findByAgent(agentId, agent.organizationId);
  }

  /**
   * Create a new spending rule
   */
  async createRule(input: CreateRuleInput): Promise<SpendingRule> {
    logger.info({ input }, 'Creating spending rule');

    // Validate rule configuration
    this.validateRuleInput(input);

    const rule = await this.repository.create(input);

    logger.info({ ruleId: rule.id }, 'Spending rule created');

    return rule;
  }

  /**
   * Update spending rule
   */
  async updateRule(id: string, updates: UpdateRuleInput): Promise<SpendingRule> {
    logger.info({ ruleId: id, updates }, 'Updating spending rule');

    const rule = await this.repository.findById(id);
    if (!rule) {
      throw new NotFoundError('SpendingRule', id);
    }

    // Validate if updating rule type
    if (updates.ruleType !== undefined || updates.limitAmount !== undefined) {
      const input: CreateRuleInput = {
        organizationId: rule.organizationId,
        agentId: rule.agentId,
        ruleType: updates.ruleType || rule.ruleType,
        limitAmount: updates.limitAmount !== undefined ? updates.limitAmount : rule.limitAmount,
        limitCurrency: updates.limitCurrency || rule.limitCurrency,
        timeWindow: updates.timeWindow || rule.timeWindow,
        category: updates.category || rule.category,
        conditions: updates.conditions || rule.conditions,
        priority: updates.priority || rule.priority,
      };
      this.validateRuleInput(input);
    }

    return this.repository.update(id, updates);
  }

  /**
   * Delete spending rule
   */
  async deleteRule(id: string): Promise<void> {
    logger.info({ ruleId: id }, 'Deleting spending rule');

    const rule = await this.repository.findById(id);
    if (!rule) {
      throw new NotFoundError('SpendingRule', id);
    }

    await this.repository.delete(id);
  }

  /**
   * Get rule by ID
   */
  async getRule(id: string): Promise<SpendingRule> {
    logger.debug({ ruleId: id }, 'Getting rule');

    const rule = await this.repository.findById(id);
    if (!rule) {
      throw new NotFoundError('SpendingRule', id);
    }

    return rule;
  }

  /**
   * List rules for organization
   */
  async listRules(organizationId: string): Promise<SpendingRule[]> {
    logger.debug({ organizationId }, 'Listing rules');

    return this.repository.findByOrganization(organizationId);
  }

  /**
   * Verify rule ownership
   */
  async verifyOwnership(ruleId: string, organizationId: string): Promise<void> {
    const hasAccess = await this.repository.verifyOwnership(ruleId, organizationId);
    if (!hasAccess) {
      throw new UnauthorizedError('Cannot access this rule');
    }
  }

  /**
   * Validate rule input
   */
  private validateRuleInput(input: CreateRuleInput): void {
    if (input.ruleType === RuleType.PER_TRANSACTION && !input.limitAmount) {
      throw new BadRequestError('Per-transaction rules require a limit amount');
    }

    if (
      [RuleType.DAILY, RuleType.WEEKLY, RuleType.MONTHLY].includes(input.ruleType) &&
      !input.limitAmount
    ) {
      throw new BadRequestError('Time-based rules require a limit amount');
    }

    if (input.ruleType === RuleType.CATEGORY && !input.category) {
      throw new BadRequestError('Category rules require a category');
    }
  }
}

