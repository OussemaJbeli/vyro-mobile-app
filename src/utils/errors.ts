/** Application errors with human messages (FS §57). */
export type AppErrorCode =
  | 'DB_WRITE_FAILED'
  | 'DB_READ_FAILED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'FILE_IO'
  | 'IMPORT_INVALID'
  | 'NOTIFICATION_FAILED'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** i18n key in the `errors` namespace; defaults to the code's generic message. */
  readonly userMessageKey: string;
  readonly context: Record<string, unknown>;
  override readonly cause: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    opts: { userMessageKey?: string; cause?: unknown; context?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.userMessageKey = opts.userMessageKey ?? `errors:${code}`;
    this.cause = opts.cause;
    this.context = opts.context ?? {};
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

/** Wraps anything thrown into an AppError, keeping the original as `cause`. */
export function toAppError(e: unknown, code: AppErrorCode = 'UNKNOWN'): AppError {
  if (isAppError(e)) return e;
  const message = e instanceof Error ? e.message : String(e);
  return new AppError(code, message, { cause: e });
}

type Translate = (key: string) => string;

/** Translated, human text for any error. Technical detail never reaches the user. */
export function toUserMessage(e: unknown, t: Translate): string {
  return t(toAppError(e).userMessageKey);
}

/** Explicit success/failure for repositories and services, so callers must handle failure. */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E = AppError>(error: E): Result<never, E> => ({ ok: false, error });
