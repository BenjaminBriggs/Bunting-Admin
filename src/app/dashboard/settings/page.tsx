'use client';

import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	TextField,
	Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { type ReactNode, useEffect, useState } from 'react';
import {
	type App,
	type DecodedFingerprintResponse,
	decodeFingerprint,
	fetchApps,
	updateApp,
} from '@/lib/api';
import {
	codeSurface,
	ink,
	monoFontFamily,
	surface,
	technicalButtonSx,
} from '@/theme/designTokens';

function Ms({ name, sx }: { name: string; sx?: SxProps<Theme> }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

const cardSx = {
	bgcolor: '#fff',
	border: `1px solid ${surface.border}`,
	borderRadius: '16px',
	p: '20px 22px',
	boxShadow: '0 1px 2px rgba(40,33,20,.03)',
} as const;

const ghostBtnSx = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: 0.75,
	font: "700 12px 'Nunito'",
	color: '#3A352C',
	border: '1.5px solid #E2D9C6',
	borderRadius: '10px',
	px: 1.625,
	py: 0.875,
	textTransform: 'none',
	'&:hover': { borderColor: '#D8CFBC', bgcolor: '#F4ECDC' },
} as const;

const sectionTitleSx = {
	font: "800 17px 'Baloo 2'",
	color: ink.primary,
} as const;

export default function SettingsPage() {
	const router = useRouter();
	const { data: session } = useSession();
	const [apps, setApps] = useState<App[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedApp, setSelectedApp] = useState<App | null>(null);
	const [tab, setTab] = useState<'settings' | 'sdk' | 'fingerprint'>(
		'settings',
	);
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [appToDelete, setAppToDelete] = useState<App | null>(null);
	const [editMode, setEditMode] = useState(false);
	const [saving, setSaving] = useState(false);
	const [copied, setCopied] = useState(false);
	const [formData, setFormData] = useState<{
		name: string;
		minIntervalHours: number;
		hardTtlDays: number;
	}>({ name: '', minIntervalHours: 6, hardTtlDays: 7 });

	const [fpCode, setFpCode] = useState('');
	const [fpResult, setFpResult] = useState<DecodedFingerprintResponse | null>(
		null,
	);
	const [fpError, setFpError] = useState<string | null>(null);
	const [fpLoading, setFpLoading] = useState(false);

	const handleDecode = async () => {
		if (!selectedApp || !fpCode.trim()) {
			return;
		}
		try {
			setFpLoading(true);
			setFpError(null);
			setFpResult(null);
			setFpResult(await decodeFingerprint(selectedApp.id, fpCode.trim()));
		} catch (err) {
			setFpError(
				err instanceof Error ? err.message : 'Failed to decode fingerprint',
			);
		} finally {
			setFpLoading(false);
		}
	};

	const formatValue = (value: unknown): string =>
		typeof value === 'string' ? value : JSON.stringify(value);

	const formatFpDate = (dateString: string) =>
		new Date(dateString).toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});

	useEffect(() => {
		const loadApps = async () => {
			try {
				setLoading(true);
				const appsData = await fetchApps();
				setApps(appsData);
				if (appsData.length > 0) {
					setSelectedApp((prev) => prev ?? appsData[0]);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load apps');
			} finally {
				setLoading(false);
			}
		};
		void loadApps();
	}, []);

	useEffect(() => {
		const syncFormFromApp = () => {
			if (selectedApp && !editMode) {
				setFormData({
					name: selectedApp.name,
					minIntervalHours: selectedApp.fetchPolicy.min_interval_seconds / 3600,
					hardTtlDays: selectedApp.fetchPolicy.hard_ttl_days,
				});
			}
		};
		syncFormFromApp();
	}, [selectedApp, editMode]);

	const handleEditStart = () => {
		if (selectedApp) {
			setFormData({
				name: selectedApp.name,
				minIntervalHours: selectedApp.fetchPolicy.min_interval_seconds / 3600,
				hardTtlDays: selectedApp.fetchPolicy.hard_ttl_days,
			});
			setEditMode(true);
		}
	};

	const handleEditCancel = () => {
		setEditMode(false);
		setError(null);
	};

	const handleSave = async () => {
		if (!selectedApp) {
			return;
		}
		if (!formData.name.trim()) {
			setError('Application name is required');
			return;
		}
		if (formData.minIntervalHours < 0.5 || formData.minIntervalHours > 24) {
			setError('Minimum interval must be between 0.5 and 24 hours');
			return;
		}
		if (formData.hardTtlDays < 1 || formData.hardTtlDays > 365) {
			setError('Hard TTL must be between 1 and 365 days');
			return;
		}
		try {
			setSaving(true);
			setError(null);
			const updatedApp = await updateApp(selectedApp.id, {
				name: formData.name,
				fetchPolicy: {
					min_interval_seconds: formData.minIntervalHours * 3600,
					hard_ttl_days: formData.hardTtlDays,
				},
			});
			setApps(
				apps.map((app) => (app.id === selectedApp.id ? updatedApp : app)),
			);
			setSelectedApp(updatedApp);
			setEditMode(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Failed to save application',
			);
		} finally {
			setSaving(false);
		}
	};

	function downloadPlist(app: App): void {
		const url = `/api/bootstrap/plist?appId=${app.id}`;
		const a = document.createElement('a');
		a.href = url;
		a.download = `BuntingConfig.plist`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	const handleDeleteApp = (app: App) => {
		setAppToDelete(app);
		setDeleteConfirmOpen(true);
	};

	const confirmDelete = () => {
		if (appToDelete) {
			try {
				console.log('Delete app:', appToDelete.name);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to delete app');
			}
		}
		setDeleteConfirmOpen(false);
		setAppToDelete(null);
	};

	const copyArtifactUrl = async () => {
		if (!selectedApp) {
			return;
		}
		try {
			await navigator.clipboard.writeText(selectedApp.artifactUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard not available — ignore
		}
	};

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
				<CircularProgress />
			</Box>
		);
	}

	const fetchPolicyText = selectedApp
		? `min ${selectedApp.fetchPolicy.min_interval_seconds / 3600}h · hard TTL ${selectedApp.fetchPolicy.hard_ttl_days}d`
		: '';

	const baseUrl = (() => {
		if (!selectedApp?.artifactUrl) {
			return 'https://cdn.bunting.io';
		}
		try {
			return new URL(selectedApp.artifactUrl).origin;
		} catch {
			return selectedApp.artifactUrl;
		}
	})();

	const steps: Array<{ n: number; title: string; body: string }> = [
		{
			n: 1,
			title: 'Add the package',
			body: 'Swift Package Manager, CocoaPods or Carthage — see the docs for each.',
		},
		{
			n: 2,
			title: 'Drop in BuntingConfig.plist',
			body: 'Add the downloaded file to your app target so the SDK can find its identifier and key.',
		},
		{
			n: 3,
			title: 'Initialise on launch',
			body: 'Call start() early; it fetches and caches the config, then reads are instant and offline-safe.',
		},
	];

	const tabSx = (active: boolean) => ({
		font: "700 14px 'Nunito'",
		color: active ? ink.primary : '#9A9483',
		borderBottom: `2.5px solid ${active ? ink.primary : 'transparent'}`,
		px: 1.75,
		py: 1.375,
		mb: '-1px',
		cursor: 'pointer',
		display: 'inline-flex',
		alignItems: 'center',
		gap: 0.875,
	});

	return (
		<Box sx={{ maxWidth: 840, mx: 'auto', py: 1 }}>
			{/* header */}
			<Box>
				<Typography variant="h4">Settings</Typography>
				<Typography
					sx={{ font: "600 13px 'Nunito'", color: '#8B8472', mt: 0.625 }}
				>
					Configuration for{' '}
					<Box component="span" sx={{ fontWeight: 800, color: '#3A352C' }}>
						{selectedApp?.name ?? 'your application'}
					</Box>{' '}
					and how the SDK connects to it.
				</Typography>
			</Box>

			{error && (
				<Typography color="error" sx={{ mt: 2, fontWeight: 600 }}>
					{error}
				</Typography>
			)}

			{apps.length === 0 || !selectedApp ? (
				<Box sx={{ textAlign: 'center', py: 8 }}>
					<Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
						No applications configured
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
						Set up your first application with guided setup.
					</Typography>
					<Button
						onClick={() => router.push('/setup/app')}
						startIcon={<Ms name="add" sx={{ fontSize: 18 }} />}
						sx={technicalButtonSx()}
					>
						Set up an application
					</Button>
				</Box>
			) : (
				<>
					{/* tabs */}
					<Box
						sx={{
							display: 'flex',
							gap: 0.5,
							borderBottom: '1px solid #E4DBC8',
							mt: 2.75,
						}}
					>
						<Box
							sx={tabSx(tab === 'settings')}
							onClick={() => setTab('settings')}
						>
							Settings
						</Box>
						<Box sx={tabSx(tab === 'sdk')} onClick={() => setTab('sdk')}>
							SDK Integration
							<Ms name="terminal" sx={{ fontSize: 17 }} />
						</Box>
						<Box
							sx={tabSx(tab === 'fingerprint')}
							onClick={() => setTab('fingerprint')}
						>
							Decode Fingerprint
							<Ms name="fingerprint" sx={{ fontSize: 17 }} />
						</Box>
					</Box>

					{tab === 'settings' && (
						<Stack spacing={2} sx={{ mt: 3 }}>
							{/* application identity */}
							<Box sx={cardSx}>
								<Box
									sx={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										mb: 0.5,
									}}
								>
									<Typography sx={sectionTitleSx}>Application</Typography>
									{!editMode ? (
										<Box
											component="button"
											onClick={handleEditStart}
											sx={{ ...ghostBtnSx, cursor: 'pointer', bgcolor: '#fff' }}
										>
											<Ms name="edit" sx={{ fontSize: 16 }} />
											Edit
										</Box>
									) : (
										<Stack direction="row" spacing={1}>
											<Button
												variant="outlined"
												size="small"
												onClick={handleEditCancel}
												disabled={saving}
											>
												Cancel
											</Button>
											<Button
												size="small"
												onClick={() => void handleSave()}
												disabled={saving}
												sx={technicalButtonSx({ disabled: saving })}
											>
												{saving ? 'Saving…' : 'Save'}
											</Button>
										</Stack>
									)}
								</Box>
								<Typography
									sx={{ font: "600 12px 'Nunito'", color: ink.muted, mb: 1.75 }}
								>
									Identity &amp; how the config is served.
								</Typography>

								{editMode ? (
									<Stack spacing={2.5} sx={{ pt: 1 }}>
										<TextField
											label="Application name"
											value={formData.name}
											onChange={(e) =>
												setFormData({ ...formData, name: e.target.value })
											}
											fullWidth
											required
										/>
										<TextField
											label="Minimum interval (hours)"
											type="number"
											value={formData.minIntervalHours}
											onChange={(e) =>
												setFormData({
													...formData,
													minIntervalHours: parseFloat(e.target.value) || 0,
												})
											}
											fullWidth
											inputProps={{ min: 0.5, max: 24, step: 0.5 }}
											helperText="Minimum time between config fetches (0.5–24 hours)"
										/>
										<TextField
											label="Hard TTL (days)"
											type="number"
											value={formData.hardTtlDays}
											onChange={(e) =>
												setFormData({
													...formData,
													hardTtlDays: parseInt(e.target.value) || 0,
												})
											}
											fullWidth
											inputProps={{ min: 1, max: 365 }}
											helperText="Maximum age before config is considered stale (1–365 days)"
										/>
									</Stack>
								) : (
									<Box>
										<Row label="Name">
											<Box
												component="span"
												sx={{ font: "700 14px 'Nunito'", color: ink.primary }}
											>
												{selectedApp.name}
											</Box>
										</Row>
										<Row label="Identifier">
											<Box
												component="span"
												sx={{
													fontFamily: monoFontFamily,
													fontWeight: 600,
													fontSize: 13,
													color: '#3F7A2D',
												}}
											>
												{selectedApp.identifier}
											</Box>
										</Row>
										<Row label="Artifact URL">
											<Box
												sx={{
													display: 'inline-flex',
													alignItems: 'center',
													gap: 1,
												}}
											>
												<Box
													component="span"
													sx={{
														fontFamily: monoFontFamily,
														fontWeight: 600,
														fontSize: 12,
														color: ink.soft,
														textAlign: 'right',
														wordBreak: 'break-all',
													}}
												>
													{selectedApp.artifactUrl}
												</Box>
												<Box
													component="button"
													onClick={() => void copyArtifactUrl()}
													title={copied ? 'Copied' : 'Copy'}
													sx={{
														cursor: 'pointer',
														color: copied ? '#3F7A2D' : '#A79F8C',
														p: 0.5,
														borderRadius: '8px',
														border: `1px solid ${surface.border}`,
														bgcolor: '#fff',
														display: 'inline-flex',
													}}
												>
													<Ms
														name={copied ? 'check' : 'content_copy'}
														sx={{ fontSize: 18 }}
													/>
												</Box>
											</Box>
										</Row>
										<Row label="Fetch policy">
											<Box
												component="span"
												sx={{
													fontFamily: monoFontFamily,
													fontWeight: 600,
													fontSize: 13,
													color: ink.soft,
												}}
											>
												{fetchPolicyText}
											</Box>
										</Row>
									</Box>
								)}
							</Box>

							{/* signing keys */}
							<Box sx={cardSx}>
								<Box
									sx={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										mb: 1.75,
									}}
								>
									<Typography sx={sectionTitleSx}>Signing keys</Typography>
								</Box>
								<Stack spacing={1.25}>
									{(selectedApp.publicKeys.length > 0
										? selectedApp.publicKeys
										: [{ kid: 'no key configured' }]
									).map((k: { kid: string }, i: number) => (
										<Box
											key={k.kid || i}
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 1.5,
												border: `1px solid ${surface.border}`,
												borderRadius: '12px',
												p: '13px 15px',
												bgcolor: surface.sidebar,
											}}
										>
											<Box
												sx={{
													width: 34,
													height: 34,
													borderRadius: '9px',
													bgcolor: '#E9F4E0',
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
												}}
											>
												<Ms
													name="key"
													sx={{ fontSize: 19, color: '#3F7A2D' }}
												/>
											</Box>
											<Box sx={{ flex: 1, minWidth: 0 }}>
												<Box
													sx={{
														fontFamily: monoFontFamily,
														fontWeight: 600,
														fontSize: 13,
														color: ink.primary,
														overflow: 'hidden',
														textOverflow: 'ellipsis',
													}}
												>
													{k.kid || 'signing key'}
												</Box>
												<Box
													sx={{
														font: "500 11px 'Nunito'",
														color: ink.muted,
														mt: '1px',
													}}
												>
													Signs every published config
												</Box>
											</Box>
											{selectedApp.publicKeys.length > 0 && (
												<Box
													sx={{
														fontFamily: monoFontFamily,
														fontWeight: 700,
														fontSize: 9,
														color: '#3F7A2D',
														bgcolor: '#E9F4E0',
														borderRadius: '6px',
														px: 1,
														py: 0.5,
													}}
												>
													ACTIVE
												</Box>
											)}
										</Box>
									))}
								</Stack>
								<Typography
									sx={{
										font: "500 12px 'Nunito'",
										color: ink.muted,
										mt: 1.375,
									}}
								>
									{selectedApp.publicKeys.length} key
									{selectedApp.publicKeys.length === 1 ? '' : 's'} configured.
									Rotating issues a new key and keeps the old one valid for
									verification for 30 days.
								</Typography>
							</Box>

							{/* user management admin link */}
							{session?.user.role === 'ADMIN' && (
								<Box
									component="a"
									onClick={() => router.push('/dashboard/users')}
									sx={{
										...cardSx,
										p: '16px 18px',
										display: 'flex',
										alignItems: 'center',
										gap: 1.75,
										cursor: 'pointer',
										textDecoration: 'none',
										'&:hover': { bgcolor: '#FBF8F1' },
									}}
								>
									<Box
										sx={{
											width: 40,
											height: 40,
											borderRadius: '11px',
											bgcolor: '#FBEDC6',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
										}}
									>
										<Ms name="group" sx={{ fontSize: 22, color: '#9A6F1C' }} />
									</Box>
									<Box sx={{ flex: 1 }}>
										<Box
											sx={{ font: "800 15px 'Baloo 2'", color: ink.primary }}
										>
											User Management
										</Box>
										<Box
											sx={{
												font: "600 12px 'Nunito'",
												color: '#8B8472',
												mt: '1px',
											}}
										>
											Dashboard-wide access for every app
										</Box>
									</Box>
									<Box
										sx={{
											fontFamily: monoFontFamily,
											fontWeight: 700,
											fontSize: 9,
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
									<Ms
										name="chevron_right"
										sx={{ fontSize: 22, color: '#A79F8C' }}
									/>
								</Box>
							)}

							{/* danger zone */}
							<Box
								sx={{ ...cardSx, border: '1px solid #ECD4CD', p: '18px 22px' }}
							>
								<Box
									sx={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										gap: 2,
									}}
								>
									<Box>
										<Box sx={{ font: "800 15px 'Baloo 2'", color: '#C8503C' }}>
											Delete application
										</Box>
										<Box
											sx={{
												font: "600 12px 'Nunito'",
												color: '#8B8472',
												mt: '2px',
											}}
										>
											Removes all flags, tests, rollouts and published configs.
											Cannot be undone.
										</Box>
									</Box>
									<Button
										variant="outlined"
										color="error"
										onClick={() => handleDeleteApp(selectedApp)}
										sx={{
											borderColor: '#ECD4CD',
											color: '#C8503C',
											flexShrink: 0,
										}}
									>
										Delete
									</Button>
								</Box>
							</Box>
						</Stack>
					)}

					{tab === 'sdk' && (
						<Stack spacing={2} sx={{ mt: 3 }}>
							{/* download */}
							<Box
								sx={{
									...cardSx,
									display: 'flex',
									alignItems: 'center',
									gap: 2,
									p: '18px 22px',
								}}
							>
								<Box
									sx={{
										width: 46,
										height: 46,
										borderRadius: '12px',
										bgcolor: ink.primary,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<Ms name="description" sx={{ fontSize: 24, color: '#fff' }} />
								</Box>
								<Box sx={{ flex: 1 }}>
									<Box sx={{ font: "800 16px 'Baloo 2'" }}>
										BuntingConfig.plist
									</Box>
									<Box
										sx={{
											font: "600 12px 'Nunito'",
											color: '#8B8472',
											mt: '2px',
										}}
									>
										Identifier, CDN base URL &amp; public key — drop it into
										your app bundle.
									</Box>
								</Box>
								<Button
									onClick={() => downloadPlist(selectedApp)}
									startIcon={<Ms name="download" sx={{ fontSize: 18 }} />}
									sx={technicalButtonSx({ accent: false })}
								>
									Download
								</Button>
							</Box>

							{/* steps + code */}
							<Box sx={{ ...cardSx, p: '22px' }}>
								<Typography sx={{ ...sectionTitleSx, mb: 2.25 }}>
									Set up the SDK
								</Typography>
								<Stack spacing={2.25}>
									{steps.map((st) => (
										<Box
											key={st.n}
											sx={{
												display: 'flex',
												gap: 1.75,
												alignItems: 'flex-start',
											}}
										>
											<Box
												sx={{
													width: 28,
													height: 28,
													flexShrink: 0,
													borderRadius: '50%',
													bgcolor: '#FBEDC6',
													color: '#9A6F1C',
													font: "800 13px 'Baloo 2'",
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
												}}
											>
												{st.n}
											</Box>
											<Box sx={{ flex: 1 }}>
												<Box
													sx={{ font: "700 14px 'Nunito'", color: ink.primary }}
												>
													{st.title}
												</Box>
												<Box
													sx={{
														font: "600 12px 'Nunito'",
														color: '#8B8472',
														mt: '2px',
													}}
												>
													{st.body}
												</Box>
											</Box>
										</Box>
									))}
								</Stack>

								<Box
									sx={{
										mt: 2.5,
										bgcolor: codeSurface.bg,
										borderRadius: '13px',
										overflow: 'hidden',
									}}
								>
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1,
											p: '11px 15px',
											borderBottom: '1px solid #34332D',
										}}
									>
										<Box
											sx={{
												width: 9,
												height: 9,
												borderRadius: '50%',
												bgcolor: '#F47C5D',
											}}
										/>
										<Box
											sx={{
												width: 9,
												height: 9,
												borderRadius: '50%',
												bgcolor: '#F6A444',
											}}
										/>
										<Box
											sx={{
												width: 9,
												height: 9,
												borderRadius: '50%',
												bgcolor: '#82C868',
											}}
										/>
										<Box
											sx={{
												ml: 1,
												fontFamily: monoFontFamily,
												fontWeight: 600,
												fontSize: 11,
												color: '#8C887B',
											}}
										>
											AppDelegate.swift
										</Box>
									</Box>
									<Box
										component="pre"
										sx={{
											p: '16px 18px',
											m: 0,
											fontFamily: monoFontFamily,
											fontWeight: 500,
											fontSize: 12.5,
											lineHeight: 1.85,
											color: codeSurface.text,
											whiteSpace: 'pre',
											overflow: 'auto',
										}}
									>
										{`import Bunting

let bunting = Bunting(
  identifier: "${selectedApp.identifier}",
  baseURL: "${baseUrl}"
)
await bunting.start()

// read a flag, with a default fallback
let metering = bunting.bool("metering_enabled", default: false)`}
									</Box>
								</Box>
							</Box>

							<Box
								sx={{
									display: 'flex',
									alignItems: 'flex-start',
									gap: 1.375,
									bgcolor: '#fff',
									border: '1px solid #DCE6E3',
									borderRadius: '13px',
									p: '14px 16px',
								}}
							>
								<Ms name="menu_book" sx={{ fontSize: 20, color: '#3E8E84' }} />
								<Box
									sx={{
										font: "500 13px 'Nunito'",
										color: '#46615C',
										lineHeight: 1.55,
									}}
								>
									Full platform guides (Swift, Kotlin, TypeScript) and the
									caching model live in the{' '}
									<Box
										component="span"
										sx={{ fontWeight: 700, color: ink.primary }}
									>
										SDK docs
									</Box>
									. Values are evaluated on-device from the cached config — no
									network call per read.
								</Box>
							</Box>
						</Stack>
					)}

					{tab === 'fingerprint' && (
						<Stack spacing={2} sx={{ mt: 3 }}>
							<Box sx={cardSx}>
								<Typography sx={sectionTitleSx}>
									Decode client fingerprint
								</Typography>
								<Typography
									sx={{
										fontWeight: 600,
										fontSize: 12,
										color: '#8B8472',
										mt: 0.5,
									}}
								>
									Paste a code like <code>2026-06-17.2.1A46</code> to see
									exactly what this client resolves every flag to.
								</Typography>
								<Box
									sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}
								>
									<TextField
										value={fpCode}
										onChange={(e) => setFpCode(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter') {
												void handleDecode();
											}
										}}
										placeholder="2026-06-17.2.1A46"
										size="small"
										sx={{
											flex: 1,
											minWidth: 280,
											'& input': { fontFamily: monoFontFamily },
										}}
									/>
									<Button
										onClick={() => void handleDecode()}
										disabled={fpLoading || !fpCode.trim()}
										sx={technicalButtonSx({ accent: true })}
									>
										{fpLoading ? 'Decoding…' : 'Decode'}
									</Button>
								</Box>

								{fpError && (
									<Alert severity="error" sx={{ mt: 2 }}>
										{fpError}
									</Alert>
								)}

								{fpResult && (
									<Box sx={{ mt: 2 }}>
										<Typography
											sx={{
												fontFamily: monoFontFamily,
												fontSize: 12,
												color: ink.soft,
												mb: 1,
											}}
										>
											{fpResult.version} · env {fpResult.env} · published{' '}
											{formatFpDate(fpResult.publishedAt)}
										</Typography>
										<Table size="small">
											<TableHead>
												<TableRow>
													<TableCell>Flag</TableCell>
													<TableCell>Type</TableCell>
													<TableCell>Value</TableCell>
												</TableRow>
											</TableHead>
											<TableBody>
												{Object.entries(fpResult.flags).map(([key, flag]) => (
													<TableRow key={key}>
														<TableCell sx={{ fontFamily: monoFontFamily }}>
															{key}
														</TableCell>
														<TableCell sx={{ color: ink.muted }}>
															{flag.type}
														</TableCell>
														<TableCell sx={{ fontFamily: monoFontFamily }}>
															{formatValue(flag.value)}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</Box>
								)}
							</Box>
						</Stack>
					)}
				</>
			)}

			{/* Delete confirmation */}
			<Dialog
				open={deleteConfirmOpen}
				onClose={() => setDeleteConfirmOpen(false)}
			>
				<DialogTitle sx={{ fontFamily: 'var(--font-baloo)', fontWeight: 800 }}>
					Delete application
				</DialogTitle>
				<DialogContent>
					<DialogContentText>
						Are you sure you want to delete "{appToDelete?.name}"? This will
						permanently remove the application and all its feature flags. This
						action cannot be undone.
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button
						variant="outlined"
						onClick={() => setDeleteConfirmOpen(false)}
					>
						Cancel
					</Button>
					<Button onClick={confirmDelete} color="error" variant="contained">
						Delete
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<Box
			sx={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				gap: 2.25,
				py: 1.625,
				borderTop: '1px solid #F1EBDD',
			}}
		>
			<Box
				component="span"
				sx={{
					font: "600 13px 'Nunito'",
					color: '#8B8472',
					whiteSpace: 'nowrap',
				}}
			>
				{label}
			</Box>
			{children}
		</Box>
	);
}
