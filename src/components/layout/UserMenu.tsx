'use client';

import { KeyboardArrowDown, Logout } from '@mui/icons-material';
import {
	Avatar,
	Divider,
	ListItem,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Menu,
	MenuItem,
} from '@mui/material';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import type { CurrentUser } from '@/lib/api';

/**
 * Sidebar user entry and its dropdown, driven by GET /api/me so it works in
 * both auth modes. Sign-out is NextAuth's and only applies in oidc mode: in
 * proxy mode the reverse proxy owns the session, so the entry is hidden.
 */
export function UserMenu({
	user,
	onSignOut,
}: {
	user: CurrentUser | null;
	onSignOut: () => void;
}) {
	const [anchor, setAnchor] = useState<null | HTMLElement>(null);

	if (!user) {
		return null;
	}

	const displayName = user.name ?? user.email;
	const close = () => setAnchor(null);

	return (
		<>
			<ListItem disablePadding>
				<ListItemButton
					onClick={(event: MouseEvent<HTMLElement>) =>
						setAnchor(event.currentTarget)
					}
				>
					<ListItemIcon>
						<Avatar
							src={user.image ?? undefined}
							sx={{ width: 24, height: 24 }}
						>
							{displayName[0].toUpperCase()}
						</Avatar>
					</ListItemIcon>
					<ListItemText
						primary={displayName}
						secondary={user.role}
						title={user.email}
						sx={{ minWidth: 0 }}
						slotProps={{ primary: { noWrap: true } }}
					/>
					<KeyboardArrowDown />
				</ListItemButton>
			</ListItem>
			<Menu
				anchorEl={anchor}
				open={Boolean(anchor)}
				onClose={close}
				PaperProps={{
					sx: { minWidth: 200 },
				}}
			>
				<MenuItem disabled>
					<ListItemText
						primary={displayName}
						secondary={
							user.name
								? `${user.email} · Role: ${user.role}`
								: `Role: ${user.role}`
						}
					/>
				</MenuItem>
				{user.authMode === 'oidc' && <Divider />}
				{user.authMode === 'oidc' && (
					<MenuItem
						onClick={() => {
							close();
							onSignOut();
						}}
					>
						<ListItemIcon>
							<Logout />
						</ListItemIcon>
						<ListItemText primary="Sign Out" />
					</MenuItem>
				)}
			</Menu>
		</>
	);
}
