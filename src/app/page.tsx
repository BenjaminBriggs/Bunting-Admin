'use client';

import { Alert, Box, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCurrentUser } from '@/lib/current-user';

export default function HomePage() {
	const router = useRouter();
	// Resolved server-side by /api/me, so this works in proxy auth mode too
	// (there is no NextAuth client session there).
	const { status, error } = useCurrentUser();

	useEffect(() => {
		// Not authenticated (a 401 in either auth mode), redirect to sign in
		if (status === 'unauthenticated') {
			router.replace('/auth/signin');
			return;
		}

		// Authenticated, go to dashboard (dashboard will handle app checks)
		if (status === 'authenticated') {
			router.replace('/dashboard');
		}
	}, [router, status]);

	if (status === 'error') {
		return (
			<Box sx={{ maxWidth: 480, mx: 'auto', mt: 12, px: 2 }}>
				<Alert severity="error">
					Could not load your account: {error}. Reload to try again.
				</Alert>
			</Box>
		);
	}

	// Spinner while checking and while the redirect happens
	return (
		<Box
			sx={{
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				minHeight: '100vh',
			}}
		>
			<CircularProgress />
		</Box>
	);
}
