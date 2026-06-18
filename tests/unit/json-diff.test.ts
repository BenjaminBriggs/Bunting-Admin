import { diffJson, diffLines, stableStringify } from '@/lib/json-diff';

describe('stableStringify', () => {
	it('sorts object keys recursively', () => {
		expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
			stableStringify({ a: { c: 3, d: 2 }, b: 1 }),
		);
	});

	it('preserves array order', () => {
		expect(stableStringify([3, 1, 2])).toBe('[\n  3,\n  1,\n  2\n]');
	});

	it('returns empty string for undefined', () => {
		expect(stableStringify(undefined)).toBe('');
	});
});

describe('diffLines', () => {
	it('marks added and removed lines', () => {
		const result = diffLines('a\nb\nc', 'a\nx\nc');
		expect(result).toEqual([
			{ kind: 'context', text: 'a' },
			{ kind: 'del', text: 'b' },
			{ kind: 'add', text: 'x' },
			{ kind: 'context', text: 'c' },
		]);
	});

	it('treats everything as context when identical', () => {
		expect(diffLines('a\nb', 'a\nb').every((l) => l.kind === 'context')).toBe(
			true,
		);
	});

	it('handles an empty before (all additions)', () => {
		expect(diffLines('', 'a\nb')).toEqual([
			{ kind: 'add', text: 'a' },
			{ kind: 'add', text: 'b' },
		]);
	});
});

describe('diffJson', () => {
	it('ignores key reordering, surfaces real value changes', () => {
		const before = { flags: { a: { default: false }, b: { default: true } } };
		const after = { flags: { b: { default: true }, a: { default: true } } };
		const changed = diffJson(before, after).filter(
			(l) => l.kind !== 'context',
		);
		// Only a.default flipped; b's reordering should produce no diff lines.
		expect(changed.some((l) => l.text.includes('false'))).toBe(true);
		expect(changed.some((l) => l.text.includes('true'))).toBe(true);
		expect(changed).toHaveLength(2);
	});
});
