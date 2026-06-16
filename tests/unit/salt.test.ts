import { generateSalt } from '@/lib/crypto';

describe('generateSalt', () => {
	it('returns 32 hex chars (128 bits)', () => {
		expect(generateSalt()).toMatch(/^[0-9a-f]{32}$/);
	});

	it('is non-deterministic across calls (CSPRNG, not Math.random)', () => {
		const salts = new Set(Array.from({ length: 100 }, () => generateSalt()));
		expect(salts.size).toBe(100);
	});
});
