'use client';

// Confirmation for finishing a test or rollout. The two actions have opposite
// effects on users, so each spells out what happens before anything is sent:
// - complete: the shipped value (a test's winning group) is baked into the
//   attached flags, then the test/rollout is archived;
// - abandon: it is archived with nothing baked, so users go back to what the
//   flags serve without it.
// Both are draft changes that reach apps on the next publish.

import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControlLabel,
	Radio,
	RadioGroup,
	Typography,
} from '@mui/material';
import { useState } from 'react';

export type FinishAction = 'complete' | 'abandon';

interface FinishDialogProps {
	open: boolean;
	action: FinishAction;
	kind: 'test' | 'rollout';
	name: string;
	/** Entry conditions decide where a completion is baked (variant vs default). */
	hasConditions: boolean;
	/** Test group names; completing a test asks for the winner among these. */
	groups?: string[];
	busy: boolean;
	error: string | null;
	onConfirm: (winner?: string) => void;
	onClose: () => void;
}

function effectText(
	action: FinishAction,
	kind: 'test' | 'rollout',
	hasConditions: boolean,
): string[] {
	if (action === 'abandon') {
		return [
			kind === 'test'
				? "Users in this test go back to what each attached flag serves without it, usually its default value. No group's values are kept."
				: "Users in this rollout go back to what each attached flag serves without it, usually its default value. The rollout's values are not kept.",
			kind === 'test'
				? 'The test is archived and cannot be restarted.'
				: 'The rollout is archived at 0% and cannot be restarted.',
		];
	}
	if (kind === 'test') {
		return [
			hasConditions
				? "Choose the winning group. Everyone who matches the test's entry conditions will get the winner's values: in each attached flag, the test is replaced by a conditional variant with the same conditions, in the same position."
				: "Choose the winning group. Everyone will get the winner's values: in each attached flag, the winner's value becomes the default in every environment where the group sets one.",
			'The test is then archived and cannot be restarted.',
		];
	}
	return [
		hasConditions
			? "Everyone who matches this rollout's entry conditions will get the rollout value: in each attached flag, the rollout is replaced by a conditional variant with the same conditions, in the same position."
			: 'Everyone will get the rollout value: in each attached flag, it becomes the default in every environment where the rollout sets one.',
		'The rollout is then archived and cannot be restarted.',
	];
}

export function FinishDialog({
	open,
	action,
	kind,
	name,
	hasConditions,
	groups = [],
	busy,
	error,
	onConfirm,
	onClose,
}: FinishDialogProps) {
	const [winner, setWinner] = useState('');
	const needsWinner = action === 'complete' && kind === 'test';
	const verb = action === 'complete' ? 'Complete' : 'Abandon';
	const canConfirm = !busy && (!needsWinner || winner !== '');

	return (
		<Dialog
			open={open}
			onClose={busy ? undefined : onClose}
			maxWidth="sm"
			fullWidth
		>
			<DialogTitle>
				{verb} {kind} &ldquo;{name}&rdquo;?
			</DialogTitle>
			<DialogContent>
				{effectText(action, kind, hasConditions).map((text) => (
					<Typography key={text} sx={{ fontSize: 14, mb: 1.25 }}>
						{text}
					</Typography>
				))}

				{needsWinner && (
					<Box sx={{ mt: 1 }}>
						<Typography sx={{ fontWeight: 700, fontSize: 13 }}>
							Winning group
						</Typography>
						<RadioGroup
							value={winner}
							onChange={(e) => setWinner(e.target.value)}
						>
							{groups.map((g) => (
								<FormControlLabel
									key={g}
									value={g}
									control={<Radio size="small" />}
									label={g}
									disabled={busy}
								/>
							))}
						</RadioGroup>
					</Box>
				)}

				<Alert severity="info" sx={{ mt: 1.5 }}>
					This is a draft change. Apps get it after your next publish.
				</Alert>
				{error && (
					<Alert severity="error" sx={{ mt: 1.5 }}>
						{error}
					</Alert>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button variant="outlined" onClick={onClose} disabled={busy}>
					Cancel
				</Button>
				<Button
					variant="contained"
					color={action === 'abandon' ? 'error' : 'primary'}
					disabled={!canConfirm}
					onClick={() => onConfirm(needsWinner ? winner : undefined)}
					startIcon={busy ? <CircularProgress size={16} /> : undefined}
				>
					{verb} {kind}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
