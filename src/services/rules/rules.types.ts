/**
 * Rules Service Types
 *
 * Types for the spending rules engine.
 */

export interface SpendingRule {
  id: string;
  organizationId: string;
  agentId?: string; // null = org-wide rule
  ruleType: RuleType;
  limitAmount?: number;
  limitCurrency: string;
  timeWindow?: TimeWindow;
  category?: string;
  conditions: Record<string, any>;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum RuleType {
  PER_TRANSACTION = 'per_transaction',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CATEGORY = 'category',
  VELOCITY = 'velocity',
  MERCHANT_WHITELIST = 'merchant_whitelist',
  MERCHANT_BLACKLIST = 'merchant_blacklist',
}

export enum TimeWindow {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export interface CreateRuleInput {
  organizationId: string;
  agentId?: string;
  ruleType: RuleType;
  limitAmount?: number;
  limitCurrency?: string;
  timeWindow?: TimeWindow;
  category?: string;
  conditions?: Record<string, any>;
  priority?: number;
}

export interface UpdateRuleInput {
  ruleType?: RuleType;
  limitAmount?: number;
  limitCurrency?: string;
  timeWindow?: TimeWindow;
  category?: string;
  conditions?: Record<string, any>;
  priority?: number;
  enabled?: boolean;
}

export interface SpendRequest {
  agentId: string;
  amount: number;
  currency: string;
  merchantId?: string;
  merchantName?: string;
  category?: string;
  metadata?: Record<string, any>;
}

export interface RuleEvaluationResult {
  approved: boolean;
  requiresApproval?: boolean;
  violatedRule?: SpendingRule;
  reason?: string;
  details?: any;
}

export enum RuleAction {
  APPROVE = 'approve',
  DENY = 'deny',
  REQUIRE_APPROVAL = 'require_approval',
}

