'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { RuleConditionType } from '@/types/rules';
import { fetchCohorts, type Cohort } from '@/lib/api';

export interface ConditionContext {
  allowedTypes: RuleConditionType[];
  title?: string;
  description?: string;
}

interface ConditionsContextValue {
  cohorts: Cohort[];
  loading: boolean;
  error: string | null;
  getContextConfig: (contextType: ConditionContextType) => ConditionContext;
  refreshCohorts: () => Promise<void>;
}

export type ConditionContextType = 'cohort' | 'flag_variant' | 'test_entry' | 'rollout_entry';

const ConditionsContext = createContext<ConditionsContextValue | undefined>(undefined);

interface ConditionsProviderProps {
  children: ReactNode;
  appId?: string;
}

export function ConditionsProvider({ children, appId }: ConditionsProviderProps) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCohorts = async () => {
    if (!appId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const cohortsData = await fetchCohorts(appId);
      setCohorts(cohortsData);
    } catch (err) {
      console.error('Failed to load cohorts:', err);
      setError('Failed to load cohorts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCohorts();
  }, [appId]);

  const getContextConfig = (contextType: ConditionContextType): ConditionContext => {
    switch (contextType) {
      case 'cohort':
        return {
          allowedTypes: ['app_version', 'os_version', 'platform', 'country'],
          title: 'Create Cohort Condition',
          description: 'Define targeting criteria for this cohort. Cohorts cannot reference other cohorts to prevent circular dependencies.'
        };
      
      case 'flag_variant':
        return {
          allowedTypes: ['app_version', 'os_version', 'platform', 'country', 'cohort'],
          title: 'Create Flag Condition',
          description: 'Define when this variant should be applied. This condition will be evaluated in the selected environment.'
        };
      
      case 'test_entry':
        return {
          allowedTypes: ['app_version', 'os_version', 'platform', 'country', 'cohort'],
          title: 'Create Test Entry Condition',
          description: 'Define who can enter this A/B test. Users must meet all conditions to be included in the test.'
        };
      
      case 'rollout_entry':
        return {
          allowedTypes: ['app_version', 'os_version', 'platform', 'country', 'cohort'],
          title: 'Create Rollout Entry Condition',
          description: 'Define who can be included in this rollout. Users must meet all conditions to be eligible for the rollout.'
        };
      
      default:
        return {
          allowedTypes: ['app_version', 'os_version', 'platform', 'country'],
          title: 'Create Condition',
          description: 'Define targeting criteria for this condition.'
        };
    }
  };

  const value: ConditionsContextValue = {
    cohorts,
    loading,
    error,
    getContextConfig,
    refreshCohorts: loadCohorts
  };

  return (
    <ConditionsContext.Provider value={value}>
      {children}
    </ConditionsContext.Provider>
  );
}

export function useConditions() {
  const context = useContext(ConditionsContext);
  if (context === undefined) {
    throw new Error('useConditions must be used within a ConditionsProvider');
  }
  return context;
}

// Convenience hook for getting context-specific configurations
export function useConditionContext(contextType: ConditionContextType) {
  const { getContextConfig, ...rest } = useConditions();
  return {
    ...rest,
    config: getContextConfig(contextType)
  };
}