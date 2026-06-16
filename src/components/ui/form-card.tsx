'use client';

import { Card, CardContent, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface FormCardProps {
	title?: string;
	subtitle?: string;
	children: ReactNode;
	spacing?: number;
	padding?: number;
}

export default function FormCard({
	title,
	subtitle,
	children,
	spacing = 3,
	padding = 3,
}: FormCardProps) {
	return (
		<Card>
			<CardContent sx={{ p: padding }}>
				{title && (
					<Typography variant="h6" sx={{ mb: subtitle ? 1 : 2 }}>
						{title}
					</Typography>
				)}
				{subtitle && (
					<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
						{subtitle}
					</Typography>
				)}
				<Stack spacing={spacing}>{children}</Stack>
			</CardContent>
		</Card>
	);
}
