import { fetchCurrentUser } from '@/lib/api';

// fetchCurrentUser is the client's single source of identity (both auth modes):
// a 401 from /api/me means "not signed in", anything else non-OK is an error.
describe('fetchCurrentUser', () => {
	const realFetch = global.fetch;
	afterEach(() => {
		global.fetch = realFetch;
	});

	const respond = (status: number, body: unknown) => {
		global.fetch = jest.fn(() =>
			Promise.resolve(
				new Response(JSON.stringify(body), {
					status,
					headers: { 'content-type': 'application/json' },
				}),
			),
		) as typeof fetch;
	};

	test('returns the user on 200', async () => {
		const user = {
			email: 'admin@example.com',
			role: 'ADMIN',
			name: null,
			image: null,
			authMode: 'proxy',
		};
		respond(200, user);
		await expect(fetchCurrentUser()).resolves.toEqual(user);
		expect(global.fetch).toHaveBeenCalledWith('/api/me');
	});

	test('returns null on 401', async () => {
		respond(401, { error: 'Authentication required' });
		await expect(fetchCurrentUser()).resolves.toBeNull();
	});

	test('throws on other failures', async () => {
		respond(500, { error: 'Failed to resolve current user' });
		await expect(fetchCurrentUser()).rejects.toThrow(
			'Failed to resolve current user',
		);
	});
});
