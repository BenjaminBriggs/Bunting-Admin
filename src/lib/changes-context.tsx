'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppNotFoundError, generateCurrentConfig, getPublishedConfig } from './api';
import { useApp } from './app-context';
import type { ConfigChange } from './config-comparison';
import { getConfigChanges, hasConfigChanges } from './config-comparison';

interface ChangesContextType {
	hasChanges: boolean;
	changes: ConfigChange[];
	loading: boolean;
	error: string | null;
	refreshChanges: () => Promise<void>;
	markChangesDetected: () => void;
	markChangesPublished: () => void;
	getChangeCount: () => number;
}

const ChangesContext = createContext<ChangesContextType | undefined>(undefined);

export function ChangesProvider({ children }: { children: ReactNode }) {
	const { selectedApp, refreshApps } = useApp();
	const [hasChanges, setHasChanges] = useState(false);
	const [changes, setChanges] = useState<ConfigChange[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const refreshChanges = async () => {
		if (!selectedApp) {
			setHasChanges(false);
			setChanges([]);
			setLoading(false);
			return;
		}

		try {
			setLoading(true);
			setError(null);

			// Generate current config from database
			const currentConfig = await generateCurrentConfig(selectedApp.id);

			// Get published config from S3
			const publishedResult = await getPublishedConfig(selectedApp.identifier);
			const publishedConfig = publishedResult.config;

			// Compare configurations
			const hasChangesDetected = hasConfigChanges(
				currentConfig,
				publishedConfig,
			);
			const detectedChanges = getConfigChanges(currentConfig, publishedConfig);

			setHasChanges(hasChangesDetected);
			setChanges(detectedChanges);
		} catch (err) {
			// The selected app vanished (empty/recreated DB, deleted app). Don't
			// surface an error — reconcile the app list, which clears the stale
			// selection and lets the dashboard route the operator to setup.
			if (err instanceof AppNotFoundError) {
				setHasChanges(false);
				setChanges([]);
				void refreshApps();
				return;
			}
			console.error('Error checking for changes:', err);
			setError(
				err instanceof Error ? err.message : 'Failed to check for changes',
			);
			setHasChanges(false);
			setChanges([]);
		} finally {
			setLoading(false);
		}
	};

	const getChangeCount = () => changes.length;

	// Event-driven change detection methods
	const markChangesDetected = () => {
		// Trigger a change detection check after a brief delay
		// to allow database operations to complete
		setTimeout(() => {
			refreshChanges();
		}, 500);
	};

	const markChangesPublished = () => {
		// Clear changes immediately when published
		setHasChanges(false);
		setChanges([]);
		setError(null);
	};

	// Initial load when selected app changes
	useEffect(() => {
		if (selectedApp) {
			refreshChanges();
		}
	}, [selectedApp]); // eslint-disable-line react-hooks/exhaustive-deps

	// Reduced frequency fallback polling (every 5 minutes)
	// This catches any changes from external sources
	useEffect(() => {
		if (!selectedApp) {
			return;
		}

		const interval = setInterval(refreshChanges, 300000); // 5 minutes
		return () => clearInterval(interval);
	}, [selectedApp]); // eslint-disable-line react-hooks/exhaustive-deps

	const value: ChangesContextType = {
		hasChanges,
		changes,
		loading,
		error,
		refreshChanges,
		markChangesDetected,
		markChangesPublished,
		getChangeCount,
	};

	return (
		<ChangesContext.Provider value={value}>{children}</ChangesContext.Provider>
	);
}

export function useChanges() {
	const context = useContext(ChangesContext);
	if (context === undefined) {
		throw new Error('useChanges must be used within a ChangesProvider');
	}
	return context;
}
