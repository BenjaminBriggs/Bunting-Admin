'use client';

import {
	AccountCircle,
	Add,
	Apps,
	Flag,
	History,
	KeyboardArrowDown,
	Logout,
	Rocket,
	Science,
	Settings,
} from '@mui/icons-material';
import {
	Avatar,
	Badge,
	Box,
	Divider,
	Drawer,
	IconButton,
	List,
	ListItem,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Menu,
	MenuItem,
	Typography,
} from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from '@/lib/app-context';
import { ChangesProvider, useChanges } from '@/lib/changes-context';

const drawerWidth = 266;

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const { data: session } = useSession();
	const { hasChanges, getChangeCount } = useChanges();
	const { apps, selectedApp, setSelectedApp, loading } = useApp();

	// No apps (empty/recreated DB, or every app deleted) → there is nothing to
	// manage on any dashboard route. Funnel the operator to create their first app
	// instead of rendering app-scoped pages that would error.
	useEffect(() => {
		if (!loading && apps.length === 0) {
			router.replace('/setup/app');
		}
	}, [loading, apps.length, router]);

	const [appMenuAnchor, setAppMenuAnchor] = useState<null | HTMLElement>(null);
	const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(
		null,
	);

	const menuItems = [
		{
			path: '/dashboard/flags',
			label: 'Feature Flags',
			icon: <Flag />,
			newPath: '/dashboard/flags/new',
		},
		{
			path: '/dashboard/tests',
			label: 'Tests',
			icon: <Science />,
			newPath: '/dashboard/tests/new',
		},
		{
			path: '/dashboard/rollouts',
			label: 'Rollouts',
			icon: <Rocket />,
			newPath: '/dashboard/rollouts/new',
		},
		{
			path: '/dashboard/releases',
			label: 'Releases',
			icon: <History />,
			badge: true, // This will show the changes badge
		},
	];

	const settingsItem = {
		path: '/dashboard/settings',
		label: 'Settings',
		icon: <Settings />,
	};

	const isSelected = (path: string) => {
		return pathname?.startsWith(path) || false;
	};

	const handleAppMenuClick = (event: React.MouseEvent<HTMLElement>) => {
		setAppMenuAnchor(event.currentTarget);
	};

	const handleAppMenuClose = () => {
		setAppMenuAnchor(null);
	};

	const handleAppSelect = (app: any) => {
		setSelectedApp(app);
		handleAppMenuClose();
	};

	const handleAddApplication = () => {
		handleAppMenuClose();
		// Always use the setup flow for new applications
		router.push('/setup/app');
	};

	const handleUserMenuClick = (event: React.MouseEvent<HTMLElement>) => {
		setUserMenuAnchor(event.currentTarget);
	};

	const handleUserMenuClose = () => {
		setUserMenuAnchor(null);
	};

	const handleSignOut = async () => {
		handleUserMenuClose();
		await signOut({ callbackUrl: '/auth/signin' });
	};

	return (
		<Box sx={{ display: 'flex', bgcolor: 'background.default' }}>
			{/* Sidebar */}
			<Drawer
				sx={{
					width: drawerWidth,
					flexShrink: 0,
					'& .MuiDrawer-paper': {
						width: drawerWidth,
						boxSizing: 'border-box',
						borderRight: '1px solid',
						borderColor: '#ECE5D6',
						borderRadius: 0,
						boxShadow: 'none',
						height: '100vh',
						p: '22px 16px 18px',
						backgroundColor: '#FCFAF3',
					},
				}}
				variant="permanent"
				anchor="left"
			>
				{/* Logo at Top */}
				<Box sx={{ px: 0.75, pb: 2.25 }}>
					<Link href="/dashboard" style={{ textDecoration: 'none' }}>
						<Image
							src="/images/Logotype.png"
							alt="Bunting"
							width={200}
							height={50}
							style={{
								height: 'auto',
								width: '176px',
								objectFit: 'contain',
								cursor: 'pointer',
								display: 'block',
							}}
						/>
					</Link>
				</Box>

				{/* App Selector */}
				<Box
					component="button"
					onClick={handleAppMenuClick}
					sx={{
						display: 'block',
						width: '100%',
						textAlign: 'left',
						border: '1px solid #E7DFCD',
						bgcolor: '#fff',
						borderRadius: '13px',
						p: '11px 13px',
						cursor: 'pointer',
						font: 'inherit',
					}}
				>
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
						}}
					>
						<Typography
							sx={{ font: "700 15px 'Baloo 2'", color: 'text.primary' }}
						>
							{selectedApp ? selectedApp.name : 'Select application'}
						</Typography>
						<KeyboardArrowDown sx={{ fontSize: 20, color: '#A79F8C' }} />
					</Box>
					{selectedApp && (
						<Typography
							sx={{
								font: "500 11px 'JetBrains Mono'",
								color: '#A79F8C',
								mt: 0.25,
							}}
						>
							{selectedApp._count?.flags ?? 0} flags ·{' '}
							{selectedApp._count?.test_rollouts ?? 0} tests
						</Typography>
					)}
				</Box>
				{/* Main Menu */}
				<List sx={{ flexGrow: 1 }}>
					{menuItems.map((item, index) => {
						const selected = isSelected(item.path);
						return (
							<React.Fragment key={item.path}>
								{/* Add divider before releases (index 2) */}
								{index === 4 && <Divider sx={{ my: 1 }} />}
								<ListItem
									disablePadding
									sx={
										item.newPath
											? {
													'& .nav-add': {
														opacity: selected ? 1 : 0,
														transition: 'opacity .15s ease',
													},
													'&:hover .nav-add': { opacity: 1 },
												}
											: undefined
									}
									secondaryAction={
										item.newPath ? (
											<IconButton
												className="nav-add"
												edge="end"
												size="small"
												aria-label={`New ${item.label}`}
												onClick={(e) => {
													e.preventDefault();
													e.stopPropagation();
													router.push(item.newPath);
												}}
												sx={{
													bgcolor: 'text.primary',
													color: 'background.paper',
													width: 22,
													height: 22,
													'&:hover': { bgcolor: 'text.secondary' },
												}}
											>
												<Add sx={{ fontSize: 16 }} />
											</IconButton>
										) : undefined
									}
								>
									<ListItemButton
										component={Link}
										href={item.path}
										selected={selected}
									>
										<ListItemIcon>
											{item.badge && hasChanges ? (
												<Badge badgeContent={getChangeCount()} color="primary">
													{item.icon}
												</Badge>
											) : (
												item.icon
											)}
										</ListItemIcon>
										<ListItemText primary={item.label} />
									</ListItemButton>
								</ListItem>
							</React.Fragment>
						);
					})}
				</List>
				{/* Settings and User Menu at Bottom */}
				<List>
					<Divider />
					<ListItem disablePadding>
						<ListItemButton
							component={Link}
							href={settingsItem.path}
							selected={isSelected(settingsItem.path)}
						>
							<ListItemIcon>{settingsItem.icon}</ListItemIcon>
							<ListItemText primary={settingsItem.label} />
						</ListItemButton>
					</ListItem>
					{session?.user && (
						<ListItem disablePadding>
							<ListItemButton onClick={handleUserMenuClick}>
								<ListItemIcon>
									<Avatar
										src={session.user.image || undefined}
										sx={{ width: 24, height: 24 }}
									>
										{session.user.name?.[0] ||
											session.user.email[0].toUpperCase()}
									</Avatar>
								</ListItemIcon>
								<ListItemText
									primary={session.user.name || session.user.email}
									secondary={session.user.role}
								/>
								<KeyboardArrowDown />
							</ListItemButton>
						</ListItem>
					)}
				</List>
				{/* App Menu Dropdown */}
				<Menu
					anchorEl={appMenuAnchor}
					open={Boolean(appMenuAnchor)}
					onClose={handleAppMenuClose}
					PaperProps={{
						sx: { minWidth: 220 },
					}}
				>
					{apps.map((app) => (
						<MenuItem
							key={app.id}
							onClick={() => handleAppSelect(app)}
							selected={selectedApp?.id === app.id}
						>
							<ListItemText
								primary={app.name}
								secondary={`${app._count?.flags || 0} flags`}
							/>
						</MenuItem>
					))}
					<Divider />
					<MenuItem onClick={handleAddApplication}>
						<ListItemIcon>
							<Add />
						</ListItemIcon>
						<ListItemText primary="Add Application" />
					</MenuItem>
				</Menu>

				{/* User Menu Dropdown */}
				<Menu
					anchorEl={userMenuAnchor}
					open={Boolean(userMenuAnchor)}
					onClose={handleUserMenuClose}
					PaperProps={{
						sx: { minWidth: 200 },
					}}
				>
					<MenuItem disabled>
						<ListItemText
							primary={session?.user?.name || session?.user?.email}
							secondary={`Role: ${session?.user?.role}`}
						/>
					</MenuItem>
					<Divider />
					<MenuItem onClick={handleSignOut}>
						<ListItemIcon>
							<Logout />
						</ListItemIcon>
						<ListItemText primary="Sign Out" />
					</MenuItem>
				</Menu>
			</Drawer>

			{/* Main content */}
			<Box
				component="main"
				sx={{
					flexGrow: 1,
					bgcolor: 'background.default',
					p: 3,
					minHeight: '100vh',
				}}
			>
				{children}
			</Box>
		</Box>
	);
}

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AppProvider>
			<ChangesProvider>
				<DashboardLayoutContent>{children}</DashboardLayoutContent>
			</ChangesProvider>
		</AppProvider>
	);
}
