import { ApiError, chatIsOpen, errorCode, mapChatError, normalizeMessageBody } from '../api';

describe('chat errors', () => {
  it('maps the rate limit raised by the server trigger', () => {
    // PostgREST wraps `raise exception 'rate_limited'` as { code: 'P0001', message: 'rate_limited' }.
    const code = errorCode({ code: 'P0001', message: 'rate_limited' });
    expect(code).toBe('rate_limited');
    expect(mapChatError(code)).toMatch(/too fast/i);
  });

  it('maps a refused insert (chat closed or no longer going)', () => {
    const code = errorCode({ code: '42501', message: 'new row violates row-level security policy' });
    expect(mapChatError(code)).toMatch(/closed/i);
    expect(mapChatError('chat_closed')).toMatch(/closed/i);
  });

  it('has its own copy for an already-deleted message', () => {
    expect(mapChatError(errorCode({ code: '42501', message: 'message_deleted' }))).not.toMatch(/closed/i);
  });

  it('falls back to a generic message', () => {
    expect(mapChatError('???')).toBe('Something went wrong. Please try again.');
    expect(mapChatError(undefined)).toBe('Something went wrong. Please try again.');
  });
});

describe('normalizeMessageBody', () => {
  it('trims the text', () => {
    expect(normalizeMessageBody('  hi there \n')).toBe('hi there');
  });
  it('rejects empty and whitespace-only text', () => {
    expect(() => normalizeMessageBody('  \n ')).toThrow(ApiError);
    expect(() => normalizeMessageBody('')).toThrow('empty_message');
  });
  it('allows exactly 2000 characters and rejects more', () => {
    expect(normalizeMessageBody('a'.repeat(2000))).toHaveLength(2000);
    expect(() => normalizeMessageBody('a'.repeat(2001))).toThrow('message_too_long');
  });
});

describe('chatIsOpen', () => {
  const start = new Date(2026, 9, 20, 18, 0);
  const end = new Date(2026, 9, 20, 21, 0);
  it('is open until 48 hours after the end', () => {
    expect(chatIsOpen(start, end, new Date(2026, 9, 22, 20, 59))).toBe(true);
    expect(chatIsOpen(start, end, new Date(2026, 9, 22, 21, 0))).toBe(false);
  });
  it('assumes six hours when the event has no end', () => {
    expect(chatIsOpen(start, undefined, new Date(2026, 9, 22, 23, 59))).toBe(true);
    expect(chatIsOpen(start, undefined, new Date(2026, 9, 23, 0, 0))).toBe(false);
  });
});
