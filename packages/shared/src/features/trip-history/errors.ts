export class PermissionError extends Error {
  readonly kind = 'PermissionError' as const;
  constructor(message = 'You do not have permission to view this history.') {
    super(message);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends Error {
  readonly kind = 'NotFoundError' as const;
  constructor(message = 'Trip not found.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class NetworkError extends Error {
  readonly kind = 'NetworkError' as const;
  constructor(message = 'Network error — please check your connection and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class QueryIndexError extends Error {
  readonly kind = 'QueryIndexError' as const;
  constructor(message = 'Trip history is temporarily unavailable. Please try again shortly.') {
    super(message);
    this.name = 'QueryIndexError';
  }
}

export class TripHistoryServiceError extends Error {
  readonly kind = 'TripHistoryServiceError' as const;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TripHistoryServiceError';
    if (cause instanceof Error) {
      this.cause = cause;
    }
  }
}
