import { identityFromHeaders } from '@/lib/auth-session';

// The proxy branch is network-free in header mode, so we can exercise the real
// dispatch path without standing up NextAuth.
describe('identityFromHeaders — proxy header mode', () => {
	const cfg = { mode: 'proxy' as const, emailHeader: 'x-forwarded-email' };

	it('resolves identity from the trusted header', async () => {
		const headers = new Headers({ 'x-forwarded-email': 'carol@example.com' });
		await expect(identityFromHeaders(headers, cfg)).resolves.toEqual({
			email: 'carol@example.com',
		});
	});

	it('returns null when no identity header is present', async () => {
		await expect(identityFromHeaders(new Headers(), cfg)).resolves.toBeNull();
	});
});
