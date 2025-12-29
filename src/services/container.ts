/**
 * Dependency Injection Container
 *
 * This is where all services are instantiated and wired together.
 * This makes it easy to:
 * - Test services in isolation (mock dependencies)
 * - Extract services into microservices later
 * - Change implementations without touching business logic
 */

import { AgentService, AgentRepository } from './agents';
import { RulesService, RulesRepository } from './rules';
import { TransactionOrchestrator, TransactionRepository } from './transactions';
import { LedgerService, LedgerRepository } from './ledger';
import { OrganizationService, OrganizationRepository } from './organizations';
import { UserService, UserRepository } from './users';
import { AuthService } from './auth';
import { BlockchainService } from './blockchain';
import { WebhookService } from './webhooks';
import { WebhookRepository } from './webhooks/webhook.repository';

/**
 * Service Container
 *
 * This class holds all service instances.
 * It's a singleton that creates services on first access.
 */
class ServiceContainer {
  private static instance: ServiceContainer;

  // Service instances
  private _organizationService?: OrganizationService;
  private _userService?: UserService;
  private _authService?: AuthService;
  private _agentService?: AgentService;
  private _rulesService?: RulesService;
  private _ledgerService?: LedgerService;
  private _blockchainService?: BlockchainService;
  private _webhookRepository?: WebhookRepository;
  private _webhookService?: WebhookService;
  private _transactionOrchestrator?: TransactionOrchestrator;

  private constructor() {}

  /**
   * Get container instance (singleton)
   */
  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * Get Organization Service
   */
  get organizationService(): OrganizationService {
    if (!this._organizationService) {
      const repository = new OrganizationRepository();
      this._organizationService = new OrganizationService(repository);
    }
    return this._organizationService;
  }

  /**
   * Get User Service
   */
  get userService(): UserService {
    if (!this._userService) {
      const repository = new UserRepository();
      this._userService = new UserService(repository);
    }
    return this._userService;
  }

  /**
   * Get Auth Service
   */
  get authService(): AuthService {
    if (!this._authService) {
      this._authService = new AuthService(this.userService);
    }
    return this._authService;
  }

  /**
   * Get Agent Service
   */
  get agentService(): AgentService {
    if (!this._agentService) {
      const repository = new AgentRepository();
      this._agentService = new AgentService(repository);
    }
    return this._agentService;
  }

  /**
   * Get Rules Service
   */
  get rulesService(): RulesService {
    if (!this._rulesService) {
      // Get transaction repository for time-window queries
      const transactionRepository = new TransactionRepository();
      const repository = new RulesRepository(transactionRepository);
      this._rulesService = new RulesService(repository, this.agentService);
    }
    return this._rulesService;
  }

  /**
   * Get Ledger Service
   */
  get ledgerService(): LedgerService {
    if (!this._ledgerService) {
      const repository = new LedgerRepository();
      this._ledgerService = new LedgerService(repository);
    }
    return this._ledgerService;
  }

  /**
   * Get Blockchain Service
   */
  get blockchainService(): BlockchainService {
    if (!this._blockchainService) {
      this._blockchainService = new BlockchainService(this.agentService);
    }
    return this._blockchainService;
  }

  /**
   * Get Webhook Repository
   */
  get webhookRepository(): WebhookRepository {
    if (!this._webhookRepository) {
      this._webhookRepository = new WebhookRepository();
    }
    return this._webhookRepository;
  }

  /**
   * Get Webhook Service
   */
  get webhookService(): WebhookService {
    if (!this._webhookService) {
      this._webhookService = new WebhookService(this.webhookRepository);
    }
    return this._webhookService;
  }

  /**
   * Get Transaction Orchestrator
   */
  get transactionOrchestrator(): TransactionOrchestrator {
    if (!this._transactionOrchestrator) {
      const repository = new TransactionRepository();
      this._transactionOrchestrator = new TransactionOrchestrator(
        repository,
        this.agentService,
        this.rulesService,
        this.ledgerService,
        this.blockchainService,
        this.webhookService
      );
    }
    return this._transactionOrchestrator;
  }

  /**
   * Reset container (useful for testing)
   */
  reset(): void {
    this._organizationService = undefined;
    this._userService = undefined;
    this._authService = undefined;
    this._agentService = undefined;
    this._rulesService = undefined;
    this._ledgerService = undefined;
    this._blockchainService = undefined;
    this._webhookRepository = undefined;
    this._webhookService = undefined;
    this._transactionOrchestrator = undefined;
  }
}

// Export singleton instance
export const container = ServiceContainer.getInstance();

// Export class for testing
export { ServiceContainer };

