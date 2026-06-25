'use client';

import { Alert, Box, MenuItem, Select, Typography } from '@mui/material';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { ink, monoFontFamily, surface } from '@/theme/designTokens';

interface User {
	id: string;
	email: string;
	name: string | null;
	image: string | null;
	role: 'ADMIN' | 'DEVELOPER';
	createdAt: string;
	lastActiveAt: string;
}

interface AccessListEntry {
	id: string;
	type: 'EMAIL' | 'DOMAIN';
	value: string;
	role: 'ADMIN' | 'DEVELOPER';
	createdAt: string;
	createdBy?: {
		id: string;
		email: string;
		name: string | null;
	};
}

interface UnifiedUser {
	id: string;
	email: string;
	name: string | null;
	image: string | null;
	role: 'ADMIN' | 'DEVELOPER';
	status: 'ACTIVE' | 'INVITED';
	type?: 'EMAIL' | 'DOMAIN';
	createdAt: string;
	lastActiveAt?: string;
	invitedBy?: string;
}

// Role chip palette (matches the design).
const ROLE_STYLE: Record<
	'ADMIN' | 'DEVELOPER',
	{ label: string; color: string; bg: string; border: string }
> = {
	ADMIN: { label: 'Admin', color: '#C8503C', bg: '#FBEAE5', border: '#ECD4CD' },
	DEVELOPER: {
		label: 'Developer',
		color: '#9A6F1C',
		bg: '#FCEFD2',
		border: '#F3E2BD',
	},
};

const CARD_SX = {
	bgcolor: '#fff',
	border: `1px solid ${surface.border}`,
	borderRadius: '16px',
	p: '18px 20px',
	boxShadow: '0 1px 2px rgba(40,33,20,.03)',
} as const;

const MONO_LABEL_SX = {
	font: `700 11px ${monoFontFamily}`,
	letterSpacing: '.04em',
	color: ink.soft,
} as const;

function Ms({ name, sx }: { name: string; sx?: any }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

export default function UserManagement() {
	const { data: session } = useSession();
	const [users, setUsers] = useState<User[]>([]);
	const [accessList, setAccessList] = useState<AccessListEntry[]>([]);
	const [unifiedUsers, setUnifiedUsers] = useState<UnifiedUser[]>([]);
	const [newEntry, setNewEntry] = useState<{
		value: string;
		role: 'ADMIN' | 'DEVELOPER';
	}>({
		value: '',
		role: 'DEVELOPER',
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		loadUsers();
		loadAccessList();
	}, []);

	useEffect(() => {
		const unified: UnifiedUser[] = [];

		users.forEach((user) => {
			unified.push({
				id: user.id,
				email: user.email,
				name: user.name,
				image: user.image,
				role: user.role,
				status: 'ACTIVE',
				createdAt: user.createdAt,
				lastActiveAt: user.lastActiveAt,
			});
		});

		accessList.forEach((entry) => {
			const isActiveUser = users.some((user) => {
				if (entry.type === 'EMAIL') {
					return user.email.toLowerCase() === entry.value.toLowerCase();
				}
				const userDomain = '@' + user.email.split('@')[1];
				return userDomain.toLowerCase() === entry.value.toLowerCase();
			});

			if (!isActiveUser) {
				unified.push({
					id: entry.id,
					email: entry.value,
					name: null,
					image: null,
					role: entry.role,
					status: 'INVITED',
					type: entry.type,
					createdAt: entry.createdAt,
					invitedBy:
						entry.createdBy?.name || entry.createdBy?.email || 'System',
				});
			}
		});

		unified.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);
		setUnifiedUsers(unified);
	}, [users, accessList]);

	const loadUsers = async () => {
		try {
			const response = await fetch('/api/users');
			if (response.ok) {
				const data = await response.json();
				setUsers(data);
			}
		} catch (err) {
			console.error('Failed to load users:', err);
		}
	};

	const loadAccessList = async () => {
		try {
			const response = await fetch('/api/access-list');
			if (response.ok) {
				const data = await response.json();
				setAccessList(data);
			}
		} catch (err) {
			console.error('Failed to load access list:', err);
		}
	};

	const addAccessEntry = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError('');

		try {
			const type = newEntry.value.startsWith('@') ? 'DOMAIN' : 'EMAIL';

			const response = await fetch('/api/access-list', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type,
					value: newEntry.value,
					role: newEntry.role,
				}),
			});

			if (response.ok) {
				setNewEntry({ value: '', role: 'DEVELOPER' });
				loadAccessList();
			} else {
				const data = await response.json();
				setError(data.error || 'Failed to add entry');
			}
		} catch (err) {
			setError('Failed to add entry');
		} finally {
			setIsLoading(false);
		}
	};

	const removeAccessEntry = async (id: string) => {
		try {
			const response = await fetch(`/api/access-list?id=${id}`, {
				method: 'DELETE',
			});
			if (response.ok) {
				loadAccessList();
			}
		} catch (err) {
			console.error('Failed to remove entry:', err);
		}
	};

	const updateUserRole = async (
		userId: string,
		role: 'ADMIN' | 'DEVELOPER',
	) => {
		try {
			const response = await fetch('/api/users', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, role }),
			});

			if (response.ok) {
				loadUsers();
			} else {
				const data = await response.json();
				setError(data.error || 'Failed to update user role');
			}
		} catch (err) {
			setError('Failed to update user role');
		}
	};

	const formatRelative = (dateString?: string) => {
		if (!dateString) {
			return '—';
		}
		return new Date(dateString).toLocaleDateString();
	};

	const activeUsers = unifiedUsers.filter((u) => u.status === 'ACTIVE');
	const invitedUsers = unifiedUsers.filter((u) => u.status === 'INVITED');

	return (
		<Box>
			{/* Grant access */}
			<Box sx={{ ...CARD_SX, mt: 2.75 }}>
				<Typography sx={{ ...MONO_LABEL_SX, mb: 1.375 }}>
					GRANT ACCESS
				</Typography>
				<Box
					component="form"
					onSubmit={addAccessEntry}
					sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}
				>
					<Box
						sx={{
							flex: 1,
							minWidth: 240,
							display: 'flex',
							alignItems: 'center',
							gap: 1.25,
							bgcolor: '#FCFAF3',
							border: '1.5px solid #E4DBC8',
							borderRadius: '12px',
							px: 1.75,
							py: 1.375,
							transition: 'border-color .12s ease',
							'&:focus-within': { borderColor: ink.primary },
						}}
					>
						<Ms
							name="alternate_email"
							sx={{ fontSize: 20, color: '#B4AC9A' }}
						/>
						<Box
							component="input"
							required
							value={newEntry.value}
							onChange={(e: any) =>
								setNewEntry({ ...newEntry, value: e.target.value })
							}
							placeholder="email@example.com  or  @company.com"
							sx={{
								border: 'none',
								outline: 'none',
								background: 'transparent',
								font: "600 14px 'Nunito'",
								color: ink.primary,
								width: '100%',
							}}
						/>
					</Box>
					<Select
						value={newEntry.role}
						onChange={(e) =>
							setNewEntry({
								...newEntry,
								role: e.target.value,
							})
						}
						sx={{
							minWidth: 150,
							bgcolor: '#fff',
							borderRadius: '12px',
							font: "700 13px 'Nunito'",
							'& .MuiOutlinedInput-notchedOutline': {
								borderWidth: '1.5px',
								borderColor: '#E4DBC8',
							},
						}}
					>
						<MenuItem value="DEVELOPER">Developer</MenuItem>
						<MenuItem value="ADMIN">Admin</MenuItem>
					</Select>
					<Box
						component="button"
						type="submit"
						disabled={isLoading}
						sx={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: 0.875,
							bgcolor: ink.primary,
							color: '#fff',
							border: 'none',
							borderRadius: '12px',
							px: 2.75,
							py: 1.375,
							font: "700 13px 'Nunito'",
							cursor: 'pointer',
							opacity: isLoading ? 0.6 : 1,
						}}
					>
						<Ms name="add" sx={{ fontSize: 18 }} />
						Add
					</Box>
				</Box>
				<Typography
					sx={{ font: "500 12px 'Nunito'", color: ink.muted, mt: 1.375 }}
				>
					A whole-domain grant lets anyone with that email domain sign in at the
					chosen role.
				</Typography>
				{error && (
					<Alert severity="error" sx={{ mt: 2 }}>
						{error}
					</Alert>
				)}
			</Box>

			{/* Members */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'baseline',
					gap: 1.375,
					mt: 3.5,
					mb: 1.625,
					mx: 0.25,
				}}
			>
				<Typography variant="h5" sx={{ fontSize: 19 }}>
					Members
				</Typography>
				<Box
					sx={{
						font: "700 12px 'Baloo 2'",
						color: '#9A9483',
						bgcolor: '#EFE8D9',
						borderRadius: '20px',
						px: 1.25,
						py: 0.25,
					}}
				>
					{activeUsers.length}
				</Box>
			</Box>
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
				{activeUsers.map((user) => {
					const isYou = user.id === session?.user?.id;
					const role = ROLE_STYLE[user.role];
					return (
						<Box
							key={user.id}
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 1.75,
								bgcolor: '#fff',
								border: `1px solid ${surface.border}`,
								borderRadius: '14px',
								p: '14px 17px',
								boxShadow: '0 1px 2px rgba(40,33,20,.03)',
							}}
						>
							<Box
								sx={{
									width: 40,
									height: 40,
									borderRadius: '50%',
									bgcolor: ink.primary,
									color: '#fff',
									font: "800 15px 'Baloo 2'",
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									flexShrink: 0,
									textTransform: 'lowercase',
								}}
							>
								{(user.name?.[0] || user.email[0]).toLowerCase()}
							</Box>
							<Box sx={{ flex: 1, minWidth: 0 }}>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.125 }}>
									<Typography
										sx={{ font: "700 14px 'Nunito'", color: ink.primary }}
										noWrap
									>
										{user.email}
									</Typography>
									{isYou && (
										<Box
											sx={{
												font: `700 9px ${monoFontFamily}`,
												color: ink.soft,
												bgcolor: surface.token,
												borderRadius: '6px',
												px: 0.875,
												py: 0.375,
											}}
										>
											YOU
										</Box>
									)}
								</Box>
								<Typography
									sx={{ font: "500 12px 'Nunito'", color: ink.muted, mt: 0.25 }}
								>
									Active · joined {formatRelative(user.createdAt)} · active{' '}
									{formatRelative(user.lastActiveAt)}
								</Typography>
							</Box>
							{isYou ? (
								<Box
									sx={{
										display: 'inline-flex',
										alignItems: 'center',
										gap: 0.875,
										font: "700 12px 'Nunito'",
										color: role.color,
										bgcolor: role.bg,
										border: `1.5px solid ${role.border}`,
										borderRadius: '9px',
										px: 1.5,
										py: 0.875,
									}}
								>
									{role.label}
									<Ms name="lock" sx={{ fontSize: 15, color: '#C2BAA8' }} />
								</Box>
							) : (
								<Select
									value={user.role}
									onChange={(e) => updateUserRole(user.id, e.target.value)}
									variant="standard"
									disableUnderline
									renderValue={(val) => ROLE_STYLE[val].label}
									sx={{
										font: "700 12px 'Nunito'",
										color: role.color,
										bgcolor: role.bg,
										border: `1.5px solid ${role.border}`,
										borderRadius: '9px',
										px: 1.5,
										py: 0.5,
										'& .MuiSelect-select': { p: 0, pr: '20px !important' },
										'& .MuiSelect-icon': { color: '#A79F8C' },
									}}
								>
									<MenuItem value="DEVELOPER">Developer</MenuItem>
									<MenuItem value="ADMIN">Admin</MenuItem>
								</Select>
							)}
						</Box>
					);
				})}
				{activeUsers.length === 0 && (
					<Typography
						sx={{
							font: "600 13px 'Nunito'",
							color: ink.muted,
							textAlign: 'center',
							py: 2,
						}}
					>
						No members yet.
					</Typography>
				)}
			</Box>

			{/* Pending invites */}
			{invitedUsers.length > 0 && (
				<>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'baseline',
							gap: 1.375,
							mt: 3.5,
							mb: 1.625,
							mx: 0.25,
						}}
					>
						<Typography variant="h5" sx={{ fontSize: 19, color: '#9A9483' }}>
							Pending invites
						</Typography>
						<Box
							sx={{
								font: "700 12px 'Baloo 2'",
								color: '#A79F8C',
								bgcolor: '#EFE8D9',
								borderRadius: '20px',
								px: 1.25,
								py: 0.25,
							}}
						>
							{invitedUsers.length}
						</Box>
					</Box>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
						{invitedUsers.map((inv) => (
							<Box
								key={inv.id}
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1.75,
									bgcolor: '#FCFAF3',
									border: '1px dashed #E0D6C2',
									borderRadius: '14px',
									p: '14px 17px',
								}}
							>
								<Box
									sx={{
										width: 40,
										height: 40,
										borderRadius: '11px',
										bgcolor: '#F4ECDC',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										flexShrink: 0,
									}}
								>
									<Ms
										name={inv.type === 'DOMAIN' ? 'domain' : 'mail'}
										sx={{ fontSize: 21, color: '#9A6F1C' }}
									/>
								</Box>
								<Box sx={{ flex: 1, minWidth: 0 }}>
									<Typography
										sx={{
											font: `700 14px ${monoFontFamily}`,
											color: ink.primary,
										}}
										noWrap
									>
										{inv.email}
									</Typography>
									<Typography
										sx={{
											font: "500 12px 'Nunito'",
											color: ink.muted,
											mt: 0.25,
										}}
									>
										{inv.type === 'DOMAIN'
											? `Whole domain · anyone signing in becomes ${ROLE_STYLE[inv.role].label}`
											: `Invited · becomes ${ROLE_STYLE[inv.role].label} on first sign-in`}
									</Typography>
								</Box>
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
									{inv.type === 'DOMAIN' ? 'DOMAIN' : 'INVITED'}
								</Box>
								<Box
									component="button"
									onClick={() => removeAccessEntry(inv.id)}
									aria-label="Remove invite"
									sx={{
										border: '1px solid #ECD4CD',
										bgcolor: 'transparent',
										borderRadius: '9px',
										p: 0.75,
										cursor: 'pointer',
										color: '#C8503C',
										display: 'inline-flex',
										'&:hover': { bgcolor: '#FBEAE5' },
									}}
								>
									<Ms name="close" sx={{ fontSize: 19 }} />
								</Box>
							</Box>
						))}
					</Box>
				</>
			)}

			{/* Roles legend */}
			<Box sx={{ ...CARD_SX, mt: 3.25 }}>
				<Typography sx={{ ...MONO_LABEL_SX, mb: 1.75 }}>ROLES</Typography>
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
						gap: 1.75,
					}}
				>
					<Box>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875 }}>
							<Ms
								name="shield_person"
								sx={{ fontSize: 18, color: '#C8503C' }}
							/>
							<Typography sx={{ font: "800 13px 'Baloo 2'" }}>Admin</Typography>
						</Box>
						<Typography
							sx={{ font: "500 12px 'Nunito'", color: '#8B8472', mt: 0.625 }}
						>
							Full access, plus user management &amp; app deletion.
						</Typography>
					</Box>
					<Box>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875 }}>
							<Ms name="code" sx={{ fontSize: 18, color: '#9A6F1C' }} />
							<Typography sx={{ font: "800 13px 'Baloo 2'" }}>
								Developer
							</Typography>
						</Box>
						<Typography
							sx={{ font: "500 12px 'Nunito'", color: '#8B8472', mt: 0.625 }}
						>
							Edit flags, tests &amp; rollouts, and publish configs.
						</Typography>
					</Box>
				</Box>
				<Typography
					sx={{
						font: "500 12px 'Nunito'",
						color: ink.muted,
						mt: 1.875,
						borderTop: '1px solid #F1EBDD',
						pt: 1.625,
					}}
				>
					You can't change your own role, and only pending invites can be
					removed.
				</Typography>
			</Box>
		</Box>
	);
}
