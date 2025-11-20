/**
 * Rules Engine
 *
 * Core logic for evaluating spending rules.
 * This is the "brain" of the rules system.
 */

import {
  SpendRequest,
  SpendingRule,
  RuleEvaluationResult,
  RuleAction,
  RuleType,
} from './rules.types';
import { RulesRepository } from './rules.repository';
import { logger } from '../../shared/logger';
import { subDays, subWeeks, subMonths } from 'date-fns';

export class RulesEngine {
  constructor(private repository: RulesRepository) {}
  /**
   * Evaluate spend request against all rules
   */
  async evaluate(
    request: SpendRequest,
    rules: SpendingRule[]
  ): Promise<RuleEvaluationResult> {
    // Sort rules by priority (lower number = higher priority)
    const sortedRules = rules.sort((a, b) => a.priority - b.priority);

    // Evaluate each rule
    for (const rule of sortedRules) {
      const action = await this.evaluateRule(request, rule);

      if (action === RuleAction.DENY) {
        return {
          approved: false,
          violatedRule: rule,
          reason: this.getRejectionReason(rule, request),
        };
      }

      if (action === RuleAction.REQUIRE_APPROVAL) {
        return {
          approved: false,
          requiresApproval: true,
          violatedRule: rule,
          reason: 'Transaction requires manual approval',
        };
      }
    }

    // All rules passed
    return { approved: true };
  }

  /**
   * Evaluate a single rule
   */
  private async evaluateRule(
    request: SpendRequest,
    rule: SpendingRule
  ): Promise<RuleAction> {
    switch (rule.ruleType) {
      case RuleType.PER_TRANSACTION:
        return this.evaluatePerTransactionRule(request, rule);

      case RuleType.DAILY:
      case RuleType.WEEKLY:
      case RuleType.MONTHLY:
        return this.evaluateTimeWindowRule(request, rule);

      case RuleType.CATEGORY:
        return this.evaluateCategoryRule(request, rule);

      case RuleType.VELOCITY:
        return this.evaluateVelocityRule(request, rule);

      case RuleType.MERCHANT_WHITELIST:
        return this.evaluateMerchantWhitelist(request, rule);

      case RuleType.MERCHANT_BLACKLIST:
        return this.evaluateMerchantBlacklist(request, rule);

      default:
        logger.warn({ ruleType: rule.ruleType }, 'Unknown rule type, skipping');
        return RuleAction.APPROVE;
    }
  }

  /**
   * Evaluate per-transaction limit
   */
  private evaluatePerTransactionRule(
    request: SpendRequest,
    rule: SpendingRule
  ): RuleAction {
    if (!rule.limitAmount) return RuleAction.APPROVE;

    if (request.amount > rule.limitAmount) {
      // Check if rule has approval threshold
      const approvalThreshold = rule.conditions?.approvalThreshold;
      if (approvalThreshold && request.amount <= approvalThreshold) {
        return RuleAction.REQUIRE_APPROVAL;
      }
      return RuleAction.DENY;
    }

    return RuleAction.APPROVE;
  }

  /**
   * Evaluate time-window spending limits (daily, weekly, monthly)
   */
  private async evaluateTimeWindowRule(
    request: SpendRequest,
    rule: SpendingRule
  ): Promise<RuleAction> {
    if (!rule.limitAmount || !rule.timeWindow) return RuleAction.APPROVE;

    // Calculate start date based on time window
    let startDate: Date;
    switch (rule.timeWindow) {
      case 'daily':
        startDate = subDays(new Date(), 1);
        break;
      case 'weekly':
        startDate = subWeeks(new Date(), 1);
        break;
      case 'monthly':
        startDate = subMonths(new Date(), 1);
        break;
      default:
        startDate = new Date();
    }

    const spending = await this.repository.getSpendingInWindow(
      request.agentId,
      rule.timeWindow,
      startDate
    );

    if (spending + request.amount > rule.limitAmount) {
      return RuleAction.DENY;
    }

    return RuleAction.APPROVE;
  }

  /**
   * Evaluate category-based spending limits
   */
  private async evaluateCategoryRule(
    request: SpendRequest,
    rule: SpendingRule
  ): Promise<RuleAction> {
    // Only apply if categories match
    if (request.category !== rule.category) {
      return RuleAction.APPROVE;
    }

    if (!rule.limitAmount || !rule.timeWindow) return RuleAction.APPROVE;

    // Calculate start date based on time window
    let startDate: Date;
    switch (rule.timeWindow) {
      case 'daily':
        startDate = subDays(new Date(), 1);
        break;
      case 'weekly':
        startDate = subWeeks(new Date(), 1);
        break;
      case 'monthly':
        startDate = subMonths(new Date(), 1);
        break;
      default:
        startDate = new Date();
    }

    const categorySpending = await this.repository.getCategorySpending(
      request.agentId,
      rule.category!,
      rule.timeWindow,
      startDate
    );

    if (categorySpending + request.amount > rule.limitAmount) {
      return RuleAction.DENY;
    }

    return RuleAction.APPROVE;
  }

  /**
   * Evaluate velocity (transaction frequency) limits
   */
  private async evaluateVelocityRule(
    request: SpendRequest,
    rule: SpendingRule
  ): Promise<RuleAction> {
    const maxTransactions = rule.conditions?.maxTransactions || 10;
    const timeWindowMinutes = rule.conditions?.timeWindowMinutes || 60;

    logger.debug({ maxTransactions, timeWindowMinutes }, 'Evaluating velocity rule');

    const recentCount = await this.repository.getRecentTransactionCount(
      request.agentId,
      timeWindowMinutes
    );

    if (recentCount >= maxTransactions) {
      return RuleAction.DENY;
    }

    return RuleAction.APPROVE;
  }

  /**
   * Evaluate merchant whitelist
   */
  private evaluateMerchantWhitelist(
    request: SpendRequest,
    rule: SpendingRule
  ): RuleAction {
    const whitelist = rule.conditions?.merchants || [];

    if (!request.merchantId) {
      return RuleAction.DENY; // Require merchant if whitelist enabled
    }

    if (!whitelist.includes(request.merchantId)) {
      return RuleAction.DENY;
    }

    return RuleAction.APPROVE;
  }

  /**
   * Evaluate merchant blacklist
   */
  private evaluateMerchantBlacklist(
    request: SpendRequest,
    rule: SpendingRule
  ): RuleAction {
    const blacklist = rule.conditions?.merchants || [];

    if (request.merchantId && blacklist.includes(request.merchantId)) {
      return RuleAction.DENY;
    }

    return RuleAction.APPROVE;
  }

  /**
   * Generate human-readable rejection reason
   */
  private getRejectionReason(rule: SpendingRule, request: SpendRequest): string {
    switch (rule.ruleType) {
      case RuleType.PER_TRANSACTION:
        return `Transaction amount ($${request.amount}) exceeds per-transaction limit ($${rule.limitAmount})`;

      case RuleType.DAILY:
        return `Transaction would exceed daily spending limit ($${rule.limitAmount})`;

      case RuleType.WEEKLY:
        return `Transaction would exceed weekly spending limit ($${rule.limitAmount})`;

      case RuleType.MONTHLY:
        return `Transaction would exceed monthly spending limit ($${rule.limitAmount})`;

      case RuleType.CATEGORY:
        return `Transaction would exceed ${rule.category} category limit ($${rule.limitAmount})`;

      case RuleType.VELOCITY:
        return 'Too many transactions in a short time period';

      case RuleType.MERCHANT_WHITELIST:
        return 'Merchant is not in the approved whitelist';

      case RuleType.MERCHANT_BLACKLIST:
        return 'Merchant is blacklisted';

      default:
        return 'Transaction violates spending rule';
    }
  }
}

