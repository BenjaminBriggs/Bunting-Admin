'use client';

import { Box, Typography } from '@mui/material';
import Link from 'next/link';
import UserManagement from '@/components/settings/UserManagement';
import { ink, monoFontFamily } from '@/theme/designTokens';

export default function UsersPage() {
	return (
		<Box sx={{ maxWidth: 860, mx: 'auto', py: 1 }}>
			{/* header */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 0.75,
					font: "600 12px 'Nunito'",
					color: ink.muted,
				}}
			>
				<Link
					href="/dashboard/settings"
					style={{ color: 'inherit', textDecoration: 'none' }}
				>
					Settings
				</Link>
				<Box component="span" className="ms" sx={{ fontSize: 15 }}>
					chevron_right
				</Box>
				<span>User Management</span>
			</Box>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					gap: 1.375,
					mt: 0.75,
				}}
			>
				<Typography variant="h4">User Management</Typography>
				<Box
					sx={{
						font: `700 9px ${monoFontFamily}`,
						color: '#9A6F1C',
						bgcolor: '#FCEFD2',
						border: '1px solid #F3E2BD',
						borderRadius: '6px',
						px: 1,
						py: 0.5,
					}}
				>
					ADMIN ONLY
				</Box>
			</Box>
			<Typography
				sx={{ font: "600 13px 'Nunito'", color: '#8B8472', mt: 0.625 }}
			>
				Dashboard-wide access. Grant by exact email, or a whole domain.
			</Typography>

			<UserManagement />
		</Box>
	);
}
