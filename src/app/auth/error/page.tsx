import { Box, Button, Typography } from '@mui/material';
import Link from 'next/link';

interface ErrorPageProps {
	searchParams: Promise<{ error?: string }>;
}

export default async function ErrorPage({ searchParams }: ErrorPageProps) {
	const params = await searchParams;
	const error = params.error;

	let message = 'An error occurred during authentication.';

	if (error === 'AccessDenied') {
		message =
			"Your email isn't authorized for this instance. Ask an admin to grant access, then try again.";
	} else if (error === 'CredentialsSignin') {
		message = 'Invalid credentials. Please check your username and password.';
	}

	return (
		<Box
			sx={{
				minHeight: '100vh',
				bgcolor: 'background.default',
				display: 'flex',
				justifyContent: 'center',
				alignItems: 'center',
				py: 6,
				px: 2,
			}}
		>
			<Box
				sx={{
					width: '100%',
					maxWidth: 420,
					bgcolor: '#fff',
					border: '1px solid #E4DBC8',
					borderRadius: '22px',
					boxShadow: '0 18px 50px rgba(40,33,20,.10)',
					p: { xs: 4, sm: '46px 40px' },
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					textAlign: 'center',
				}}
			>
				<Box
					sx={{
						width: 64,
						height: 64,
						borderRadius: '50%',
						bgcolor: '#FBEAE5',
						border: '1px solid #F0CFC6',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<Box component="span" className="ms" sx={{ fontSize: 34, color: '#C8503C' }}>
						block
					</Box>
				</Box>

				<Typography variant="h5" sx={{ mt: 2.5, fontSize: 22 }}>
					Couldn’t sign you in
				</Typography>
				<Typography
					sx={{
						font: "600 14px 'Nunito'",
						color: '#6B6452',
						mt: 1,
						maxWidth: 280,
						lineHeight: 1.5,
					}}
				>
					{message}
				</Typography>

				<Button
					component={Link}
					href="/auth/signin"
					variant="contained"
					fullWidth
					sx={{ mt: 2.75, borderRadius: '13px', py: 1.5 }}
				>
					Try a different account
				</Button>
			</Box>
		</Box>
	);
}
