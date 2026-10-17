'use client';

import {
	Alert,
	Box,
	Button,
	Checkbox,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	FormControlLabel,
	Stack,
	TextField,
} from '@mui/material';
import { useState } from 'react';
import { type App, deleteApp, type SigningKeyInfo } from '@/lib/api';
import { ink, monoFontFamily, surface } from '@/theme/designTokens';
import { ExportKeyDialog } from './SigningKeys';

/**
 * Typed-confirmation app delete. When the app still has signing keys the admin
 * must also acknowledge that they are destroyed with it (export first).
 */
export function DeleteAppDialog({
	app,
	keys,
	onClose,
	onDeleted,
}: {
	app: App | null;
	keys: SigningKeyInfo[];
	onClose: () => void;
	onDeleted: () => Promise<void>;
}) {
	const [typed, setTyped] = useState('');
	const [acknowledged, setAcknowledged] = useState(false);
	const [exportKid, setExportKid] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const close = () => {
		setTyped('');
		setAcknowledged(false);
		setError(null);
		onClose();
	};

	const hasKeys = keys.length > 0;
	const canDelete =
		app !== null &&
		typed === app.identifier &&
		(!hasKeys || acknowledged) &&
		!busy;

	const handleDelete = async () => {
		if (!app || !canDelete) {
			return;
		}
		try {
			setBusy(true);
			setError(null);
			await deleteApp(app.id, typed, hasKeys);
			setTyped('');
			setAcknowledged(false);
			await onDeleted();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to delete app');
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<Dialog
				open={app !== null}
				onClose={busy ? undefined : close}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle sx={{ fontFamily: 'var(--font-baloo)', fontWeight: 800 }}>
					Delete application
				</DialogTitle>
				<DialogContent>
					<DialogContentText>
						This permanently removes "{app?.name}" and its flags, tests,
						rollouts and publish history from Bunting. The last published
						config.json stays in storage, so shipped apps keep that config but
						will never receive another update. This can't be undone.
					</DialogContentText>

					{hasKeys && (
						<Box sx={{ mt: 2 }}>
							<Alert severity="warning">
								This app has {keys.length} signing key
								{keys.length === 1 ? '' : 's'}. They are destroyed with the app.
								Shipped builds trust these keys, so if you ever recreate this
								app, every existing build will reject its configs unless you
								import the keys again. Export any key you may need first.
							</Alert>
							<Stack spacing={1} sx={{ mt: 1.5 }}>
								{keys.map((k) => (
									<Box
										key={k.kid}
										sx={{
											display: 'flex',
											alignItems: 'center',
											gap: 1.5,
											border: `1px solid ${surface.border}`,
											borderRadius: '10px',
											p: '8px 12px',
										}}
									>
										<Box
											sx={{
												flex: 1,
												minWidth: 0,
												fontFamily: monoFontFamily,
												fontSize: 12,
												fontWeight: 600,
												color: ink.primary,
												overflow: 'hidden',
												textOverflow: 'ellipsis',
											}}
										>
											{k.kid}
										</Box>
										<Box
											sx={{
												fontFamily: monoFontFamily,
												fontSize: 9,
												fontWeight: 700,
												color: ink.soft,
											}}
										>
											{k.status}
										</Box>
										<Button
											size="small"
											onClick={() => setExportKid(k.kid)}
											disabled={busy}
											sx={{ textTransform: 'none' }}
										>
											Export
										</Button>
									</Box>
								))}
							</Stack>
							<FormControlLabel
								sx={{ mt: 1 }}
								control={
									<Checkbox
										checked={acknowledged}
										onChange={(e) => setAcknowledged(e.target.checked)}
										disabled={busy}
									/>
								}
								label="I have exported the keys I need. Delete them with the app."
							/>
						</Box>
					)}

					<TextField
						sx={{ mt: 2 }}
						label={`Type ${app?.identifier ?? ''} to confirm`}
						value={typed}
						onChange={(e) => setTyped(e.target.value)}
						autoComplete="off"
						fullWidth
						disabled={busy}
						slotProps={{ htmlInput: { style: { fontFamily: monoFontFamily } } }}
					/>

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
						onClick={() => void handleDelete()}
						color="error"
						variant="contained"
						disabled={!canDelete}
					>
						{busy ? 'Deleting…' : 'Delete application'}
					</Button>
				</DialogActions>
			</Dialog>
			<ExportKeyDialog kid={exportKid} onClose={() => setExportKid(null)} />
		</>
	);
}
