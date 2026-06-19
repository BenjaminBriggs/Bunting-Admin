'use client';

import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { type App } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { formatTimestamp } from '@/lib/utils';
import { ink, monoFontFamily, surface, technicalButtonSx } from '@/theme/designTokens';

function Ms({ name, sx }: { name: string; sx?: SxProps<Theme> }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

export default function DashboardPage() {
	const router = useRouter();
	const { apps, loading, error, setSelectedApp } = useApp();

	// If no apps exist, redirect to setup after a short delay
	useEffect(() => {
		if (!loading && apps.length === 0 && !error) {
			const timer = setTimeout(() => {
				router.push('/setup/app');
			}, 1000); // Give user a second to see the "no apps" state
			return () => clearTimeout(timer);
		}
	}, [apps, loading, error, router]);

	const handleAppClick = (app: App) => {
		setSelectedApp(app);
		router.push('/dashboard/flags');
	};

	const totalStats = apps.reduce(
		(acc, app) => ({
			flags: acc.flags + (app._count?.flags ?? 0),
			testRollouts: acc.testRollouts + (app._count?.test_rollouts ?? 0),
		}),
		{ flags: 0, testRollouts: 0 },
	);

	if (loading) {
		return (
			<Box
				display="flex"
				justifyContent="center"
				alignItems="center"
				minHeight="400px"
			>
				<CircularProgress />
			</Box>
		);
	}

	if (error) {
		return (
			<Alert severity="error" sx={{ mb: 3 }}>
				{error}
			</Alert>
		);
	}

	const statTile = (value: number | string, label: string) => (
		<Box
			sx={{
				border: `1px solid ${surface.border}`,
				borderRadius: '15px',
				bgcolor: '#fff',
				p: '17px 18px',
				boxShadow: '0 1px 2px rgba(40,33,20,.03)',
			}}
		>
			<Typography sx={{ font: "800 28px 'Baloo 2'", color: ink.primary }}>
				{value}
			</Typography>
			<Typography sx={{ font: "600 12px 'Nunito'", color: '#8B8472', mt: 0.25 }}>
				{label}
			</Typography>
		</Box>
	);

	return (
		<Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 1, md: 2.5 }, py: 1.5 }}>
			{/* greeting */}
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-end',
					flexWrap: 'wrap',
					gap: 2,
				}}
			>
				<Box>
					<Typography variant="h4" component="h1">
						Dashboard
					</Typography>
					<Typography sx={{ font: "600 14px 'Nunito'", color: '#8B8472', mt: 0.75 }}>
						Here&rsquo;s what&rsquo;s happening across your apps.
					</Typography>
				</Box>
			</Box>

			{/* stat tiles */}
			<Box
				sx={{
					display: 'grid',
					gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
					gap: 1.5,
					mt: 3,
				}}
			>
				{statTile(apps.length, 'Applications')}
				{statTile(totalStats.flags, 'Feature Flags')}
				{statTile(totalStats.testRollouts, 'Tests & Rollouts')}
			</Box>

			{/* applications */}
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 4, mb: 2, mx: 0.25 }}>
				<Typography variant="h5" component="h2">
					Your applications
				</Typography>
				<Button
					component={Link}
					href="/setup/app"
					startIcon={<Ms name="add" sx={{ fontSize: 17 }} />}
					sx={{ ...technicalButtonSx(), ml: 'auto' }}
				>
					New Application
				</Button>
			</Box>

			{apps.length === 0 ? (
				<Box
					sx={{
						bgcolor: '#fff',
						border: `1px solid ${surface.border}`,
						borderRadius: '16px',
						textAlign: 'center',
						py: 8,
						px: 3,
						boxShadow: '0 1px 2px rgba(40,33,20,.03)',
					}}
				>
					<Box
						sx={{
							width: 54,
							height: 54,
							borderRadius: '15px',
							bgcolor: '#FBEDC6',
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							mb: 2,
						}}
					>
						<Ms name="apps" sx={{ fontSize: 28, color: '#9A6F1C' }} />
					</Box>
					<Typography sx={{ font: "700 18px 'Baloo 2'", mb: 0.5 }}>
						No applications yet
					</Typography>
					<Typography sx={{ font: "600 13px 'Nunito'", color: '#8B8472', mb: 3 }}>
						Create your first application to start managing feature flags.
					</Typography>
					<Button
						component={Link}
						href="/setup/app"
						startIcon={<Ms name="add" sx={{ fontSize: 17 }} />}
						sx={technicalButtonSx()}
					>
						Create Application
					</Button>
				</Box>
			) : (
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
					{apps.map((app) => (
						<Box
							key={app.id}
							onClick={() => handleAppClick(app)}
							sx={{
								bgcolor: '#fff',
								border: `1.5px solid ${surface.border}`,
								borderRadius: '16px',
								p: '17px 19px',
								cursor: 'pointer',
								transition: 'box-shadow .15s ease, border-color .15s ease, transform .15s ease',
								'&:hover': {
									borderColor: '#E4DBC8',
									boxShadow: '0 8px 24px rgba(40,33,20,.09)',
									transform: 'translateY(-1px)',
								},
							}}
						>
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
								<Box
									sx={{
										width: 42,
										height: 42,
										borderRadius: '11px',
										bgcolor: surface.token,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										font: "800 18px 'Baloo 2'",
										color: ink.primary,
										flexShrink: 0,
									}}
								>
									{app.name.charAt(0).toUpperCase()}
								</Box>
								<Box sx={{ flex: 1, minWidth: 0 }}>
									<Typography sx={{ font: "700 17px 'Baloo 2'" }}>
										{app.name}
									</Typography>
									<Typography
										sx={{ font: `500 11px ${monoFontFamily}`, color: '#A79F8C', mt: '1px' }}
									>
										{app.identifier}
									</Typography>
								</Box>
								<Box sx={{ display: 'flex', gap: 2.25, textAlign: 'center' }}>
									<Box>
										<Typography sx={{ font: "800 16px 'Baloo 2'" }}>
											{app._count?.flags ?? 0}
										</Typography>
										<Typography sx={{ font: "600 10px 'Nunito'", color: '#8B8472' }}>
											flags
										</Typography>
									</Box>
									<Box>
										<Typography sx={{ font: "800 16px 'Baloo 2'" }}>
											{app._count?.test_rollouts ?? 0}
										</Typography>
										<Typography sx={{ font: "600 10px 'Nunito'", color: '#8B8472' }}>
											tests
										</Typography>
									</Box>
								</Box>
								<Ms name="chevron_right" sx={{ fontSize: 24, color: '#C2BAA8', ml: 0.75 }} />
							</Box>
							<Box
								sx={{
									mt: 1.625,
									pt: 1.625,
									borderTop: '1px solid #F1EBDD',
									font: "600 11px 'Nunito'",
									color: '#B4AC9A',
								}}
							>
								Updated {formatTimestamp(app.updatedAt)}
							</Box>
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
}
