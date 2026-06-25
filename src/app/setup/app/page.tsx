'use client';

import { Box, CircularProgress, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { type ChangeEvent, useEffect, useState } from 'react';
import { createApp } from '@/lib/api';
import { ink, monoFontFamily } from '@/theme/designTokens';

interface SetupData {
	appName: string;
	appIdentifier: string;
	fetchPolicy: {
		minIntervalHours: number;
		hardTtlDays: number;
	};
}

function Ms({ name, sx }: { name: string; sx?: SxProps<Theme> }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

const labelSx = {
	font: "700 11px 'JetBrains Mono'",
	letterSpacing: '.04em',
	color: '#6B6452',
	mb: 1,
} as const;

const fieldSx = {
	display: 'flex',
	alignItems: 'center',
	gap: 1.25,
	bgcolor: '#fff',
	border: '1.5px solid #E4DBC8',
	borderRadius: '12px',
	p: '11px 13px',
	transition: 'border-color .12s ease',
	'&:focus-within': { borderColor: ink.primary },
} as const;

const inputReset = {
	border: 'none',
	outline: 'none',
	background: 'transparent',
	width: '100%',
} as const;

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

	const atDetails = activeStep === 0;
	const atReview = activeStep === 1;
	const identifierValid = setupData.appIdentifier.trim().length > 0;

	// Step indicator dot styling.
	const stepDot = (active: boolean, done: boolean) => ({
		width: 26,
		height: 26,
		borderRadius: '50%',
		bgcolor: active || done ? ink.primary : 'transparent',
		color: active || done ? '#fff' : '#75746C',
		font: "800 12px 'Baloo 2'",
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		border: `1.5px solid ${active || done ? ink.primary : '#C7C0AE'}`,
		flexShrink: 0,
	});

	return (
		<Box
			sx={{
				minHeight: '100vh',
				bgcolor: '#EFE8DA',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				p: '46px 30px 80px',
			}}
		>
			<Image
				src="/images/Logotype.png"
				alt="Bunting Admin"
				width={172}
				height={43}
				style={{
					width: '172px',
					height: 'auto',
					objectFit: 'contain',
					display: 'block',
					marginBottom: 34,
				}}
			/>

			<Box sx={{ width: 600, maxWidth: '100%' }}>
				<Box sx={{ textAlign: 'center', mb: 3 }}>
					<Typography sx={{ font: "800 26px 'Baloo 2'", color: ink.primary }}>
						Create your first application
					</Typography>
					<Typography
						sx={{ font: "600 14px 'Nunito'", color: '#8B8472', mt: 0.75 }}
					>
						An application is one config bundle the SDK fetches — usually one
						per platform.
					</Typography>
				</Box>

				<Box
					sx={{
						bgcolor: '#F7F3EA',
						border: '1px solid #E4DBC8',
						borderRadius: '22px',
						boxShadow: '0 18px 50px rgba(40,33,20,.10)',
						overflow: 'hidden',
					}}
				>
					{/* step indicator */}
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 1.5,
							p: '22px 26px',
							borderBottom: '1px solid #ECE5D6',
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.125 }}>
							<Box sx={stepDot(atDetails, atReview)}>
								{atReview ? <Ms name="check" sx={{ fontSize: 16 }} /> : '1'}
							</Box>
							<Typography
								sx={{ font: "700 13px 'Nunito'", color: ink.primary }}
							>
								Application Details
							</Typography>
						</Box>
						<Box
							sx={{
								flex: 1,
								height: 2,
								borderRadius: 2,
								bgcolor: atReview ? ink.primary : '#E0DFD8',
							}}
						/>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.125 }}>
							<Box sx={stepDot(atReview, false)}>2</Box>
							<Typography
								sx={{
									font: "700 13px 'Nunito'",
									color: atReview ? ink.primary : '#9A9483',
								}}
							>
								Review &amp; Create
							</Typography>
						</Box>
					</Box>

					{/* STEP 1 */}
					{atDetails && (
						<Box
							sx={{
								p: '26px',
								display: 'flex',
								flexDirection: 'column',
								gap: 2.5,
							}}
						>
							<Box>
								<Typography sx={labelSx}>APPLICATION NAME</Typography>
								<Box sx={fieldSx}>
									<Box
										component="input"
										value={setupData.appName}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											handleNameChange(e.target.value)
										}
										placeholder="e.g. Feast iOS"
										sx={{
											...inputReset,
											font: "600 15px 'Nunito'",
											color: ink.primary,
										}}
									/>
								</Box>
							</Box>
							<Box>
								<Typography sx={labelSx}>
									APPLICATION IDENTIFIER{' '}
									<Box
										component="span"
										sx={{
											color: '#B4AC9A',
											fontWeight: 400,
											textTransform: 'none',
										}}
									>
										· auto-derived from name, editable
									</Box>
								</Typography>
								<Box sx={fieldSx}>
									<Ms name="tag" sx={{ fontSize: 20, color: '#B4AC9A' }} />
									<Box
										component="input"
										value={setupData.appIdentifier}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											setSetupData((prev) => ({
												...prev,
												appIdentifier: e.target.value,
											}))
										}
										sx={{
											...inputReset,
											fontFamily: monoFontFamily,
											fontWeight: 600,
											fontSize: 14,
											color: '#3F7A2D',
										}}
									/>
									{identifierValid && (
										<Ms
											name="check_circle"
											sx={{ fontSize: 18, color: '#82C868' }}
										/>
									)}
								</Box>
								<Typography
									sx={{
										font: "500 12px 'Nunito'",
										color: '#A79F8C',
										mt: 0.875,
									}}
								>
									Used in the SDK fetch URL — change it now; it's awkward to
									change later.
								</Typography>
							</Box>

							<Box
								sx={{
									display: 'flex',
									alignItems: 'flex-start',
									gap: 1.375,
									bgcolor: '#fff',
									border: '1px solid #DCE6E3',
									borderRadius: '13px',
									p: '14px 15px',
								}}
							>
								<Ms name="cloud_sync" sx={{ fontSize: 20, color: '#3E8E84' }} />
								<Typography
									sx={{ font: "500 13px/1.55 'Nunito'", color: '#46615C' }}
								>
									Configs are stored in the instance bucket and served via the
									configured CDN base URL. The SDK's fetch URL is derived from
									the identifier above.
								</Typography>
							</Box>
						</Box>
					)}

					{/* STEP 2 */}
					{atReview && (
						<Box
							sx={{
								p: '26px',
								display: 'flex',
								flexDirection: 'column',
								gap: 1.75,
							}}
						>
							<Typography
								sx={{
									font: "700 11px 'JetBrains Mono'",
									letterSpacing: '.04em',
									color: '#6B6452',
								}}
							>
								REVIEW
							</Typography>
							<Box
								sx={{
									bgcolor: '#fff',
									border: '1px solid #EAE2D2',
									borderRadius: '14px',
									overflow: 'hidden',
								}}
							>
								{[
									{ label: 'Name', value: setupData.appName, mono: false },
									{
										label: 'Identifier',
										value: setupData.appIdentifier,
										mono: true,
									},
									{
										label: 'Fetch policy',
										value: `min ${setupData.fetchPolicy.minIntervalHours}h · hard TTL ${setupData.fetchPolicy.hardTtlDays}d`,
										mono: true,
									},
								].map((row, i, arr) => (
									<Box
										key={row.label}
										sx={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
											gap: 2.25,
											p: '14px 16px',
											borderBottom:
												i < arr.length - 1 ? '1px solid #F1EBDD' : 'none',
										}}
									>
										<Typography
											sx={{ font: "600 13px 'Nunito'", color: '#8B8472' }}
										>
											{row.label}
										</Typography>
										<Typography
											sx={{
												font: row.mono
													? "600 13px 'JetBrains Mono'"
													: "700 14px 'Nunito'",
												color: row.mono
													? row.label === 'Identifier'
														? '#3F7A2D'
														: '#6B6452'
													: ink.primary,
												textAlign: 'right',
												wordBreak: 'break-all',
											}}
										>
											{row.value}
										</Typography>
									</Box>
								))}
							</Box>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'flex-start',
									gap: 1.375,
									bgcolor: '#FCEFD2',
									border: '1px solid #F3E2BD',
									borderRadius: '13px',
									p: '14px 15px',
								}}
							>
								<Ms name="vpn_key" sx={{ fontSize: 20, color: '#9A6F1C' }} />
								<Typography
									sx={{ font: "500 13px/1.55 'Nunito'", color: '#5E4A18' }}
								>
									A signing keypair is generated on create. You'll download{' '}
									<Box component="span" sx={{ fontFamily: monoFontFamily }}>
										BuntingConfig.plist
									</Box>{' '}
									from the SDK Integration tab right after.
								</Typography>
							</Box>
						</Box>
					)}

					{error && (
						<Box
							sx={{
								mx: '26px',
								mb: 2,
								bgcolor: '#FBEAE5',
								border: '1px solid #EAC7BF',
								borderRadius: '11px',
								p: '11px 14px',
								font: "600 13px 'Nunito'",
								color: '#C8503C',
							}}
						>
							{error}
						</Box>
					)}

					{/* footer nav */}
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							p: '18px 26px',
							borderTop: '1px solid #ECE5D6',
							bgcolor: '#FCFAF3',
						}}
					>
						<Box
							component="button"
							onClick={handleBack}
							disabled={atDetails}
							sx={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: 0.875,
								bgcolor: 'transparent',
								border: '1.5px solid #E2D9C6',
								color: atDetails ? '#C2BAA8' : '#3A352C',
								borderRadius: '12px',
								p: '11px 18px',
								font: "700 13px 'Nunito'",
								cursor: atDetails ? 'default' : 'pointer',
							}}
						>
							<Ms name="arrow_back" sx={{ fontSize: 18 }} />
							Back
						</Box>
						{atDetails ? (
							<Box
								component="button"
								onClick={handleNext}
								sx={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: 0.875,
									bgcolor: ink.primary,
									color: '#fff',
									border: 'none',
									borderRadius: '12px',
									p: '11px 24px',
									font: "700 13px 'Nunito'",
									cursor: 'pointer',
								}}
							>
								Next
								<Ms name="arrow_forward" sx={{ fontSize: 18 }} />
							</Box>
						) : (
							<Box
								component="button"
								onClick={() => void handleCreate()}
								disabled={loading}
								sx={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: 1,
									bgcolor: '#F6A444',
									color: '#3A2806',
									border: 'none',
									borderRadius: '12px',
									p: '11px 22px',
									font: "700 13px 'Nunito'",
									cursor: loading ? 'default' : 'pointer',
									opacity: loading ? 0.7 : 1,
								}}
							>
								{loading ? (
									<CircularProgress size={16} sx={{ color: '#3A2806' }} />
								) : (
									<Ms name="add_circle" sx={{ fontSize: 18 }} />
								)}
								{loading ? 'Creating…' : 'Create application'}
							</Box>
						)}
					</Box>
				</Box>

				<Typography
					sx={{
						textAlign: 'center',
						font: "500 12px 'Nunito'",
						color: '#A79F8C',
						mt: 2.25,
					}}
				>
					You can add more applications any time from the dashboard.
				</Typography>
			</Box>
		</Box>
	);
}
