/**
 * HTTP Response Helpers
 *
 * Provides helper functions to build consistent JSON responses.
 */

import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown> | PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  details?: unknown;
}

/**
 * Send a standard success response (200 OK)
 */
export function ok<T>(res: Response, data: T, message?: string) {
  return res.status(200).json({
    success: true,
    data,
    ...(message && { message }),
  } as ApiSuccessResponse<T>);
}

/**
 * Send a created response (201 Created)
 */
export function created<T>(res: Response, data: T, message?: string) {
  return res.status(201).json({
    success: true,
    data,
    ...(message && { message }),
  } as ApiSuccessResponse<T>);
}

/**
 * Send a no content response (204 No Content)
 */
export function noContent(res: Response) {
  return res.status(204).send();
}

/**
 * Send a paginated response (200 OK)
 */
export function paginated<T>(
  res: Response,
  data: T[],
  pagination: { page: number; limit: number; total: number },
  message?: string
) {
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const meta: PaginationMeta = {
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    totalPages,
    hasNext: pagination.page < totalPages,
    hasPrev: pagination.page > 1,
  };

  return res.status(200).json({
    success: true,
    data,
    ...(message && { message }),
    meta,
  } as ApiSuccessResponse<T[]>);
}

/**
 * Send a bad request error (400)
 */
export function badRequest(res: Response, message: string, details?: unknown) {
  const response: ApiErrorResponse = {
    success: false,
    error: 'BAD_REQUEST',
    message,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return res.status(400).json(response);
}

/**
 * Send an unauthorized error (401)
 */
export function unauthorized(res: Response, message: string = 'Authentication required') {
  return res.status(401).json({
    success: false,
    error: 'UNAUTHORIZED',
    message,
  } as ApiErrorResponse);
}

/**
 * Send a forbidden error (403)
 */
export function forbidden(res: Response, message: string = 'Insufficient permissions') {
  return res.status(403).json({
    success: false,
    error: 'FORBIDDEN',
    message,
  } as ApiErrorResponse);
}

/**
 * Send a not found error (404)
 */
export function notFound(res: Response, resource: string = 'Resource', id?: string) {
  const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
  return res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message,
  } as ApiErrorResponse);
}

/**
 * Send a conflict error (409)
 */
export function conflict(res: Response, message: string, details?: unknown) {
  const response: ApiErrorResponse = {
    success: false,
    error: 'CONFLICT',
    message,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return res.status(409).json(response);
}

/**
 * Send an internal server error (500)
 */
export function internalError(res: Response, message: string = 'An unexpected error occurred') {
  return res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message,
  } as ApiErrorResponse);
}
