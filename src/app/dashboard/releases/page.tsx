'use client';

import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
	downloadConfig,
	getPublishHistory,
	type PublishHistoryItem,
} from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { useChanges } from '@/lib/changes-context';
import {
	ink,
	monoFontFamily,
	surface,
	technicalButtonSx,
} from '@/theme/designTokens';

const DIFF_TAG: Record<string, { tag: string; color: string; bg: string }> = {
	added: { tag: 'ADDED', color: '#3F7A2D', bg: '#E9F4E0' },
	modified: { tag: 'MODIFIED', color: '#9A6F1C', bg: '#FCEFD2' },
	removed: { tag: 'REMOVED', color: '#C8503C', bg: '#FBEAE5' },
};

function Ms({ name, sx }: { name: string; sx?: SxProps<Theme> }) {
	return (
		<Box component="span" className="ms" sx={sx}>
			{name}
		</Box>
	);
}

export default function ReleasesPage() {
	const { selectedApp } = useApp();
	const { hasChanges, getChangeCount } = useChanges();
	const [publishHistory, setPublishHistory] = useState<PublishHistoryItem[]>(
		[],
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [downloading, setDownloading] = useState(false);
	const [openVersion, setOpenVersion] = useState<string | null>(null);

	const loadReleases = useCallback(async () => {
		if (!selectedApp) {
			return;
		}
		try {
			setLoading(true);
			setError(null);
			const history = await getPublishHistory(selectedApp.id);
			setPublishHistory(history);
			setOpenVersion(history[0]?.version ?? null);
		} catch (err) {
			console.error('Failed to load releases:', err);
			setError(err instanceof Error ? err.message : 'Failed to load releases');
		} finally {
			setLoading(false);
		}
	}, [selectedApp]);

	useEffect(() => {
		const load = async () => {
			if (selectedApp) {
				await loadReleases();
			} else {
				setLoading(false);
			}
		};
		void load();
	}, [selectedApp, loadReleases]);

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const handleDownload = async () => {
		if (!selectedApp) {
			return;
		}
		try {
			setDownloading(true);
			await downloadConfig(selectedApp.identifier);
		} catch (err) {
			console.error('Download failed:', err);
			setError(
				err instanceof Error ? err.message : 'Failed to download configuration',
			);
		} finally {
			setDownloading(false);
		}
	};

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
				<CircularProgress />
			</Box>
		);
	}

	const latest = publishHistory.at(0);

	return (
		<Box sx={{ maxWidth: 1000, mx: 'auto', py: 1 }}>
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
					<Typography variant="h4">Releases</Typography>
					<Typography
						sx={{ fontWeight: 600, fontSize: 13, color: '#8B8472', mt: 0.625 }}
					>
						{selectedApp
							? 'Every published config, newest first. Inspect what changed or roll back to a known-good version.'
							: 'Release history and changelogs'}
					</Typography>
				</Box>
				{latest && (
					<Box
						sx={{
							fontFamily: monoFontFamily,
							fontWeight: 600,
							fontSize: 12,
							color: ink.soft,
							bgcolor: '#fff',
							border: `1px solid ${surface.borderStrong}`,
							borderRadius: '9px',
							p: '8px 12px',
						}}
					>
						current → {latest.version}
					</Box>
				)}
			</Box>

			{!selectedApp && (
				<Alert severity="warning" sx={{ mt: 3 }}>
					Please select an application from the sidebar to view its release
					history.
				</Alert>
			)}
			{error && (
				<Alert severity="error" sx={{ mt: 3 }}>
					{error}
				</Alert>
			)}

			{/* Pending banner */}
			{selectedApp && hasChanges && (
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						gap: 1.75,
						bgcolor: '#FCEFD2',
						border: '1px solid #F3E2BD',
						borderRadius: '14px',
						p: '14px 18px',
						mt: 2.75,
					}}
				>
					<Box
						sx={{
							width: 38,
							height: 38,
							borderRadius: '11px',
							bgcolor: '#fff',
							border: '1px solid #F3E2BD',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							flexShrink: 0,
						}}
					>
						<Ms
							name="pending_actions"
							sx={{ fontSize: 22, color: '#9A6F1C' }}
						/>
					</Box>
					<Box sx={{ flex: 1 }}>
						<Typography sx={{ font: "800 15px 'Baloo 2'", color: '#5E4A18' }}>
							{getChangeCount()} change{getChangeCount() === 1 ? '' : 's'}{' '}
							staged
							{latest ? ` since ${latest.version}` : ''}
						</Typography>
						<Typography
							sx={{
								fontFamily: monoFontFamily,
								fontWeight: 500,
								fontSize: 12,
								color: '#9A7B36',
								mt: 0.25,
							}}
						>
							Not live until published
						</Typography>
					</Box>
					<Button
						component={Link}
						href="/dashboard/publish"
						startIcon={<Ms name="bolt" sx={{ fontSize: 18 }} />}
						sx={technicalButtonSx({ accent: true })}
					>
						Review &amp; publish
					</Button>
				</Box>
			)}

			{selectedApp && (
				<Box
					sx={{
						display: 'flex',
						gap: 2.75,
						alignItems: 'flex-start',
						mt: 3,
						flexWrap: 'wrap',
					}}
				>
					{/* LEFT: timeline */}
					<Box
						sx={{
							flex: 1,
							minWidth: 440,
							display: 'flex',
							flexDirection: 'column',
							gap: 1.75,
						}}
					>
						{publishHistory.length === 0 && (
							<Box
								sx={{
									bgcolor: '#fff',
									border: `1px solid ${surface.border}`,
									borderRadius: '16px',
									p: 6,
									textAlign: 'center',
								}}
							>
								<Ms name="history" sx={{ fontSize: 48, color: ink.muted }} />
								<Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
									No releases yet
								</Typography>
								<Typography
									sx={{
										fontWeight: 600,
										fontSize: 13,
										color: '#8B8472',
										mb: 3,
									}}
								>
									Once you publish your first configuration, it will appear here
									with a detailed changelog.
								</Typography>
								<Button
									component={Link}
									href="/dashboard/publish"
									startIcon={<Ms name="bolt" sx={{ fontSize: 18 }} />}
									sx={technicalButtonSx({ accent: true })}
								>
									Publish config
								</Button>
							</Box>
						)}

						{publishHistory.map((release, index) => {
							const isOpen = openVersion === release.version;
							const isLatest = index === 0;
							const changes = release.changes ?? [];
							return (
								<Box
									key={release.id}
									sx={{
										bgcolor: '#fff',
										border: `1px solid ${surface.border}`,
										borderRadius: '16px',
										boxShadow: '0 1px 2px rgba(40,33,20,.03)',
										overflow: 'hidden',
									}}
								>
									{/* card head */}
									<Box
										onClick={() =>
											setOpenVersion(isOpen ? null : release.version)
										}
										sx={{ p: '18px 20px', cursor: 'pointer' }}
									>
										<Box
											sx={{ display: 'flex', alignItems: 'center', gap: 1.375 }}
										>
											<Typography
												sx={{
													fontFamily: monoFontFamily,
													fontWeight: 700,
													fontSize: 18,
													color: ink.primary,
												}}
											>
												{release.version}
											</Typography>
											{isLatest && (
												<Box
													sx={{
														fontFamily: monoFontFamily,
														fontWeight: 700,
														fontSize: 9,
														letterSpacing: '.05em',
														color: '#fff',
														bgcolor: ink.primary,
														borderRadius: '6px',
														px: 1,
														py: 0.375,
													}}
												>
													LATEST
												</Box>
											)}
											<Box
												sx={{
													ml: 'auto',
													display: 'flex',
													alignItems: 'center',
													gap: 1,
												}}
											>
												<Box
													sx={{
														width: 26,
														height: 26,
														borderRadius: '50%',
														bgcolor: ink.primary,
														color: '#fff',
														font: "800 12px 'Baloo 2'",
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
													}}
												>
													{(release.publishedBy || 'a')[0].toLowerCase()}
												</Box>
												<Typography
													sx={{
														fontWeight: 600,
														fontSize: 12,
														color: ink.soft,
													}}
												>
													by {release.publishedBy || 'unknown'}
												</Typography>
												<Typography
													sx={{
														fontWeight: 600,
														fontSize: 12,
														color: '#B4AC9A',
													}}
												>
													· {formatDate(release.publishedAt)}
												</Typography>
											</Box>
										</Box>
										{release.changelog && (
											<Typography
												sx={{
													fontWeight: 500,
													fontSize: 14,
													color: '#3A352C',
													mt: 1.375,
												}}
											>
												{release.changelog}
											</Typography>
										)}
										<Box
											sx={{
												display: 'flex',
												alignItems: 'center',
												gap: 0.875,
												mt: 1.625,
											}}
										>
											<Box
												sx={{
													fontFamily: monoFontFamily,
													fontWeight: 600,
													fontSize: 11,
													color: ink.soft,
													bgcolor: '#F4ECDC',
													borderRadius: '7px',
													px: 1.125,
													py: 0.5,
												}}
											>
												{release.flagCount} flags
											</Box>
											{changes.length > 0 && (
												<Box
													sx={{
														ml: 'auto',
														display: 'inline-flex',
														alignItems: 'center',
														gap: 0.625,
														fontWeight: 700,
														fontSize: 12,
														color: '#9A6F1C',
													}}
												>
													{isOpen
														? 'Hide changes'
														: `View ${changes.length} changes`}
													<Ms
														name={isOpen ? 'expand_less' : 'expand_more'}
														sx={{ fontSize: 18 }}
													/>
												</Box>
											)}
										</Box>
									</Box>

									{/* expanded diff */}
									{isOpen && changes.length > 0 && (
										<Box
											sx={{
												borderTop: '1px solid #F1EBDD',
												bgcolor: '#FCFAF3',
												p: '18px 20px',
											}}
										>
											<Box
												sx={{
													display: 'flex',
													flexDirection: 'column',
													gap: 0.875,
												}}
											>
												{changes.map((change, ci) => {
													const t = DIFF_TAG[change.action];
													return (
														<Box
															key={ci}
															sx={{
																display: 'flex',
																alignItems: 'center',
																gap: 1.375,
															}}
														>
															<Box
																sx={{
																	width: 78,
																	textAlign: 'center',
																	fontFamily: monoFontFamily,
																	fontWeight: 700,
																	fontSize: 9,
																	color: t.color,
																	bgcolor: t.bg,
																	borderRadius: '6px',
																	py: 0.5,
																	flexShrink: 0,
																}}
															>
																{t.tag}
															</Box>
															<Typography
																sx={{
																	fontFamily: monoFontFamily,
																	fontWeight: 500,
																	fontSize: 13,
																	color: ink.primary,
																}}
															>
																{change.key}
															</Typography>
															{change.name && (
																<Typography
																	sx={{
																		fontWeight: 600,
																		fontSize: 12,
																		color: ink.muted,
																	}}
																>
																	{change.name}
																</Typography>
															)}
														</Box>
													);
												})}
											</Box>
											<Box
												sx={{
													display: 'flex',
													gap: 1.125,
													borderTop: '1px solid #F1EBDD',
													pt: 1.875,
													mt: 2,
												}}
											>
												<Button
													variant="outlined"
													size="small"
													onClick={() => void handleDownload()}
													disabled={downloading}
													startIcon={
														<Ms name="download" sx={{ fontSize: 17 }} />
													}
												>
													{downloading ? 'Downloading…' : 'Download artifact'}
												</Button>
											</Box>
										</Box>
									)}
								</Box>
							);
						})}
					</Box>

					{/* RIGHT: stats */}
					{publishHistory.length > 0 && (
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
							<Box
								sx={{
									bgcolor: '#fff',
									border: `1px solid ${surface.border}`,
									borderRadius: '16px',
									p: 2.5,
								}}
							>
								<Typography sx={{ font: "800 15px 'Baloo 2'", mb: 1.75 }}>
									Release stats
								</Typography>
								<Box
									sx={{
										display: 'grid',
										gridTemplateColumns: 'repeat(2, 1fr)',
										gap: 1.25,
									}}
								>
									{[
										{ n: publishHistory.length, l: 'total releases' },
										{ n: latest?.flagCount ?? 0, l: 'flags live' },
									].map((s) => (
										<Box
											key={s.l}
											sx={{
												border: `1px solid ${surface.border}`,
												borderRadius: '12px',
												bgcolor: '#FCFAF3',
												p: '13px 14px',
											}}
										>
											<Typography sx={{ font: "800 24px 'Baloo 2'" }}>
												{s.n}
											</Typography>
											<Typography
												sx={{
													fontWeight: 600,
													fontSize: 11,
													color: '#8B8472',
													mt: 0.25,
												}}
											>
												{s.l}
											</Typography>
										</Box>
									))}
								</Box>
								<Box
									sx={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										pt: 1.625,
										mt: 0.75,
										borderTop: '1px solid #F1EBDD',
									}}
								>
									<Typography
										sx={{ fontWeight: 600, fontSize: 12, color: '#8B8472' }}
									>
										Latest version
									</Typography>
									<Typography
										sx={{
											fontFamily: monoFontFamily,
											fontWeight: 700,
											fontSize: 13,
										}}
									>
										{latest?.version}
									</Typography>
								</Box>
								<Box
									sx={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										pt: 1.375,
									}}
								>
									<Typography
										sx={{ fontWeight: 600, fontSize: 12, color: '#8B8472' }}
									>
										Last published
									</Typography>
									<Typography
										sx={{
											fontFamily: monoFontFamily,
											fontWeight: 700,
											fontSize: 13,
										}}
									>
										{latest ? formatDate(latest.publishedAt) : '—'}
									</Typography>
								</Box>
							</Box>
						</Box>
					)}
				</Box>
			)}
		</Box>
	);
}
