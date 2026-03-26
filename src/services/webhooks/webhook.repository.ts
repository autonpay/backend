/**
 * Webhook Repository
 *
 * Data access layer for Webhook service.
 * Handles all database operations for webhooks.
 */

import { prisma } from '../../database/client';
import { Webhook, CreateWebhookInput, UpdateWebhookInput, ListWebhooksQuery, WebhookEvent } from './webhook.types';
import crypto from 'crypto';

export class WebhookRepository {
  /**
   * Find webhook by ID
   */
  async findById(id: string): Promise<Webhook | null> {
    const webhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) return null;

    return this.mapToWebhook(webhook);
  }

  /**
   * Find webhooks by organization
   */
  async findByOrganization(query: ListWebhooksQuery): Promise<Webhook[]> {
    const webhooks = await prisma.webhook.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.enabled !== undefined && { enabled: query.enabled }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks.map((webhook: any) => this.mapToWebhook(webhook));
  }

  /**
   * Find enabled webhooks for organization that listen to a specific event
   */
  async findEnabledByEvent(organizationId: string, event: string): Promise<Webhook[]> {
    const webhooks = await prisma.webhook.findMany({
      where: {
        organizationId,
        enabled: true,
        events: {
          has: event, // Check if event is in the events array
        },
      },
    });

    return webhooks.map((webhook: any) => this.mapToWebhook(webhook));
  }

  /**
   * Create new webhook
   */
  async create(input: CreateWebhookInput): Promise<Webhook> {
    // Generate secret if not provided (32 random bytes, base64 encoded)
    const secret = input.secret || crypto.randomBytes(32).toString('base64');

    const webhook = await prisma.webhook.create({
      data: {
        organizationId: input.organizationId,
        url: input.url,
        events: input.events,
        secret,
        enabled: true,
      },
    });

    return this.mapToWebhook(webhook);
  }

  /**
   * Update webhook
   */
  async update(id: string, input: UpdateWebhookInput): Promise<Webhook> {
    const webhook = await prisma.webhook.update({
      where: { id },
      data: {
        ...(input.url && { url: input.url }),
        ...(input.events && { events: input.events }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
      },
    });

    return this.mapToWebhook(webhook);
  }

  /**
   * Delete webhook
   */
  async delete(id: string): Promise<void> {
    await prisma.webhook.delete({
      where: { id },
    });
  }

  /**
   * Update webhook last triggered timestamp
   */
  async updateLastTriggered(id: string): Promise<void> {
    await prisma.webhook.update({
      where: { id },
      data: {
        lastTriggeredAt: new Date(),
      },
    });
  }

  /**
   * Increment webhook failure count
   */
  async incrementFailureCount(id: string): Promise<void> {
    await prisma.webhook.update({
      where: { id },
      data: {
        failureCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Reset webhook failure count
   */
  async resetFailureCount(id: string): Promise<void> {
    await prisma.webhook.update({
      where: { id },
      data: {
        failureCount: 0,
      },
    });
  }

  /**
   * Create webhook event log entry
   */
  async createEvent(input: {
    webhookId: string;
    eventType: string;
    payload: any;
  }): Promise<WebhookEvent> {
    const event = await prisma.webhookEvent.create({
      data: {
        webhookId: input.webhookId,
        eventType: input.eventType,
        payload: input.payload,
        delivered: false,
        attempts: 0,
      },
    });

    return this.mapToWebhookEvent(event);
  }

  /**
   * Update webhook event delivery status
   */
  async updateEventDelivery(
    eventId: string,
    data: {
      responseStatus: number | null;
      responseBody: string | null;
      delivered: boolean;
      attempts: number;
    }
  ): Promise<void> {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        responseStatus: data.responseStatus,
        responseBody: data.responseBody,
        delivered: data.delivered,
        attempts: data.attempts,
        ...(data.delivered && { deliveredAt: new Date() }),
      },
    });
  }

  /**
   * Verify webhook ownership
   */
  async verifyOwnership(webhookId: string, organizationId: string): Promise<boolean> {
    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        organizationId,
      },
    });

    return !!webhook;
  }

  /**
   * Map Prisma webhook to domain model
   */
  private mapToWebhook(webhook: any): Webhook {
    return {
      id: webhook.id,
      organizationId: webhook.organizationId,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      enabled: webhook.enabled,
      lastTriggeredAt: webhook.lastTriggeredAt,
      failureCount: webhook.failureCount,
      createdAt: webhook.createdAt,
    };
  }

  /**
   * Map Prisma webhook event to domain model
   */
  private mapToWebhookEvent(event: any): WebhookEvent {
    return {
      id: event.id,
      webhookId: event.webhookId,
      eventType: event.eventType,
      payload: event.payload,
      responseStatus: event.responseStatus,
      responseBody: event.responseBody,
      delivered: event.delivered,
      attempts: event.attempts,
      createdAt: event.createdAt,
      deliveredAt: event.deliveredAt,
    };
  }
}

