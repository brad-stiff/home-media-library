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
  refresh: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [household, setHousehold] = useState<HouseholdMembership | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setHousehold(null);
      setLoading(false);
      return;
    }

    try {
      setHousehold(await fetchMyHousehold());
    } catch {
      setHousehold(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ household, loading, refresh }),
    [household, loading, refresh],
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
