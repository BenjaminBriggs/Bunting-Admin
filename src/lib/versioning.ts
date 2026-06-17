/**
 * Config version numbering: `YYYY-MM-DD.N`, where N is a per-day sequence.
 *
 * `computeNextVersion` is pure; allocation must be serialized (an advisory lock
 * in the publish route) so two concurrent publishes don't mint the same N.
 */
export function computeNextVersion(
	existingVersions: string[],
	today: string,
): string {
	let max = 0;
	for (const version of existingVersions) {
		const parts = version.split('.');
		if (parts.length !== 2 || parts[0] !== today) continue;
		const n = Number.parseInt(parts[1], 10);
		if (Number.isInteger(n) && n > max) {
			max = n;
		}
	}
	return `${today}.${max + 1}`;
}
