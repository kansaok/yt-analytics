export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "OAUTH_SCOPE_MISSING"
  | "NOT_FOUND"
  | "CHANNEL_NOT_FOUND"
  | "VIDEO_NOT_FOUND"
  | "CHANNEL_LIMIT_REACHED"
  | "SYNC_IN_PROGRESS"
  | "RATE_LIMITED"
  | "YOUTUBE_QUOTA_EXCEEDED"
  | "YOUTUBE_UPSTREAM_ERROR"
  | "SYNC_WORKER_UNAVAILABLE"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  OAUTH_SCOPE_MISSING: 403,
  NOT_FOUND: 404,
  CHANNEL_NOT_FOUND: 404,
  VIDEO_NOT_FOUND: 404,
  CHANNEL_LIMIT_REACHED: 409,
  SYNC_IN_PROGRESS: 409,
  RATE_LIMITED: 429,
  YOUTUBE_QUOTA_EXCEEDED: 429,
  YOUTUBE_UPSTREAM_ERROR: 502,
  SYNC_WORKER_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
    public retryAfterSec?: number,
  ) {
    super(message);
  }
  get status() {
    return STATUS[this.code];
  }
}
