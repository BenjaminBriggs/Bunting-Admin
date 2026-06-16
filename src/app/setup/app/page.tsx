'use client';

import { Check } from '@mui/icons-material';
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	CircularProgress,
	Container,
	Stack,
	Step,
	StepLabel,
	Stepper,
	TextField,
	Typography,
} from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import React, { useEffect, useState } from 'react';
import { createApp } from '@/lib/api';

interface SetupData {
	appName: string;
	appIdentifier: string;
	fetchPolicy: {
		minIntervalHours: number;
		hardTtlDays: number;
	};
}

const steps = ['Application Details', 'Review & Create'];

export default function SetupPage() {
	const router = useRouter();
	const { status } = useSession();
	const [activeStep, setActiveStep] = useState(0);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [setupData, setSetupData] = useState<SetupData>({
		appName: '',
		appIdentifier: '',
		fetchPolicy: {
			minIntervalHours: 6,
			hardTtlDays: 7,
		},
	});

	// Require authentication.
	useEffect(() => {
		if (status === 'loading') {
			return;
		}
		if (status === 'unauthenticated') {
			router.replace('/auth/signin');
		}
	}, [status, router]);

	// Auto-generate the identifier from the name.
	const handleNameChange = (name: string) => {
		const identifier = name
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/^-+|-+$/g, '');

		setSetupData((prev) => ({
			...prev,
			appName: name,
			appIdentifier: identifier,
		}));
	};

	const handleNext = () => {
		if (activeStep === 0) {
			if (!setupData.appName.trim()) {
				setError('Application name is required');
				return;
			}
			if (!setupData.appIdentifier.trim()) {
				setError('Application identifier is required');
				return;
			}
		}

		setError(null);
		setActiveStep((prev) => prev + 1);
	};

	const handleBack = () => {
		setActiveStep((prev) => prev - 1);
		setError(null);
	};

	const handleCreate = async () => {
		try {
			setLoading(true);
			setError(null);

			// artifactUrl + storage are derived/managed server-side (single global bucket).
			await createApp({
				name: setupData.appName,
				identifier: setupData.appIdentifier,
				publicKeys: [
					{
						kid: 'default',
						pem: '-----BEGIN PUBLIC KEY-----\n[Your public key here]\n-----END PUBLIC KEY-----',
					},
				],
				fetchPolicy: {
					min_interval_seconds: setupData.fetchPolicy.minIntervalHours * 3600,
					hard_ttl_days: setupData.fetchPolicy.hardTtlDays,
				},
			});

			router.push('/dashboard');
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Failed to create application',
			);
		} finally {
			setLoading(false);
		}
	};

	const renderStepContent = (step: number) => {
		switch (step) {
			case 0:
				return (
					<Stack spacing={3}>
						<TextField
							label="Application Name"
							value={setupData.appName}
							onChange={(e) => handleNameChange(e.target.value)}
							fullWidth
							required
							helperText="A friendly name for your application"
						/>

						<TextField
							label="Application Identifier"
							value={setupData.appIdentifier}
							onChange={(e) =>
								setSetupData((prev) => ({
									...prev,
									appIdentifier: e.target.value,
								}))
							}
							fullWidth
							required
							helperText="Unique identifier used by the SDK (auto-generated from name)"
						/>

						<Alert severity="info">
							Published configs are stored in the instance's configured bucket
							and served via <code>CDN_BASE_URL</code>. The SDK fetch URL is
							derived from the identifier above — no per-app storage setup
							needed.
						</Alert>
					</Stack>
				);

			case 1:
				return (
					<Stack spacing={3}>
						<Typography variant="h6">Review</Typography>

						<Card variant="outlined">
							<CardContent>
								<Typography variant="subtitle2" color="text.secondary">
									Application
								</Typography>
								<Typography variant="body1">{setupData.appName}</Typography>
								<Typography variant="body2" color="text.secondary">
									ID: {setupData.appIdentifier}
								</Typography>
							</CardContent>
						</Card>

						<Card variant="outlined">
							<CardContent>
								<Typography variant="subtitle2" color="text.secondary">
									Fetch Policy
								</Typography>
								<Typography variant="body2">
									Minimum interval: {setupData.fetchPolicy.minIntervalHours}{' '}
									hours
								</Typography>
								<Typography variant="body2">
									Hard TTL: {setupData.fetchPolicy.hardTtlDays} days
								</Typography>
							</CardContent>
						</Card>
					</Stack>
				);

			default:
				return null;
		}
	};

	if (status === 'loading') {
		return (
			<Box
				sx={{
					minHeight: '100vh',
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	if (status !== 'authenticated') {
		return null;
	}

	return (
		<Box
			sx={{
				minHeight: '100vh',
				bgcolor: 'background.default',
				display: 'flex',
				alignItems: 'center',
				py: 4,
			}}
		>
			<Container maxWidth="md">
				<Box sx={{ textAlign: 'center', mb: 4 }}>
					<Image
						src="/images/Icon.png"
						alt="Bunting"
						width={200}
						height={200}
						style={{
							height: '200px',
							width: 'auto',
							objectFit: 'contain',
							cursor: 'pointer',
						}}
					/>
					<Typography
						variant="h2"
						component="h1"
						sx={{ mb: 1, fontWeight: 600 }}
					>
						Welcome to Bunting
					</Typography>
					<Typography variant="h5" color="text.secondary" sx={{ mb: 1 }}>
						Self-hosted feature flags for Apps
					</Typography>
					<Typography variant="body1" color="text.secondary">
						Let's set up your first application for feature flag management
					</Typography>
				</Box>

				<Card elevation={8}>
					<CardContent sx={{ p: 4 }}>
						<Stepper activeStep={activeStep} sx={{ mb: 4 }}>
							{steps.map((label) => (
								<Step key={label}>
									<StepLabel>{label}</StepLabel>
								</Step>
							))}
						</Stepper>

						{error && (
							<Alert severity="error" sx={{ mb: 3 }}>
								{error}
							</Alert>
						)}

						{renderStepContent(activeStep)}

						<Box
							sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}
						>
							<Button
								disabled={activeStep === 0}
								onClick={handleBack}
								size="large"
							>
								Back
							</Button>

							{activeStep === steps.length - 1 ? (
								<Button
									variant="contained"
									onClick={handleCreate}
									disabled={loading}
									startIcon={
										loading ? <CircularProgress size={20} /> : <Check />
									}
									size="large"
								>
									{loading ? 'Creating Application...' : 'Create Application'}
								</Button>
							) : (
								<Button variant="contained" onClick={handleNext} size="large">
									Next
								</Button>
							)}
						</Box>
					</CardContent>
				</Card>
			</Container>
		</Box>
	);
}
