import { Box, Typography } from '@mui/material';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import SignInForm from '@/components/auth/SignInForm';
import { auth } from '@/lib/auth';
import { getAvailableProviders } from '@/lib/auth-config';

export default async function SignInPage() {
	const session = await auth();

	if (session?.user) {
		redirect('/dashboard');
	}

	// Computed server-side: provider availability depends on server-only env vars.
	const providers = getAvailableProviders();

	return (
		<Box
			sx={{
				minHeight: '100vh',
				bgcolor: 'background.default',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				alignItems: 'center',
				py: 6,
				px: 2,
			}}
		>
			<Box sx={{ width: '100%', maxWidth: 420 }}>
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						textAlign: 'center',
						mb: 3.5,
					}}
				>
					<Image
						src="/images/Logotype.png"
						alt="Bunting"
						width={180}
						height={45}
						style={{ height: 'auto', width: '180px', objectFit: 'contain' }}
						priority
					/>
					<Typography variant="h4" sx={{ mt: 2.5 }}>
						Sign in to Bunting
					</Typography>
					<Typography
						sx={{ font: "600 13px 'Nunito'", color: '#8B8472', mt: 0.5 }}
					>
						Authenticate to manage your apps
					</Typography>
				</Box>

				<SignInForm providers={providers} />

				<Typography
					sx={{
						font: "500 11px 'Nunito'",
						color: '#B4AC9A',
						textAlign: 'center',
						mt: 2.5,
					}}
				>
					The set of providers varies by deployment config.
				</Typography>
			</Box>
		</Box>
	);
}
