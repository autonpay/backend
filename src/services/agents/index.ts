/**
 * Agent Service - Public API
 *
 * This is the only file that should be imported by other services.
 * It exports the public interface of the Agent service.
 */

export { AgentService } from './agent.service';
export { AgentRepository } from './agent.repository';
export * from './agent.types';

// Example usage by other services:
// import { AgentService, Agent } from '@/services/agents';

