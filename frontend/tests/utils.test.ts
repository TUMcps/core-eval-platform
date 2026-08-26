import { describe, expect, it } from 'vitest';
import { formatDateTime } from '../src/utils/datetime';
import { logTail } from '../src/utils/logTail';
import { ownerParts, ownerText } from '../src/utils/owner';

describe('owner formatting', () => {
  it('formats a distinct name and email', () => {
    expect(ownerParts(' Ada ', ' ada@example.com ')).toEqual({ name: 'Ada', email: 'ada@example.com' });
    expect(ownerText('Ada', 'ada@example.com')).toBe('Ada (ada@example.com)');
  });

  it('avoids repeating legacy accounts whose name is their email', () => {
    expect(ownerText('ada@example.com', 'ada@example.com')).toBe('ada@example.com');
  });

  it('handles partial and missing owner information', () => {
    expect(ownerText(null, 'ada@example.com')).toBe('ada@example.com');
    expect(ownerText(null, null)).toBe('—');
  });
});

describe('date formatting', () => {
  it('returns an em dash for absent or invalid timestamps', () => {
    expect(formatDateTime()).toBe('—');
    expect(formatDateTime('not-a-date')).toBe('—');
  });

  it('formats a local timestamp consistently', () => {
    expect(formatDateTime('2026-07-06T08:02:00')).toBe('Jul 6, 2026 - 08:02 AM');
  });
});

describe('log tailing', () => {
  it('leaves logs within the configured limit unchanged', () => {
    expect(logTail('short log')).toBe('short log');
  });

  it('keeps the end of oversized logs and reports truncation', () => {
    const oversized = `${'a'.repeat(1_000_000)}THE END`;
    const result = logTail(oversized);

    expect(result).toContain('showing the last 1000 KB');
    expect(result).toContain('of 1000 KB');
    expect(result.slice(-1_000_000)).toBe(oversized.slice(-1_000_000));
    expect(result.endsWith('THE END')).toBe(true);
  });
});
