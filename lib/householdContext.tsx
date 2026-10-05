import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from './auth';
import { fetchMyHousehold, HouseholdMembership } from './household';

type HouseholdContextValue = {
  household: HouseholdMembership | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [household, setHousehold] = useState<HouseholdMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setHousehold(null);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setHousehold(await fetchMyHousehold());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your household.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ household, loading, error, refresh }),
    [household, loading, error, refresh],
  );

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold must be used within HouseholdProvider');
  }
  return context;
}
