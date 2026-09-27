import { AppError, err, isAppError, ok, toAppError, toUserMessage } from '../errors';
import { logger, redact } from '../logger';

describe('errors', () => {
  it('wraps unknown errors and keeps the cause', () => {
    const raw = new Error('SQLite constraint failed: UNIQUE');
    const e = toAppError(raw, 'DB_WRITE_FAILED');
    expect(isAppError(e)).toBe(true);
    expect(e.code).toBe('DB_WRITE_FAILED');
    expect(e.cause).toBe(raw);
    expect(toAppError(e)).toBe(e);
    expect(toAppError('boom').code).toBe('UNKNOWN');
  });

  it('never shows technical text to the user', () => {
    const t = (key: string) => `translated:${key}`;
    const e = new AppError('DB_WRITE_FAILED', 'SQLite constraint failed: UNIQUE');
    expect(toUserMessage(e, t)).toBe('translated:errors:DB_WRITE_FAILED');
    expect(toUserMessage(new Error('x'), t)).toBe('translated:errors:UNKNOWN');
    const custom = new AppError('VALIDATION', 'bad', { userMessageKey: 'errors:VALIDATION' });
    expect(toUserMessage(custom, t)).toBe('translated:errors:VALIDATION');
  });

  it('builds results', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('x')).toEqual({ ok: false, error: 'x' });
  });
});

describe('logger redaction (FS §63)', () => {
  it('redacts sensitive keys deeply', () => {
    const out = redact({
      weightKg: 74.6,
      measurement: { value: 82 },
      photo: { uri: 'file:///private/body.jpg' },
      apiKey: 'sk-123',
      pin: '1234',
      notes: 'feeling tired',
      nested: [{ filePath: '/a/b' }],
      count: 3,
      sessionId: 'abc',
    }) as Record<string, unknown>;
    expect(out.weightKg).toBe('[redacted]');
    expect(out.measurement).toBe('[redacted]');
    expect(out.photo).toBe('[redacted]');
    expect(out.apiKey).toBe('[redacted]');
    expect(out.pin).toBe('[redacted]');
    expect(out.notes).toBe('[redacted]');
    expect((out.nested as Record<string, unknown>[])[0]?.filePath).toBe('[redacted]');
    expect(out.count).toBe(3);
    expect(out.sessionId).toBe('abc');
  });

  it('handles errors and cycles', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect((redact(a) as Record<string, unknown>).self).toBe('[circular]');
    expect(redact(new Error('x'))).toEqual({ name: 'Error', message: 'x' });
  });

  it('stores only redacted entries in a bounded ring buffer', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    logger.clear();
    logger.warn('saving weight', { valueKg: 80, id: 'w1' });
    const [entry] = logger.entries();
    // Check the context only: the entry's timestamp may contain "80" by chance.
    expect(JSON.stringify(entry?.context)).not.toContain('80');
    expect(entry?.context).toEqual({ valueKg: '[redacted]', id: 'w1' });
    for (let i = 0; i < 250; i++) logger.info(`m${i}`);
    expect(logger.entries()).toHaveLength(200);
    logger.setLevel('error');
    logger.warn('dropped');
    expect(logger.entries().at(-1)?.message).toBe('m249');
  });
});
