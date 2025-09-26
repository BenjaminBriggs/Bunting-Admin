'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchCohorts } from '@/lib/api';
import { DBCohort } from '@/types';
import { useApp } from '@/lib/app-context';

export type ConditionContextType = 'cohort' | 'flag_variant';

interface ConditionContextData {
  cohorts: DBCohort[];
  loading: boolean;
  error: string | null;
  config: Record<string, any>;
}

const ConditionContext = createContext<ConditionContextData | undefined>(undefined);

interface ConditionsProviderProps {
  children: ReactNode;
  appId: string;
}

export function ConditionsProvider({ children, appId }: ConditionsProviderProps) {
  const [cohorts, setCohorts] = useState<DBCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCohorts = async () => {
      if (!appId) {
        setCohorts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const cohortsData = await fetchCohorts(appId);
        setCohorts(cohortsData);
      } catch (err) {
        console.error('Failed to load cohorts:', err);
        setError('Failed to load cohorts');
        setCohorts([]);
      } finally {
        setLoading(false);
      }
    };

    loadCohorts();
  }, [appId]);

  return (
    <ConditionContext.Provider value={{
      cohorts,
      loading,
      error,
      config: {} // Basic config object for future extensibility
    }}>
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

export function useConditionContext(contextType: ConditionContextType) {
  const context = useConditions();

  // Provide context-specific configuration
  const config = {
    title: contextType === 'cohort' ? 'Add Rule Condition' : 'Add Targeting Condition',
    allowedTypes: contextType === 'cohort'
      ? ['app_version', 'os_version', 'build_number', 'platform', 'device_model', 'region', 'locale', 'custom_attribute'] // Exclude 'cohort' to prevent circular references
      : ['app_version', 'os_version', 'build_number', 'platform', 'device_model', 'region', 'locale', 'cohort', 'custom_attribute'] // Include 'cohort' for flag variants
  };

  return {
    ...context,
    config
  };
}