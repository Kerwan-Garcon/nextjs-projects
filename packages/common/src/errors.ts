/** Explicit error taxonomy. The HTTP layer maps these to status codes. */
export type AppErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UPSTREAM'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(what: string): AppError {
    return new AppError('NOT_FOUND', `${what} not found`);
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError('VALIDATION', message, details);
  }

  static forbidden(message: string): AppError {
    return new AppError('FORBIDDEN', message);
  }

  static conflict(message: string): AppError {
    return new AppError('CONFLICT', message);
  }
}

export const HTTP_STATUS: Record<AppErrorCode, number> = {
  NOT_FOUND: 404,
  VALIDATION: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UPSTREAM: 502,
  INTERNAL: 500,
};
