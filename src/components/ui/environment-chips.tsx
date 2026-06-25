'use client';

import { Chip } from '@mui/material';
import { envColors } from '@/theme/designTokens';
import type { Environment } from '@/types';

interface EnvironmentChipsProps {
	environment: Environment;
	size?: 'small' | 'medium';
	variant?: 'filled' | 'outlined';
	clickable?: boolean;
	onClick?: () => void;
}

interface MultiEnvironmentChipsProps {
	environments: Environment[];
	size?: 'small' | 'medium';
	variant?: 'filled' | 'outlined';
	onEnvironmentClick?: (environment: Environment) => void;
}

export function getEnvironmentColor(environment: Environment) {
	switch (environment) {
		case 'development':
			return 'info' as const;
		case 'beta':
			return 'warning' as const;
		case 'production':
			return 'success' as const;
		default:
			return 'default' as const;
	}
}

export function getEnvironmentLabel(environment: Environment): string {
	return environment.charAt(0).toUpperCase() + environment.slice(1);
}

export interface EnvironmentBandColors {
	/** Header band background tint */
	bg: string;
	/** Header band bottom border */
	border: string;
	/** Status dot fill */
	dot: string;
	/** Label / accent text */
	text: string;
	/** Short label used in compact summaries */
	short: string;
}

/**
 * Environment band colours — Development yellow, Beta blue, Production purple.
 * Delegates to the single source of truth (`envColors` in designTokens) so the
 * env palette can never drift from the Flags-list columns.
 */
const ENV_SHORT: Record<Environment, string> = {
	production: 'PROD',
	beta: 'STG',
	development: 'DEV',
};

export function getEnvironmentBandColors(
	environment: Environment,
): EnvironmentBandColors {
	const c = envColors[environment];
	return {
		bg: c.headerBg,
		border: c.border,
		dot: c.dot,
		text: c.text,
		short: ENV_SHORT[environment],
	};
}

export function EnvironmentChip({
	environment,
	size = 'small',
	variant = 'filled',
	clickable = false,
	onClick,
}: EnvironmentChipsProps) {
	return (
		<Chip
			label={getEnvironmentLabel(environment)}
			color={getEnvironmentColor(environment)}
			size={size}
			variant={variant}
			clickable={clickable}
			onClick={onClick}
		/>
	);
}

export function EnvironmentChips({
	environments,
	size = 'small',
	variant = 'filled',
	onEnvironmentClick,
}: MultiEnvironmentChipsProps) {
	return (
		<>
			{environments.map((env) => (
				<EnvironmentChip
					key={env}
					environment={env}
					size={size}
					variant={variant}
					clickable={Boolean(onEnvironmentClick)}
					onClick={() => onEnvironmentClick?.(env)}
				/>
			))}
		</>
	);
}

export default EnvironmentChip;
