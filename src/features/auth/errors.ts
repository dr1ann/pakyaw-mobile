/**
 * Domain error classes for the auth feature.
 * Services translate raw FirebaseError codes into these before surfacing
 * to hooks/components. Raw Firebase error codes (auth/email-already-in-use,
 * auth/network-request-failed, etc.) must never reach the UI.
 */

export class AuthError extends Error {
  readonly kind = 'AuthError' as const;
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ValidationError extends Error {
  readonly kind = 'ValidationError' as const;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  readonly kind = 'NetworkError' as const;
  constructor(
    message = 'Network error — please check your connection and try again.',
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class PermissionError extends Error {
  readonly kind = 'PermissionError' as const;
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends Error {
  readonly kind = 'NotFoundError' as const;
  constructor(message = 'The requested resource was not found.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export type DomainError =
  | AuthError
  | ValidationError
  | NetworkError
  | PermissionError
  | NotFoundError;
