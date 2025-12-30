export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(available: number, required: number) {
    super(
      `Insufficient balance. Available: ${available}, Required: ${required}`,
      402,
      'INSUFFICIENT_BALANCE',
      { available, required }
    );
  }
}

export class RuleViolationError extends AppError {
  constructor(message: string, rule?: any) {
    super(message, 403, 'RULE_VIOLATION', { rule });
  }
}

export class BlockchainError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'BLOCKCHAIN_ERROR', details);
  }
}

export * from './error-classifier';

