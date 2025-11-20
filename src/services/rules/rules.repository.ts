/**
 * Rules Repository
 *
 * Data access layer for Rules service.
 * Handles all database operations for spending rules.
 */

import { prisma } from '../../database/client';
import { SpendingRule, CreateRuleInput, UpdateRuleInput } from './rules.types';

export class RulesRepository {
  /**
   * Find rule by ID
   */
  async findById(id: string): Promise<SpendingRule | null> {
    const rule = await prisma.spendingRule.findUnique({
      where: { id },
    });

    if (!rule) return null;

    return this.mapToSpendingRule(rule);
  }

  /**
   * Find rules by organization
   */
  async findByOrganization(organizationId: string): Promise<SpendingRule[]> {
    const rules = await prisma.spendingRule.findMany({
      where: { organizationId },
      orderBy: { priority: 'asc' },
    });

    return rules.map(rule => this.mapToSpendingRule(rule));
  }

  /**
   * Find rules for an agent (agent-specific + org-wide)
   */
  async findByAgent(agentId: string, organizationId: string): Promise<SpendingRule[]> {
    const rules = await prisma.spendingRule.findMany({
      where: {
        organizationId,
        enabled: true,
        OR: [
          { agentId },
          { agentId: null }, // Org-wide rules
        ],
      },
      orderBy: { priority: 'asc' },
    });

    return rules.map(rule => this.mapToSpendingRule(rule));
  }

  /**
   * Create new rule
   */
  async create(input: CreateRuleInput): Promise<SpendingRule> {
    const rule = await prisma.spendingRule.create({
      data: {
        organizationId: input.organizationId,
        agentId: input.agentId,
        ruleType: input.ruleType,
        limitAmount: input.limitAmount ? input.limitAmount.toString() : null,
        limitCurrency: input.limitCurrency || 'USD',
        timeWindow: input.timeWindow || null,
        category: input.category || null,
        conditions: input.conditions || {},
        priority: input.priority || 100,
        enabled: true,
      },
    });

    return this.mapToSpendingRule(rule);
  }

  /**
   * Update rule
   */
  async update(id: string, input: UpdateRuleInput): Promise<SpendingRule> {
    const updateData: any = {};

    if (input.ruleType !== undefined) updateData.ruleType = input.ruleType;
    if (input.limitAmount !== undefined) {
      updateData.limitAmount = input.limitAmount.toString();
    }
    if (input.limitCurrency !== undefined) updateData.limitCurrency = input.limitCurrency;
    if (input.timeWindow !== undefined) updateData.timeWindow = input.timeWindow;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.conditions !== undefined) updateData.conditions = input.conditions;
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;

    const rule = await prisma.spendingRule.update({
      where: { id },
      data: updateData,
    });

    return this.mapToSpendingRule(rule);
  }

  /**
   * Delete rule
   */
  async delete(id: string): Promise<void> {
    await prisma.spendingRule.delete({
      where: { id },
    });
  }

  /**
   * Check if rule exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await prisma.spendingRule.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Verify rule belongs to organization
   */
  async verifyOwnership(id: string, organizationId: string): Promise<boolean> {
    const rule = await prisma.spendingRule.findFirst({
      where: {
        id,
        organizationId,
      },
    });
    return rule !== null;
  }

  /**
   * Get spending in time window for an agent
   * TODO: Implement when transactions are available
   */
  async getSpendingInWindow(
    _agentId: string,
    _timeWindow: string,
    _startDate: Date
  ): Promise<number> {
    // This will be used by the rules engine to check time-based limits
    // For now, we'll query transactions (when they're implemented)
    // For MVP, return 0 as placeholder
    return 0;
  }

  /**
   * Get category spending in time window
   * TODO: Implement when transactions are available
   */
  async getCategorySpending(
    _agentId: string,
    _category: string,
    _timeWindow: string,
    _startDate: Date
  ): Promise<number> {
    // Placeholder - will be implemented when transactions are ready
    return 0;
  }

  /**
   * Get recent transaction count for velocity checks
   * TODO: Implement when transactions are available
   */
  async getRecentTransactionCount(
    _agentId: string,
    _timeWindowMinutes: number
  ): Promise<number> {
    // Placeholder - will be implemented when transactions are ready
    return 0;
  }

  /**
   * Map Prisma model to SpendingRule type
   */
  private mapToSpendingRule(rule: any): SpendingRule {
    return {
      id: rule.id,
      organizationId: rule.organizationId,
      agentId: rule.agentId || undefined,
      ruleType: rule.ruleType,
      limitAmount: rule.limitAmount ? Number(rule.limitAmount) : undefined,
      limitCurrency: rule.limitCurrency,
      timeWindow: rule.timeWindow || undefined,
      category: rule.category || undefined,
      conditions: rule.conditions as Record<string, any>,
      priority: rule.priority,
      enabled: rule.enabled,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}

