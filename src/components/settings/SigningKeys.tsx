'use client';

import {
	Alert,
	Box,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	Stack,
	TextField,
	Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ChangeEvent, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
	createStandbySigningKey,
	deleteSigningKey,
	exportSigningKey,
	fetchSigningKeys,
	importSigningKey,
	setSigningKeyStatus,
	type SigningKeyInfo,
	type SigningKeyStatus,
} from '@/lib/api';
import {
	ink,
	monoFontFamily,
	surface,
	technicalButtonSx,
} from '@/theme/designTokens';

// Mirrors MIN_EXPORT_PASSPHRASE_LENGTH in src/lib/signing-keys.ts (server-only).
const MIN_PASSPHRASE_LENGTH = 12;

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

const sectionTitleSx = {
	font: "800 17px 'Baloo 2'",
	color: ink.primary,
} as const;

const dialogTitleSx = {
	fontFamily: 'var(--font-baloo)',
	fontWeight: 800,
} as const;

const STATUS_STYLE: Record<
	SigningKeyStatus,
	{ label: string; color: string; bg: string; iconBg: string; note: string }
> = {
	ACTIVE: {
		label: 'ACTIVE',
		color: '#3F7A2D',
		bg: '#E9F4E0',
		iconBg: '#E9F4E0',
		note: 'Signs every published config',
	},
	STANDBY: {
		label: 'STANDBY',
		color: '#9A6F1C',
		bg: '#FCEFD2',
		iconBg: '#FCEFD2',
		note: 'Trusted by new bootstrap files, ready to activate',
	},
	RETIRED: {
		label: 'RETIRED',
		color: '#8B8472',
		bg: '#F1EBDD',
		iconBg: '#F1EBDD',
		note: 'Left out of new bootstrap files; can never sign again',
	},
};

const formatDate = (iso: string) =>
	new Date(iso).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});

/** Load an app's signing keys; `reload` refetches after a mutation. */
export function useSigningKeys(appId: string | undefined) {
	const [keys, setKeys] = useState<SigningKeyInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const reload = useCallback(async () => {
		if (!appId) {
			setKeys([]);
			return;
		}
		try {
			setLoading(true);
			setError(null);
			setKeys(await fetchSigningKeys(appId));
		} catch (err) {
			setError(
				err instanceof Error ? err.message : 'Failed to load signing keys',
			);
		} finally {
			setLoading(false);
		}
	}, [appId]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reload sets a loading flag before fetching the selected app's keys
		void reload();
	}, [reload]);

	return { keys, loading, error, reload };
}

function ConfirmDialog({
	open,
	title,
	confirmLabel,
	danger,
	busy,
	error,
	onCancel,
	onConfirm,
	children,
}: {
	open: boolean;
	title: string;
	confirmLabel: string;
	danger?: boolean;
	busy: boolean;
	error: string | null;
	onCancel: () => void;
	onConfirm: () => void;
	children: ReactNode;
}) {
	return (
		<Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="sm">
			<DialogTitle sx={dialogTitleSx}>{title}</DialogTitle>
			<DialogContent>
				{children}
				{error && (
					<Alert severity="error" sx={{ mt: 2 }}>
						{error}
					</Alert>
				)}
			</DialogContent>
			<DialogActions>
				<Button variant="outlined" onClick={onCancel} disabled={busy}>
					Cancel
				</Button>
				<Button
					onClick={onConfirm}
					disabled={busy}
					color={danger ? 'error' : 'primary'}
					variant="contained"
				>
					{busy ? 'Working…' : confirmLabel}
				</Button>
			</DialogActions>
		</Dialog>
	);
}

/** Passphrase prompt that downloads the encrypted key file. */
export function ExportKeyDialog({
	kid,
	onClose,
}: {
	kid: string | null;
	onClose: () => void;
}) {
	const [passphrase, setPassphrase] = useState('');
	const [confirmation, setConfirmation] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const close = () => {
		setPassphrase('');
		setConfirmation('');
		setError(null);
		onClose();
	};

	const tooShort = passphrase.length < MIN_PASSPHRASE_LENGTH;
	const mismatch = confirmation.length > 0 && confirmation !== passphrase;
	const canExport = !tooShort && confirmation === passphrase && !busy;

	const handleExport = async () => {
		if (!kid || !canExport) {
			return;
		}
		try {
			setBusy(true);
			setError(null);
			await exportSigningKey(kid, passphrase);
			close();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to export key');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog
			open={kid !== null}
			onClose={busy ? undefined : close}
			maxWidth="sm"
		>
			<DialogTitle sx={dialogTitleSx}>Export signing key</DialogTitle>
			<DialogContent>
				<DialogContentText sx={{ mb: 2 }}>
					Downloads key{' '}
					<Box component="span" sx={{ fontFamily: monoFontFamily }}>
						{kid}
					</Box>{' '}
					as a file encrypted with the passphrase below. Anyone with the file
					and the passphrase can sign configs your apps will trust, so store
					them separately. You need both to import the key later.
				</DialogContentText>
				<Stack spacing={2}>
					<TextField
						label="Passphrase"
						type="password"
						autoComplete="new-password"
						value={passphrase}
						onChange={(e) => setPassphrase(e.target.value)}
						error={passphrase.length > 0 && tooShort}
						helperText={`At least ${MIN_PASSPHRASE_LENGTH} characters`}
						fullWidth
					/>
					<TextField
						label="Confirm passphrase"
						type="password"
						autoComplete="new-password"
						value={confirmation}
						onChange={(e) => setConfirmation(e.target.value)}
						error={mismatch}
						helperText={mismatch ? 'Passphrases do not match' : ' '}
						fullWidth
					/>
				</Stack>
				{error && (
					<Alert severity="error" sx={{ mt: 1 }}>
						{error}
					</Alert>
				)}
			</DialogContent>
			<DialogActions>
				<Button variant="outlined" onClick={close} disabled={busy}>
					Cancel
				</Button>
				<Button
					onClick={() => void handleExport()}
					disabled={!canExport}
					sx={technicalButtonSx({ disabled: !canExport })}
				>
					{busy ? 'Exporting…' : 'Download key file'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}

function ImportKeyDialog({
	appId,
	open,
	onClose,
	onImported,
}: {
	appId: string;
	open: boolean;
	onClose: () => void;
	onImported: () => Promise<void>;
}) {
	const [file, setFile] = useState<File | null>(null);
	const [passphrase, setPassphrase] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const close = () => {
		setFile(null);
		setPassphrase('');
		setError(null);
		onClose();
	};

	const canImport =
		file !== null && passphrase.length >= MIN_PASSPHRASE_LENGTH && !busy;

	const handleImport = async () => {
		if (!file || !canImport) {
			return;
		}
		try {
			setBusy(true);
			setError(null);
			let envelope: unknown;
			try {
				envelope = JSON.parse(await file.text());
			} catch {
				throw new Error('The selected file is not a Bunting key export.');
			}
			await importSigningKey(appId, envelope, passphrase);
			await onImported();
			close();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to import key');
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={open} onClose={busy ? undefined : close} maxWidth="sm">
			<DialogTitle sx={dialogTitleSx}>Import signing key</DialogTitle>
			<DialogContent>
				<DialogContentText sx={{ mb: 2 }}>
					Restores an exported key into this app as a standby key, keeping its
					original key ID so apps that already trust it keep verifying once you
					activate it.
				</DialogContentText>
				<Stack spacing={2}>
					<Button
						variant="outlined"
						component="label"
						sx={{ alignSelf: 'start' }}
					>
						{file ? file.name : 'Choose key file'}
						<input
							type="file"
							accept=".json,application/json"
							hidden
							onChange={(e: ChangeEvent<HTMLInputElement>) =>
								setFile(e.target.files?.[0] ?? null)
							}
						/>
					</Button>
					<TextField
						label="Passphrase"
						type="password"
						autoComplete="off"
						value={passphrase}
						onChange={(e) => setPassphrase(e.target.value)}
						helperText="The passphrase used when the key was exported"
						fullWidth
					/>
				</Stack>
				{error && (
					<Alert severity="error" sx={{ mt: 2 }}>
						{error}
					</Alert>
				)}
			</DialogContent>
			<DialogActions>
				<Button variant="outlined" onClick={close} disabled={busy}>
					Cancel
				</Button>
				<Button
					onClick={() => void handleImport()}
					disabled={!canImport}
					sx={technicalButtonSx({ disabled: !canImport })}
				>
					{busy ? 'Importing…' : 'Import as standby'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}

type PendingAction =
	| { type: 'activate'; key: SigningKeyInfo }
	| { type: 'retire'; key: SigningKeyInfo }
	| { type: 'delete'; key: SigningKeyInfo };

/** Signing-key list and lifecycle actions for one app. */
export function SigningKeysCard({
	appId,
	isAdmin,
	keys,
	loading,
	error,
	reload,
}: {
	appId: string;
	isAdmin: boolean;
	keys: SigningKeyInfo[];
	loading: boolean;
	error: string | null;
	reload: () => Promise<void>;
}) {
	const [pending, setPending] = useState<PendingAction | null>(null);
	const [exportKid, setExportKid] = useState<string | null>(null);
	const [importOpen, setImportOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);

	const activeKey = keys.find((k) => k.status === 'ACTIVE');
	const trustedCount = keys.filter((k) => k.status !== 'RETIRED').length;
	const hasStandby = keys.some((k) => k.status === 'STANDBY');

	const runAction = async (fn: () => Promise<void>) => {
		try {
			setBusy(true);
			setActionError(null);
			await fn();
			await reload();
			setPending(null);
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Action failed');
		} finally {
			setBusy(false);
		}
	};

	const confirmPending = () => {
		if (!pending) {
			return;
		}
		const { kid } = pending.key;
		void runAction(() => {
			switch (pending.type) {
				case 'activate':
					return setSigningKeyStatus(appId, kid, 'ACTIVE');
				case 'retire':
					return setSigningKeyStatus(appId, kid, 'RETIRED');
				case 'delete':
					return deleteSigningKey(appId, kid);
			}
		});
	};

	const createStandby = async () => {
		try {
			setBusy(true);
			setActionError(null);
			await createStandbySigningKey(appId);
			await reload();
		} catch (err) {
			setActionError(
				err instanceof Error ? err.message : 'Failed to create signing key',
			);
		} finally {
			setBusy(false);
		}
	};

	const kidSpan = (kid: string) => (
		<Box component="span" sx={{ fontFamily: monoFontFamily }}>
			{kid}
		</Box>
	);

	const smallBtnSx = {
		textTransform: 'none',
		font: "700 12px 'Nunito'",
		minWidth: 0,
		px: 1,
	} as const;

	return (
		<Box sx={cardSx}>
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					gap: 1,
					mb: 0.5,
				}}
			>
				<Typography sx={sectionTitleSx}>Signing keys</Typography>
				{isAdmin && (
					<Stack direction="row" spacing={1}>
						<Button
							variant="outlined"
							size="small"
							onClick={() => setImportOpen(true)}
							disabled={busy}
							startIcon={<Ms name="upload" sx={{ fontSize: 16 }} />}
						>
							Import
						</Button>
						<Button
							size="small"
							onClick={() => void createStandby()}
							disabled={busy}
							startIcon={<Ms name="add" sx={{ fontSize: 16 }} />}
							sx={technicalButtonSx({ disabled: busy })}
						>
							New standby key
						</Button>
					</Stack>
				)}
			</Box>
			<Typography
				sx={{ font: "600 12px/1.5 'Nunito'", color: ink.muted, mb: 1.75 }}
			>
				The active key signs every publish. Standby keys don't sign, but they
				are included in BuntingConfig.plist and bunting_config.json, so apps
				built with those files keep verifying after you activate one. Retired
				keys are left out of new bootstrap files and can't be activated again.
			</Typography>

			{(error ?? actionError) && (
				<Alert severity="error" sx={{ mb: 1.5 }}>
					{error ?? actionError}
				</Alert>
			)}

			<Stack spacing={1.25}>
				{loading && keys.length === 0 && (
					<Typography sx={{ font: "500 12px 'Nunito'", color: ink.muted }}>
						Loading keys…
					</Typography>
				)}
				{!loading && keys.length === 0 && !error && (
					<Typography sx={{ font: "500 12px 'Nunito'", color: ink.muted }}>
						No signing keys yet. An active and a standby key are created on the
						next publish or bootstrap download.
					</Typography>
				)}
				{keys.map((k) => {
					const style = STATUS_STYLE[k.status];
					return (
						<Box
							key={k.kid}
							sx={{
								display: 'flex',
								alignItems: 'center',
								flexWrap: 'wrap',
								gap: 1.5,
								border: `1px solid ${surface.border}`,
								borderRadius: '12px',
								p: '13px 15px',
								bgcolor: surface.sidebar,
								opacity: k.status === 'RETIRED' ? 0.75 : 1,
							}}
						>
							<Box
								sx={{
									width: 34,
									height: 34,
									borderRadius: '9px',
									bgcolor: style.iconBg,
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									flexShrink: 0,
								}}
							>
								<Ms name="key" sx={{ fontSize: 19, color: style.color }} />
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
									{k.kid}
								</Box>
								<Box
									sx={{
										font: "500 11px 'Nunito'",
										color: ink.muted,
										mt: '1px',
									}}
								>
									{style.note} · created {formatDate(k.createdAt)}
								</Box>
							</Box>
							<Box
								sx={{
									fontFamily: monoFontFamily,
									fontWeight: 700,
									fontSize: 9,
									color: style.color,
									bgcolor: style.bg,
									borderRadius: '6px',
									px: 1,
									py: 0.5,
								}}
							>
								{style.label}
							</Box>
							{isAdmin && (
								<Stack direction="row" spacing={0.25}>
									{k.status === 'STANDBY' && (
										<>
											<Button
												size="small"
												sx={smallBtnSx}
												disabled={busy}
												onClick={() => setPending({ type: 'activate', key: k })}
											>
												Activate
											</Button>
											<Button
												size="small"
												color="error"
												sx={smallBtnSx}
												disabled={busy}
												onClick={() => setPending({ type: 'retire', key: k })}
											>
												Retire
											</Button>
										</>
									)}
									{k.status === 'RETIRED' && (
										<Button
											size="small"
											color="error"
											sx={smallBtnSx}
											disabled={busy}
											onClick={() => setPending({ type: 'delete', key: k })}
										>
											Delete
										</Button>
									)}
									<Button
										size="small"
										sx={smallBtnSx}
										disabled={busy}
										onClick={() => setExportKid(k.kid)}
									>
										Export
									</Button>
								</Stack>
							)}
						</Box>
					);
				})}
			</Stack>

			<Typography
				sx={{ font: "500 12px 'Nunito'", color: ink.muted, mt: 1.375 }}
			>
				{trustedCount} trusted key{trustedCount === 1 ? '' : 's'} in new
				bootstrap files. {!isAdmin && 'Only admins can manage signing keys.'}
			</Typography>
			{keys.length > 0 && !hasStandby && (
				<Alert severity="warning" sx={{ mt: 1.5 }}>
					This app has no standby key yet. One is created automatically the next
					time a bootstrap file is downloaded or a config is published, so new
					builds can survive a rotation. Builds made from older bootstrap files
					only trust the keys listed when they were downloaded.
				</Alert>
			)}

			<ConfirmDialog
				open={pending?.type === 'activate'}
				title="Activate signing key"
				confirmLabel="Activate"
				busy={busy}
				error={actionError}
				onCancel={() => setPending(null)}
				onConfirm={confirmPending}
			>
				<DialogContentText>
					Every config published from now on will be signed with{' '}
					{pending && kidSpan(pending.key.kid)}.{' '}
					{activeKey && (
						<>
							The current active key {kidSpan(activeKey.kid)} becomes a standby
							key and stays trusted.{' '}
						</>
					)}
					Apps built with a bootstrap file that does not include this key will
					reject those configs and keep using their last cached config. Only
					activate it once the builds you care about were made with a bootstrap
					file downloaded after this key was created.
				</DialogContentText>
			</ConfirmDialog>

			<ConfirmDialog
				open={pending?.type === 'retire'}
				title="Retire signing key"
				confirmLabel="Retire key"
				danger
				busy={busy}
				error={actionError}
				onCancel={() => setPending(null)}
				onConfirm={confirmPending}
			>
				<DialogContentText>
					Retiring {pending && kidSpan(pending.key.kid)} removes it from new
					bootstrap files, and it can never be activated again. Any app build
					that trusts this key but not the active key will never verify a new
					config: it keeps its last cached config and stops receiving updates.
					Retiring can't be undone.
				</DialogContentText>
			</ConfirmDialog>

			<ConfirmDialog
				open={pending?.type === 'delete'}
				title="Delete signing key"
				confirmLabel="Delete key"
				danger
				busy={busy}
				error={actionError}
				onCancel={() => setPending(null)}
				onConfirm={confirmPending}
			>
				<DialogContentText>
					This permanently destroys the private key for{' '}
					{pending && kidSpan(pending.key.kid)}. Export it first if you might
					ever need it again. This can't be undone.
				</DialogContentText>
			</ConfirmDialog>

			<ExportKeyDialog kid={exportKid} onClose={() => setExportKid(null)} />
			<ImportKeyDialog
				appId={appId}
				open={importOpen}
				onClose={() => setImportOpen(false)}
				onImported={reload}
			/>
		</Box>
	);
}
