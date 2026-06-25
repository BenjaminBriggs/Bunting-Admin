'use client';

import { useSession } from 'next-auth/react';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { type App, fetchApps } from './api';

interface AppContextType {
	apps: App[];
	selectedApp: App | null;
	loading: boolean;
	error: string | null;
	setSelectedApp: (app: App) => void;
	refreshApps: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
	const { status } = useSession();
	const [apps, setApps] = useState<App[]>([]);
	const [selectedApp, setSelectedAppState] = useState<App | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const refreshApps = async () => {
		try {
			setLoading(true);
			setError(null);
			const appsData = await fetchApps();
			setApps(appsData);
			// Reconcile the current selection against the fresh list: re-point an
			// existing selection to the up-to-date object, and otherwise auto-select
			// the first app (covers no prior selection, or a selected app that no
			// longer exists — e.g. the DB was recreated under a running tab).
			setSelectedAppState((prev) => {
				const reconciled = prev
					? appsData.find((a) => a.id === prev.id)
					: undefined;
				return reconciled ?? appsData.at(0) ?? null;
			});
		} catch (err) {
			console.error('Error loading apps:', err);
			setError(
				err instanceof Error ? err.message : 'Failed to load applications',
			);
			setApps([]);
			setSelectedAppState(null);
		} finally {
			setLoading(false);
		}
	};

	const setSelectedApp = (app: App) => {
		setSelectedAppState(app);
	};

	// Initial load - only when authenticated. (Auto-selection of the first app is
	// handled inside refreshApps' reconciliation, so no separate effect is needed.)
	useEffect(() => {
		if (status === 'authenticated') {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: refreshApps sets a loading flag before an async fetch once authenticated
			void refreshApps();
		}
	}, [status]);

	const value: AppContextType = {
		apps,
		selectedApp,
		loading,
		error,
		setSelectedApp,
		refreshApps,
	};

	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
	const context = useContext(AppContext);
	if (context === undefined) {
		throw new Error('useApp must be used within an AppProvider');
	}
	return context;
}
