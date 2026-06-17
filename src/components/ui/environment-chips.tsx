'use client';

import { Chip } from '@mui/material';
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
		case 'staging':
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
 * Festive Bunting palette mapped to environments — green Production,
 * amber Staging, teal Development. Used for the colored env header bands
 * and the compact flag-row summaries.
 */
export function getEnvironmentBandColors(
	environment: Environment,
): EnvironmentBandColors {
	switch (environment) {
		case 'production':
			return {
				bg: '#E9F4E0',
				border: '#DCEDCF',
				dot: '#82C868',
				text: '#3F7A2D',
				short: 'PROD',
			};
		case 'staging':
			return {
				bg: '#FCEFD2',
				border: '#F3E2BD',
				dot: '#F6A444',
				text: '#9A6F1C',
				short: 'STG',
			};
		case 'development':
			return {
				bg: '#DEF3F0',
				border: '#C9ECE7',
				dot: '#54C9C0',
				text: '#1E7B72',
				short: 'DEV',
			};
		default:
			return {
				bg: '#EFE8D9',
				border: '#E4DBC8',
				dot: '#A79F8C',
				text: '#6B6452',
				short: environment,
			};
	}
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
