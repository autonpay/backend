/**
 * Webhook Types
 */

export interface Webhook {
  id: string;
  organizationId: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  lastTriggeredAt: Date | null;
  failureCount: number;
  createdAt: Date;
}

export interface CreateWebhookInput {
  organizationId: string;
  url: string;
  events: string[];
  secret?: string; // Optional, will generate if not provided
}

export interface UpdateWebhookInput {
  url?: string;
  events?: string[];
  enabled?: boolean;
}

export interface ListWebhooksQuery {
  organizationId: string;
  enabled?: boolean;
}

export interface WebhookEvent {
  id: string;
  webhookId: string;
  eventType: string;
  payload: any;
  responseStatus: number | null;
  responseBody: string | null;
  delivered: boolean;
  attempts: number;
  createdAt: Date;
  deliveredAt: Date | null;
}

