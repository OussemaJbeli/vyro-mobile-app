/**
 * Privacy-safe logger (FS §63). Sensitive values are redacted before anything is stored
 * or printed. Release builds keep only warn/error in a small in-memory ring buffer
 * (viewable in dev tools, exportable in diagnostics). No third-party SDKs.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
  at: string;
  level: LogLevel;
  message: string;
  context?: unknown;
};

const RING_SIZE = 200;
const SENSITIVE_KEY =
  /weight|kg|lb|value|measurement|photo|uri|path|apikey|api_key|token|pin|note|secret|password/i;
const REDACTED = '[redacted]';

const ring: LogEntry[] = [];
const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
let echo = true;
let minLevel: LogLevel = typeof __DEV__ !== 'undefined' && __DEV__ ? 'debug' : 'warn';

/** Deep-copies `input`, replacing values of sensitive keys. Handles cycles and Errors. */
export function redact(input: unknown, seen = new WeakSet<object>()): unknown {
  if (input === null || typeof input !== 'object') return input;
  if (seen.has(input)) return '[circular]';
  seen.add(input);
  if (input instanceof Error) return { name: input.name, message: input.message };
  if (Array.isArray(input)) return input.map((v) => redact(v, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redact(v, seen);
  }
  return out;
}

function write(level: LogLevel, message: string, context?: unknown) {
  if (ORDER[level] < ORDER[minLevel]) return;
  const entry: LogEntry = {
    at: new Date().toISOString(),
    level,
    message,
    ...(context === undefined ? {} : { context: redact(context) }),
  };
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();
  if (echo && typeof __DEV__ !== 'undefined' && __DEV__) {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`[${level}] ${message}`, entry.context ?? '');
  }
}

export const logger = {
  debug: (message: string, context?: unknown) => write('debug', message, context),
  info: (message: string, context?: unknown) => write('info', message, context),
  warn: (message: string, context?: unknown) => write('warn', message, context),
  error: (message: string, context?: unknown) => write('error', message, context),
  /** Snapshot of the ring buffer (already redacted). */
  entries: (): LogEntry[] => [...ring],
  clear: () => {
    ring.length = 0;
  },
  setLevel: (level: LogLevel) => {
    minLevel = level;
  },
  /** Mirror entries to the console in dev (tests turn this off). */
  setConsoleEcho: (on: boolean) => {
    echo = on;
  },
};
