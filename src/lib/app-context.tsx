'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { fetchApps, type App } from './api';

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

      // If no apps exist and user is authenticated, redirect to setup
      if (appsData.length === 0 && status === 'authenticated') {
        router.replace('/setup');
        return;
      }
    } catch (err) {
      console.error('Error loading apps:', err);
      setError(err instanceof Error ? err.message : 'Failed to load applications');
      setApps([]);
      setSelectedAppState(null);

      // On error and authenticated, also redirect to setup
      if (status === 'authenticated') {
        router.replace('/setup');
        return;
      }
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

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}