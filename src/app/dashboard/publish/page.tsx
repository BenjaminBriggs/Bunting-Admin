'use client';

import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
	generateCurrentConfig,
	getPublishedConfig,
	getPublishHistory,
	publishConfig,
	type PublishHistoryItem,
	validateConfig,
	type ValidationResult,
} from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { useChanges } from '@/lib/changes-context';
import {
	type ConfigChange,
	getConfigChanges,
	hasConfigChanges,
} from '@/lib/config-comparison';
import { diffJson } from '@/lib/json-diff';
import { ink, monoFontFamily, surface, technicalButtonSx } from '@/theme/designTokens';

function Ms({ name, sx }: { name: string; sx?: any }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

const TAG_STYLES: Record<string, { color: string; bg: string }> = {
	ADDED: { color: '#3F7A2D', bg: '#E9F4E0' },
	MODIFIED: { color: '#9A6F1C', bg: '#FCEFD2' },
	REMOVED: { color: '#C8503C', bg: '#FBEAE5' },
};

function ChangeRow({ tag, change }: { tag: string; change: ConfigChange }) {
	const t = TAG_STYLES[tag];
	const detail =
		change.details && change.details.length > 0
			? change.details.join(' · ')
			: change.name;
	return (
		<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.375 }}>
			<Box
				sx={{
					width: 78,
					flexShrink: 0,
					textAlign: 'center',
					fontFamily: monoFontFamily,
					fontWeight: 700,
					fontSize: 9,
					color: t.color,
					bgcolor: t.bg,
					borderRadius: '6px',
					py: 0.5,
				}}
			>
				{tag}
			</Box>
			<Box
				sx={{
					fontFamily: monoFontFamily,
					fontWeight: 500,
					fontSize: 13,
					color: ink.primary,
				}}
			>
				{change.key}
			</Box>
			{detail && (
				<Box sx={{ fontWeight: 600, fontSize: 12, color: ink.muted, minWidth: 0 }}>
					{detail}
				</Box>
			)}
		</Box>
	);
}

const cardSx = {
	bgcolor: '#fff',
	border: `1px solid ${surface.border}`,
	borderRadius: '16px',
	boxShadow: '0 1px 2px rgba(40,33,20,.03)',
} as const;

export default function PublishPage() {
	const router = useRouter();
	const { markChangesPublished } = useChanges();
	const { selectedApp } = useApp();
	const [changelog, setChangelog] = useState('');
	const [isPublishing, setIsPublishing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [publishError, setPublishError] = useState<string | null>(null);
	const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
	const [validation, setValidation] = useState<ValidationResult | null>(null);
	const [changes, setChanges] = useState<ConfigChange[]>([]);
	const [publishHistory, setPublishHistory] = useState<PublishHistoryItem[]>([]);
	const [hasChangesDetected, setHasChangesDetected] = useState(false);
	// Raw configs kept for the technical (JSON) diff view.
	const [currentConfig, setCurrentConfig] = useState<unknown>(null);
	const [publishedConfig, setPublishedConfig] = useState<unknown>(null);
	const [showRawDiff, setShowRawDiff] = useState(false);

	const errorCount = validation?.errors.length ?? 0;
	const warningCount = validation?.warnings.length ?? 0;
	const hasBlockingErrors = errorCount > 0;
	const canPublish = Boolean(
		hasChangesDetected && !hasBlockingErrors && changelog.trim() && selectedApp,
	);

	const loadAppData = useCallback(
		async (appId: string) => {
			try {
				setLoading(true);
				setError(null);

				const [
					validationResult,
					currentConfig,
					publishedConfigResult,
					historyResult,
				] = await Promise.all([
					validateConfig(appId),
					generateCurrentConfig(appId),
					getPublishedConfig(selectedApp!.identifier).catch(() => ({
						config: null,
					})),
					getPublishHistory(appId).catch(() => []),
				]);

				setValidation(validationResult);
				setPublishHistory(historyResult);
				setCurrentConfig(currentConfig);
				setPublishedConfig(publishedConfigResult.config);

				const configChanges = getConfigChanges(
					currentConfig,
					publishedConfigResult.config,
				);
				setChanges(configChanges);
				setHasChangesDetected(
					hasConfigChanges(currentConfig, publishedConfigResult.config),
				);
			} catch (err) {
				console.error('Failed to load app data:', err);
				setError(err instanceof Error ? err.message : 'Failed to load app data');
			} finally {
				setLoading(false);
			}
		},
		[selectedApp],
	);

	useEffect(() => {
		if (selectedApp) {
			loadAppData(selectedApp.id);
		} else {
			setLoading(false);
		}
	}, [selectedApp, loadAppData]);

	const handlePublish = async () => {
		if (!canPublish || !selectedApp) {
			return;
		}

		setIsPublishing(true);
		setPublishError(null);
		setPublishSuccess(null);

		try {
			const result = await publishConfig(selectedApp.id, changelog);
			setPublishSuccess(
				`Configuration published successfully as version ${result.version}`,
			);
			setChangelog('');
			markChangesPublished();
			await loadAppData(selectedApp.id);
			setTimeout(() => {
				router.push('/dashboard/releases');
			}, 2000);
		} catch (err) {
			setPublishError(
				err instanceof Error ? err.message : 'Failed to publish configuration',
			);
		} finally {
			setIsPublishing(false);
		}
	};

	const generateVersion = () => {
		const today = new Date().toISOString().split('T')[0];
		const latestToday = publishHistory.find((h) => h.version.startsWith(today));
		const nextNumber = latestToday
			? parseInt(latestToday.version.split('.')[1]) + 1
			: 1;
		return `${today}.${nextNumber}`;
	};

	const groupedChanges = {
		flags: {
			added: changes.filter((c) => c.type === 'flag' && c.action === 'added'),
			modified: changes.filter(
				(c) => c.type === 'flag' && c.action === 'modified',
			),
			removed: changes.filter(
				(c) => c.type === 'flag' && c.action === 'removed',
			),
		},
		tests: {
			added: changes.filter((c) => c.type === 'test' && c.action === 'added'),
			modified: changes.filter(
				(c) => c.type === 'test' && c.action === 'modified',
			),
			removed: changes.filter(
				(c) => c.type === 'test' && c.action === 'removed',
			),
		},
		rollouts: {
			added: changes.filter(
				(c) => c.type === 'rollout' && c.action === 'added',
			),
			modified: changes.filter(
				(c) => c.type === 'rollout' && c.action === 'modified',
			),
			removed: changes.filter(
				(c) => c.type === 'rollout' && c.action === 'removed',
			),
		},
	};

	const renderGroup = (
		glyph: string,
		label: string,
		group: { added: ConfigChange[]; modified: ConfigChange[]; removed: ConfigChange[] },
	) => {
		const count = group.added.length + group.modified.length + group.removed.length;
		if (count === 0) {
			return null;
		}
		return (
			<Box sx={{ mb: 2.25 }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
					<Ms name={glyph} sx={{ fontSize: 18, color: '#7E776A' }} />
					<Typography sx={{ font: "800 13px 'Baloo 2'" }}>{label}</Typography>
					<Typography
						sx={{ fontFamily: monoFontFamily, fontWeight: 700, fontSize: 11, color: '#9A9483' }}
					>
						{count}
					</Typography>
				</Box>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.875 }}>
					{group.added.map((c, i) => (
						<ChangeRow key={`a${i}`} tag="ADDED" change={c} />
					))}
					{group.modified.map((c, i) => (
						<ChangeRow key={`m${i}`} tag="MODIFIED" change={c} />
					))}
					{group.removed.map((c, i) => (
						<ChangeRow key={`r${i}`} tag="REMOVED" change={c} />
					))}
				</Box>
			</Box>
		);
	};

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
				<CircularProgress />
			</Box>
		);
	}

	if (error) {
		return (
			<Box sx={{ textAlign: 'center', py: 8 }}>
				<Alert severity="error" sx={{ mb: 2 }}>
					{error}
				</Alert>
				<Button variant="outlined" onClick={() => window.location.reload()}>
					Retry
				</Button>
			</Box>
		);
	}

	const lastVersion = publishHistory[0]?.version;

	return (
		<Box sx={{ maxWidth: 1000, mx: 'auto' }}>
			{/* Header */}
			<Box
				sx={{
					display: 'flex',
					alignItems: 'flex-end',
					justifyContent: 'space-between',
					flexWrap: 'wrap',
					gap: 1.75,
				}}
			>
				<Box>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 0.75,
							font: "600 12px 'Nunito'",
							color: ink.muted,
						}}
					>
						<Ms name="history" sx={{ fontSize: 16 }} />
						Releases
						<Ms name="chevron_right" sx={{ fontSize: 15 }} />
						Publish
					</Box>
					<Typography variant="h4" sx={{ mt: 0.75 }}>
						Publish configuration
					</Typography>
					<Typography sx={{ font: "600 13px 'Nunito'", color: '#8B8472', mt: 0.625 }}>
						Review everything that changed, then ship a new signed config
						{selectedApp ? ` for ${selectedApp.name}` : ''}.
					</Typography>
				</Box>
				{selectedApp && hasChangesDetected && (
					<Box
						sx={{
							font: "600 12px 'JetBrains Mono'",
							color: ink.soft,
							bgcolor: '#fff',
							border: `1px solid ${surface.borderStrong}`,
							borderRadius: '9px',
							px: 1.5,
							py: 1,
						}}
					>
						next → {generateVersion()}
					</Box>
				)}
			</Box>

			{!selectedApp && (
				<Alert severity="warning" sx={{ mt: 3 }}>
					Please select an application from the sidebar to publish configuration
					changes.
				</Alert>
			)}

			{publishSuccess && (
				<Alert severity="success" sx={{ mt: 3 }}>
					{publishSuccess}
				</Alert>
			)}
			{publishError && (
				<Alert severity="error" sx={{ mt: 3 }}>
					{publishError}
				</Alert>
			)}

			{selectedApp && (
				<Box
					sx={{
						display: 'flex',
						gap: 2.75,
						alignItems: 'flex-start',
						mt: 3.25,
						flexWrap: 'wrap',
					}}
				>
					{/* LEFT: validation + diff + changelog */}
					<Box sx={{ flex: 1, minWidth: 420, display: 'flex', flexDirection: 'column', gap: 2 }}>
						{/* validation banner */}
						{!hasChangesDetected ? (
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1.5,
									bgcolor: '#DEF3F0',
									border: '1px solid #C9ECE7',
									borderRadius: '14px',
									p: '14px 16px',
								}}
							>
								<Ms name="info" sx={{ fontSize: 24, color: '#1E7B72' }} />
								<Typography sx={{ font: "700 14px 'Baloo 2'", color: '#1E7B72' }}>
									No changes to publish yet
								</Typography>
							</Box>
						) : (
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1.5,
									bgcolor: hasBlockingErrors ? '#FBEAE5' : warningCount > 0 ? '#FCEFD2' : '#E9F4E0',
									border: `1px solid ${hasBlockingErrors ? '#EAC7BF' : warningCount > 0 ? '#F3E2BD' : '#CDE6C2'}`,
									borderRadius: '14px',
									p: '14px 16px',
								}}
							>
								<Ms
									name={hasBlockingErrors ? 'error' : warningCount > 0 ? 'warning' : 'check_circle'}
									sx={{ fontSize: 24, color: hasBlockingErrors ? '#C8503C' : warningCount > 0 ? '#9A6F1C' : '#3F7A2D' }}
								/>
								<Box sx={{ flex: 1, minWidth: 0 }}>
									<Typography
										sx={{
											font: "700 14px 'Baloo 2'",
											color: hasBlockingErrors ? '#7A2E20' : warningCount > 0 ? '#5E4A18' : '#2F5E22',
										}}
									>
										{warningCount} warning{warningCount === 1 ? '' : 's'} · {errorCount} blocking
										error{errorCount === 1 ? '' : 's'}
									</Typography>
									{(validation?.warnings[0] || validation?.errors[0]) && (
										<Typography
											sx={{
												font: "500 12px 'JetBrains Mono'",
												color: hasBlockingErrors ? '#A23C2B' : '#9A7B36',
												mt: 0.25,
											}}
										>
											{(validation?.errors[0] || validation?.warnings[0])?.message}
										</Typography>
									)}
								</Box>
								{!hasBlockingErrors && (
									<Box
										sx={{
											font: "700 10px 'JetBrains Mono'",
											color: '#3F7A2D',
											bgcolor: '#E9F4E0',
											border: '1px solid #CDE6C2',
											borderRadius: '7px',
											px: 1.125,
											py: 0.5,
											whiteSpace: 'nowrap',
										}}
									>
										SAFE TO PUBLISH
									</Box>
								)}
							</Box>
						)}

						{/* changes to publish */}
						<Box sx={{ ...cardSx, p: '20px 22px' }}>
							<Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mb: 0.75 }}>
								<Typography sx={{ font: "800 17px 'Baloo 2'" }}>
									Changes to publish
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
									{changes.length}
								</Box>
							</Box>
							{lastVersion && (
								<Typography sx={{ font: "600 12px 'Nunito'", color: ink.muted, mb: 2 }}>
									since {lastVersion}
								</Typography>
							)}
							{!hasChangesDetected ? (
								<Typography sx={{ font: "600 13px 'Nunito'", color: ink.muted, py: 1 }}>
									No changes detected. Make some changes to your flags before
									publishing.
								</Typography>
							) : (
								<Box sx={{ mt: 0.5 }}>
									{renderGroup('flag', 'Flags', groupedChanges.flags)}
									{renderGroup('science', 'Tests', groupedChanges.tests)}
									{renderGroup('rocket_launch', 'Rollouts', groupedChanges.rollouts)}
								</Box>
							)}
						</Box>

						{/* raw JSON diff (technical view) */}
						{hasChangesDetected && (
							<Box sx={{ ...cardSx, p: '20px 22px' }}>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
									<Ms name="data_object" sx={{ fontSize: 18, color: '#7E776A' }} />
									<Typography sx={{ font: "800 16px 'Baloo 2'" }}>Raw diff</Typography>
									<Typography
										sx={{ font: `600 11px ${monoFontFamily}`, color: ink.muted }}
									>
										published → current
									</Typography>
									<Box
										component="button"
										onClick={() => setShowRawDiff((v) => !v)}
										sx={{ ml: 'auto', ...technicalButtonSx(), border: 'none', cursor: 'pointer' }}
									>
										{showRawDiff ? 'Hide' : 'Show'} diff
									</Box>
								</Box>
								{showRawDiff && (
									<Box
										sx={{
											mt: 1.75,
											overflow: 'auto',
											maxHeight: 460,
											borderRadius: '10px',
											border: `1px solid ${surface.border}`,
											bgcolor: '#FCFAF3',
											py: 1,
											fontFamily: monoFontFamily,
											fontSize: 12,
											lineHeight: 1.55,
										}}
									>
										{diffJson(publishedConfig ?? undefined, currentConfig).map((line, idx) => {
											const isAdd = line.kind === 'add';
											const isDel = line.kind === 'del';
											return (
												<Box
													key={idx}
													sx={{
														display: 'flex',
														px: 1.5,
														whiteSpace: 'pre-wrap',
														wordBreak: 'break-word',
														bgcolor: isAdd ? '#E9F4E0' : isDel ? '#FBEAE5' : 'transparent',
														color: isAdd ? '#2F5E22' : isDel ? '#7A2E20' : ink.soft,
													}}
												>
													<Box
														component="span"
														sx={{
															width: 14,
															flexShrink: 0,
															userSelect: 'none',
															color: isAdd ? '#3F7A2D' : isDel ? '#C8503C' : '#C2BAA8',
														}}
													>
														{isAdd ? '+' : isDel ? '-' : ' '}
													</Box>
													<Box component="span">{line.text || ' '}</Box>
												</Box>
											);
										})}
									</Box>
								)}
							</Box>
						)}

						{/* changelog */}
						{hasChangesDetected && (
							<Box sx={{ ...cardSx, p: '20px 22px' }}>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mb: 1.375 }}>
									<Typography sx={{ font: "800 16px 'Baloo 2'" }}>Changelog</Typography>
									<Box
										sx={{
											font: "700 10px 'Nunito'",
											color: '#C8503C',
											bgcolor: '#FBEAE5',
											borderRadius: '6px',
											px: 0.875,
											py: 0.25,
										}}
									>
										REQUIRED
									</Box>
								</Box>
								<TextField
									value={changelog}
									onChange={(e) => setChangelog(e.target.value)}
									placeholder="Describe what's going live in this release…"
									multiline
									rows={3}
									fullWidth
								/>
							</Box>
						)}
					</Box>

					{/* RIGHT: ready to ship + recent */}
					<Box
						sx={{
							width: 286,
							flexShrink: 0,
							display: 'flex',
							flexDirection: 'column',
							gap: 1.75,
							position: { md: 'sticky' },
							top: 34,
						}}
					>
						<Box sx={{ ...cardSx, p: 2.5 }}>
							<Typography sx={{ font: "800 15px 'Baloo 2'", mb: 1.75 }}>
								Ready to ship
							</Typography>
							{[
								{ label: 'New version', value: hasChangesDetected ? generateVersion() : '—', color: ink.primary },
								{ label: 'Changes', value: String(changes.length), color: ink.primary },
								{
									label: 'Blocking errors',
									value: String(errorCount),
									color: hasBlockingErrors ? '#C8503C' : '#3F7A2D',
								},
							].map((row, i, arr) => (
								<Box
									key={row.label}
									sx={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										py: 1.25,
										borderBottom: i < arr.length - 1 ? '1px solid #F1EBDD' : 'none',
									}}
								>
									<Typography sx={{ font: "600 12px 'Nunito'", color: '#8B8472' }}>
										{row.label}
									</Typography>
									<Typography
										sx={{ font: "700 13px 'JetBrains Mono'", color: row.color }}
									>
										{row.value}
									</Typography>
								</Box>
							))}
							<Button
								onClick={handlePublish}
								disabled={!canPublish || isPublishing}
								fullWidth
								startIcon={
									isPublishing ? (
										<CircularProgress size={18} sx={{ color: '#3A2806' }} />
									) : (
										<Ms name="bolt" sx={{ fontSize: 19 }} />
									)
								}
								sx={{ ...technicalButtonSx({ accent: true, disabled: !canPublish || isPublishing }), mt: 1.5, width: '100%', py: 1.5 }}
							>
								{isPublishing ? 'Publishing…' : 'Publish config'}
							</Button>
							<Typography
								sx={{ font: "500 11px 'Nunito'", color: ink.muted, textAlign: 'center', mt: 1.25 }}
							>
								{hasBlockingErrors
									? 'Fix blocking errors before publishing'
									: 'Signs & uploads the artifact to your CDN'}
							</Typography>
						</Box>

						<Box sx={{ ...cardSx, p: '18px 20px' }}>
							<Typography sx={{ font: "700 12px 'Nunito'", color: '#8B8472', mb: 1.5 }}>
								RECENT PUBLISHES
							</Typography>
							{publishHistory.length === 0 ? (
								<Typography sx={{ font: "600 12px 'Nunito'", color: ink.muted, textAlign: 'center', py: 1 }}>
									No publish history yet
								</Typography>
							) : (
								<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.375 }}>
									{publishHistory.slice(0, 5).map((publish, index) => (
										<Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1.125 }}>
											<Box
												sx={{
													font: "600 12px 'JetBrains Mono'",
													color: ink.primary,
													bgcolor: surface.token,
													borderRadius: '6px',
													px: 1,
													py: 0.375,
													whiteSpace: 'nowrap',
												}}
											>
												{publish.version}
											</Box>
											<Typography sx={{ font: "600 12px 'Nunito'", color: ink.soft, minWidth: 0 }}>
												{new Date(publish.publishedAt).toLocaleDateString()}
											</Typography>
										</Box>
									))}
								</Box>
							)}
						</Box>
					</Box>
				</Box>
			)}
		</Box>
	);
}
