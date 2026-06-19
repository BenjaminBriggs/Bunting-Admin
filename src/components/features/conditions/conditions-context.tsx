'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { ConditionType } from '@/types/core';

export type ConditionContextType = 'flag_variant';

interface ConditionContextData {
	loading: boolean;
	error: string | null;
	config: Record<string, unknown>;
}

export interface ConditionUIConfig {
	title: string;
	allowedTypes: ConditionType[];
	description?: string;
}

const ConditionContext = createContext<ConditionContextData | undefined>(
	undefined,
);

interface ConditionsProviderProps {
	children: ReactNode;
	appId: string;
}

export function ConditionsProvider({ children }: ConditionsProviderProps) {
	return (
		<ConditionContext.Provider
			value={{
				loading: false,
				error: null,
				config: {}, // Basic config object for future extensibility
			}}
		>
			{children}
		</ConditionContext.Provider>
	);
}

export function useConditions() {
	const context = useContext(ConditionContext);
	if (!context) {
		throw new Error('useConditions must be used within a ConditionsProvider');
	}
	return context;
}

export function useConditionContext(_contextType: ConditionContextType) {
	const context = useConditions();

	// Provide context-specific configuration
	const config: ConditionUIConfig = {
		title: 'Add Targeting Condition',
		allowedTypes: [
			'app_version',
			'os_version',
			'build_number',
			'platform',
			'device_model',
			'region',
			'language',
			'custom_attribute',
		],
	};

	return {
		...context,
		config,
	};
}
