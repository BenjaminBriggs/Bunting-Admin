'use client';

import {
	Email,
	GitHub,
	Google,
	Login,
	Microsoft,
	VpnKey,
} from '@mui/icons-material';
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	Divider,
	Stack,
	TextField,
	Typography,
} from '@mui/material';
import { signIn } from 'next-auth/react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import type { getAvailableProviders } from '@/lib/auth-config';

type Providers = ReturnType<typeof getAvailableProviders>;

export default function SignInForm({ providers }: { providers: Providers }) {
	const [emailPassword, setEmailPassword] = useState({
		email: '',
		password: '',
	});
	const [email, setEmail] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');
	const [emailSent, setEmailSent] = useState(false);
	const hasOAuth =
		providers.oidc ||
		providers.google ||
		providers.github ||
		providers.microsoft;

	const handleCredentialsSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError('');

		try {
			const result = await signIn('credentials', {
				email: emailPassword.email,
				password: emailPassword.password,
				redirect: false,
			});

			if (result.error) {
				setError('Invalid email or password');
			} else if (result.ok) {
				window.location.href = '/dashboard';
			}
		} catch (_err) {
			setError('Something went wrong');
		} finally {
			setIsLoading(false);
		}
	};

	const handleEmailSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError('');

		try {
			const result = await signIn('resend', {
				email,
				redirect: false,
			});

			if (result.error) {
				setError('Failed to send magic link');
			} else {
				setEmailSent(true);
			}
		} catch (_err) {
			setError('Something went wrong');
		} finally {
			setIsLoading(false);
		}
	};

	const handleSsoSignIn = async () => {
		setIsLoading(true);
		setError('');
		try {
			await signIn('oidc', { callbackUrl: '/dashboard' });
		} catch (_err) {
			setError('Authentication failed');
			setIsLoading(false);
		}
	};

	const handleOAuthSignIn = async (provider: string) => {
		setIsLoading(true);
		setError('');

		// Check if this is a dev-mode provider without real credentials
		const isDevMode = process.env.NODE_ENV === 'development';
		const hasRealCredentials = {
			google: !!(
				process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
			),
			github: !!(
				process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
			),
			microsoft: !!(
				process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
			),
		};

		if (
			isDevMode &&
			!hasRealCredentials[provider as keyof typeof hasRealCredentials]
		) {
			setError(
				`${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth is not configured with real credentials. Use Email & Password for development.`,
			);
			setIsLoading(false);
			return;
		}

		try {
			await signIn(provider, { callbackUrl: '/dashboard' });
		} catch (_err) {
			setError('Authentication failed');
			setIsLoading(false);
		}
	};

	return (
		<Card>
			<CardContent>
				<Stack spacing={3}>
					{/* Email & Password Credentials */}
					{providers.credentials && (
						<Box>
							<Typography variant="h6" gutterBottom>
								Email & Password
							</Typography>
							<form onSubmit={(e) => void handleCredentialsSubmit(e)}>
								<Stack spacing={2}>
									<TextField
										label="Email"
										type="email"
										value={emailPassword.email}
										onChange={(e) =>
											setEmailPassword((prev) => ({
												...prev,
												email: e.target.value,
											}))
										}
										required
										fullWidth
										size="small"
										placeholder="admin@example.com"
									/>

									<TextField
										label="Password"
										type="password"
										value={emailPassword.password}
										onChange={(e) =>
											setEmailPassword((prev) => ({
												...prev,
												password: e.target.value,
											}))
										}
										required
										fullWidth
										size="small"
										placeholder="admin"
									/>

									<Button
										type="submit"
										variant="contained"
										disabled={isLoading}
										startIcon={<Login />}
										fullWidth
									>
										{isLoading ? 'Signing in...' : 'Sign in'}
									</Button>
								</Stack>
							</form>

							{(hasOAuth || providers.email) && (
								<Divider sx={{ my: 2 }}>
									<Typography variant="body2" color="text.secondary">
										Or continue with
									</Typography>
								</Divider>
							)}
						</Box>
					)}

					{/* OAuth Providers */}
					{hasOAuth && (
						<Stack spacing={2}>
							{providers.oidc && (
								<Button
									onClick={() => void handleSsoSignIn()}
									variant="contained"
									size="large"
									disabled={isLoading}
									startIcon={<VpnKey />}
									fullWidth
								>
									Continue with SSO
								</Button>
							)}

							{providers.google && (
								<Button
									onClick={() => void handleOAuthSignIn('google')}
									variant="outlined"
									size="large"
									disabled={isLoading}
									startIcon={<Google />}
									fullWidth
								>
									Continue with Google
								</Button>
							)}

							{providers.github && (
								<Button
									onClick={() => void handleOAuthSignIn('github')}
									variant="outlined"
									size="large"
									disabled={isLoading}
									startIcon={<GitHub />}
									fullWidth
								>
									Continue with GitHub
								</Button>
							)}

							{providers.microsoft && (
								<Button
									onClick={() => void handleOAuthSignIn('azure-ad')}
									variant="outlined"
									size="large"
									disabled={isLoading}
									startIcon={<Microsoft />}
									fullWidth
								>
									Continue with Microsoft
								</Button>
							)}
						</Stack>
					)}

					{/* Divider between OAuth and Email */}
					{hasOAuth && providers.email && (
						<Divider>
							<Typography variant="body2" color="text.secondary">
								Or continue with email
							</Typography>
						</Divider>
					)}

					{/* Magic Link Email */}
					{providers.email &&
						(emailSent ? (
							<Alert severity="success">
								<Typography variant="body2" sx={{ fontWeight: 500 }}>
									Check your email!
								</Typography>
								<Typography variant="body2">
									We've sent a magic link to {email}. Click the link to sign in.
								</Typography>
							</Alert>
						) : (
							<form onSubmit={(e) => void handleEmailSubmit(e)}>
								<Stack spacing={2}>
									<TextField
										label="Email address"
										type="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										required
										fullWidth
										autoComplete="email"
									/>

									<Button
										type="submit"
										variant="contained"
										size="large"
										disabled={isLoading}
										startIcon={<Email />}
										fullWidth
									>
										{isLoading ? 'Sending link...' : 'Send magic link'}
									</Button>
								</Stack>
							</form>
						))}

					{/* No providers configured fallback */}
					{!hasOAuth && !providers.email && (
						<Alert severity="warning">
							<Typography variant="body2" sx={{ fontWeight: 500 }}>
								No authentication providers configured
							</Typography>
							<Typography variant="body2">
								Configure an auth provider via environment variables (AUTH_MODE
								/ OIDC_* / AUTH_PROXY_*). See .env.example.
							</Typography>
						</Alert>
					)}

					{/* Error Display */}
					{error && <Alert severity="error">{error}</Alert>}
				</Stack>
			</CardContent>
		</Card>
	);
}
