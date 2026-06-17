import { computeNextVersion } from '@/lib/versioning';

describe('computeNextVersion', () => {
  const today = '2026-06-17';

  it('starts at .1 when there are no versions today', () => {
    expect(computeNextVersion([], today)).toBe('2026-06-17.1');
  });

  it('increments past the highest sequence for today', () => {
    expect(computeNextVersion(['2026-06-17.1', '2026-06-17.2'], today)).toBe('2026-06-17.3');
  });

  it('takes max+1, not count+1 (tolerates gaps)', () => {
    expect(computeNextVersion(['2026-06-17.1', '2026-06-17.3'], today)).toBe('2026-06-17.4');
  });

  it('ignores versions from other days', () => {
    expect(computeNextVersion(['2026-06-16.5', '2026-06-15.9'], today)).toBe('2026-06-17.1');
  });

  it('ignores malformed version strings', () => {
    expect(computeNextVersion(['2026-06-17', '2026-06-17.x', 'garbage'], today)).toBe('2026-06-17.1');
  });

  it('is not fooled by lexical ordering (.10 > .9)', () => {
    expect(
      computeNextVersion(['2026-06-17.9', '2026-06-17.10'], today)
    ).toBe('2026-06-17.11');
  });
});
