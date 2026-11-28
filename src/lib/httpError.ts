export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const CONNECTION_ERROR_CODES = new Set<string>([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "57P01",
  "57P02",
  "57P03",
  "53300",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
]);

const CONNECTION_ERROR_PATTERN =
  /timeout exceeded when trying to connect|connection terminated|connection refused|getaddrinfo|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i;

/**
 * True for errors that mean the database could not be reached.
 * Business-rule errors (HttpError) must never match this.
 */
export function isDatabaseConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as Error & { code?: unknown }).code;
  if (typeof code === "string" && CONNECTION_ERROR_CODES.has(code)) {
    return true;
  }

  return CONNECTION_ERROR_PATTERN.test(error.message);
}

/**
 * True when PostgreSQL could not acquire a row lock in time.
 * This is a transient capacity problem, not a client validation error.
 */
export function isDatabaseBusyError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as Error & { code?: unknown }).code === "55P03"
  );
}
