/**
 * Next.js startup hook. Validates that required configuration is present so a
 * misconfigured container fails to boot instead of failing lazily on the first
 * request that happens to touch the missing piece.
 *
 * The actual checks live in `instrumentation-node.ts`, imported only under the
 * Node.js runtime so its node-only dependencies (crypto, etc.) are never pulled
 * into the edge bundle.
 */
export async function register() {
	if (
		process.env.NEXT_RUNTIME === 'nodejs' &&
		process.env.NODE_ENV === 'production'
	) {
		await import('./instrumentation-node');
	}
}
