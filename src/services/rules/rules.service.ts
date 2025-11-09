/**
 * Rules Service
 *
 * Manages spending rules and evaluates spend requests against rules.
 * This service is self-contained and can be extracted into a microservice.
 */

import {
  SpendingRule,
  CreateRuleInput,
  SpendRequest,
  RuleEvaluationResult,
  RuleType,
} from './rules.types';
import { logger } from '../../shared/logger';
import { RulesEngine } from './rules-engine';

export class RulesService {
  private engine: RulesEngine;

  constructor() {
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

    // TODO: Implement Prisma query
    // Get agent-specific rules + org-wide rules
    // return prisma.spendingRule.findMany({
    //   where: {
    //     OR: [
    //       { agentId },
    //       { agentId: null }
    //     ],
    //     enabled: true,
    //   },
    //   orderBy: { priority: 'asc' },
    // });

    return [];
  }

  /**
   * Create a new spending rule
   */
  async createRule(input: CreateRuleInput): Promise<SpendingRule> {
    logger.info({ input }, 'Creating spending rule');

    // Validate rule configuration
    this.validateRuleInput(input);

    // TODO: Implement Prisma query
    // const rule = await prisma.spendingRule.create({
    //   data: {
    //     ...input,
    //     limitCurrency: input.limitCurrency || 'USD',
    //     priority: input.priority || 100,
    //     enabled: true,
    //     conditions: input.conditions || {},
    //   },
    // });

    logger.info({ ruleId: 'rule.id' }, 'Spending rule created');

    // TODO: Invalidate cache
    // await this.invalidateRulesCache(input.agentId);

    throw new Error('Not implemented');
  }

  /**
   * Update spending rule
   */
  async updateRule(id: string, updates: Partial<CreateRuleInput>): Promise<SpendingRule> {
    logger.info({ ruleId: id, updates }, 'Updating spending rule');

    // TODO: Implement Prisma query
    // const rule = await prisma.spendingRule.update({
    //   where: { id },
    //   data: updates,
    // });

    // TODO: Invalidate cache

    throw new Error('Not implemented');
  }

  /**
   * Delete spending rule
   */
  async deleteRule(id: string): Promise<void> {
    logger.info({ ruleId: id }, 'Deleting spending rule');

    // TODO: Implement Prisma query
    // await prisma.spendingRule.delete({ where: { id } });

    // TODO: Invalidate cache

    throw new Error('Not implemented');
  }

  /**
   * Validate rule input
   */
  private validateRuleInput(input: CreateRuleInput): void {
    if (input.ruleType === RuleType.PER_TRANSACTION && !input.limitAmount) {
      throw new Error('Per-transaction rules require a limit amount');
    }

    if (
      [RuleType.DAILY, RuleType.WEEKLY, RuleType.MONTHLY].includes(input.ruleType) &&
      !input.limitAmount
    ) {
      throw new Error('Time-based rules require a limit amount');
    }

    if (input.ruleType === RuleType.CATEGORY && !input.category) {
      throw new Error('Category rules require a category');
    }
  }
}

