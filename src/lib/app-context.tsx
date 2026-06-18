'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
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
	const router = useRouter();
	const { data: session, status } = useSession();
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
			// Reconcile the current selection against the fresh list: re-point it to
			// the up-to-date object, or clear it if the app no longer exists (e.g. the
			// DB was recreated under a running tab, or the app was deleted). Auto-select
			// then picks apps[0] when any remain.
			setSelectedAppState((prev) =>
				prev ? (appsData.find((a) => a.id === prev.id) ?? null) : null,
			);
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

	// Initial load - only when authenticated
	useEffect(() => {
		if (status === 'authenticated') {
			refreshApps();
		}
	}, [status]);

	// Auto-select first app when apps change and no app is selected
	useEffect(() => {
		if (apps.length > 0 && !selectedApp) {
			setSelectedAppState(apps[0]);
		}
	}, [apps, selectedApp]);

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
