'use client';

import { useEffect, useState } from 'react';
import { type CurrentUser, fetchCurrentUser } from './api';

export type CurrentUserStatus =
	| 'loading'
	| 'authenticated'
	| 'unauthenticated'
	| 'error';

export interface CurrentUserState {
	status: CurrentUserStatus;
	user: CurrentUser | null;
	error: string | null;
}

/**
 * The caller as resolved server-side by GET /api/me. Use this, not NextAuth's
 * useSession, for client-side identity: proxy auth mode has no NextAuth client
 * session. A 401 means unauthenticated in both auth modes.
 */
export function useCurrentUser(): CurrentUserState {
	const [state, setState] = useState<CurrentUserState>({
		status: 'loading',
		user: null,
		error: null,
	});

	useEffect(() => {
		let cancelled = false;
		fetchCurrentUser()
			.then((user) => {
				if (!cancelled) {
					setState({
						status: user ? 'authenticated' : 'unauthenticated',
						user,
						error: null,
					});
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					setState({
						status: 'error',
						user: null,
						error:
							err instanceof Error
								? err.message
								: 'Failed to load current user',
					});
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return state;
}
