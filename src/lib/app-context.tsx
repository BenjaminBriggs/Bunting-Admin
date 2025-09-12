'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
      
      // If we don't have a selected app, or the selected app no longer exists, select the first one
      if (!selectedApp || !appsData.find(app => app.id === selectedApp.id)) {
        if (appsData.length > 0) {
          setSelectedAppState(appsData[0]);
        } else {
          setSelectedAppState(null);
        }
      }
    } catch (err) {
      console.error('Error loading apps:', err);
      setError(err instanceof Error ? err.message : 'Failed to load applications');
      setApps([]);
      setSelectedAppState(null);
    } finally {
      setLoading(false);
    }
  };

  const setSelectedApp = (app: App) => {
    setSelectedAppState(app);
  };

  // Initial load
  useEffect(() => {
    refreshApps();
  }, []);

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