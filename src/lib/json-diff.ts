// Minimal, dependency-free line diff for showing a raw config diff on the publish
// screen. Values are serialised with stable (recursively sorted) key order so the
// diff reflects genuine value changes, not incidental key-ordering differences
// between the freshly generated config and the one fetched from storage.

export type DiffLineKind = 'add' | 'del' | 'context';

export interface DiffLine {
	kind: DiffLineKind;
	text: string;
}

/** JSON.stringify with object keys sorted recursively (arrays keep their order). */
export function stableStringify(value: unknown): string {
	if (value === undefined) {
		return '';
	}
	const sortKeys = (val: unknown): unknown => {
		if (Array.isArray(val)) {
			return val.map(sortKeys);
		}
		if (val && typeof val === 'object') {
			return Object.keys(val)
				.sort()
				.reduce<Record<string, unknown>>((acc, key) => {
					acc[key] = sortKeys((val as Record<string, unknown>)[key]);
					return acc;
				}, {});
		}
		return val;
	};
	return JSON.stringify(sortKeys(value), null, 2);
}

/** Classic LCS line diff. Returns lines tagged add/del/context, in order. */
export function diffLines(before: string, after: string): DiffLine[] {
	const a = before === '' ? [] : before.split('\n');
	const b = after === '' ? [] : after.split('\n');
	const m = a.length;
	const n = b.length;

	// dp[i][j] = length of LCS of a[i:] and b[j:]
	const dp: number[][] = Array.from({ length: m + 1 }, () =>
		new Array<number>(n + 1).fill(0),
	);
	for (let i = m - 1; i >= 0; i--) {
		for (let j = n - 1; j >= 0; j--) {
			dp[i][j] =
				a[i] === b[j]
					? dp[i + 1][j + 1] + 1
					: Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}

	const out: DiffLine[] = [];
	let i = 0;
	let j = 0;
	while (i < m && j < n) {
		if (a[i] === b[j]) {
			out.push({ kind: 'context', text: a[i] });
			i++;
			j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			out.push({ kind: 'del', text: a[i] });
			i++;
		} else {
			out.push({ kind: 'add', text: b[j] });
			j++;
		}
	}
	while (i < m) {
		out.push({ kind: 'del', text: a[i++] });
	}
	while (j < n) {
		out.push({ kind: 'add', text: b[j++] });
	}
	return out;
}

/** Diff two JSON-serialisable values as pretty-printed, key-stable text. */
export function diffJson(before: unknown, after: unknown): DiffLine[] {
	return diffLines(stableStringify(before), stableStringify(after));
}
