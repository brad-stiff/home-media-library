import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { AppearanceContext, AppearancePreference } from './appearanceContext';
import { useAuth } from './auth';
import { HouseholdMembership } from './household';
import { supabase } from './supabase';

export type MediaType = 'movies' | 'books' | 'mtg';

export type UserProfile = {
  displayName: string | null;
  appearance: AppearancePreference;
  hideMovies: boolean;
  hideBooks: boolean;
  hideMtg: boolean;
};

type PersonalHide = Pick<UserProfile, 'hideMovies' | 'hideBooks' | 'hideMtg'>;

type ProfileContextValue = {
  profile: UserProfile;
  loading: boolean;
  refresh: () => Promise<void>;
  saveDisplayName: (name: string) => Promise<void>;
  saveAppearance: (appearance: AppearancePreference) => Promise<void>;
  savePersonalHide: (hide: PersonalHide) => Promise<void>;
};

const DEFAULT_PROFILE: UserProfile = {
  displayName: null,
  appearance: 'system',
  hideMovies: false,
  hideBooks: false,
  hideMtg: false,
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

function appearanceKey(userId: string) {
  return `hml.appearance.${userId}`;
}

function isAppearance(value: string | null): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function rowToProfile(row: {
  display_name: string | null;
  appearance: string | null;
  hide_movies: boolean | null;
  hide_books: boolean | null;
  hide_mtg: boolean | null;
}): UserProfile {
  return {
    displayName: row.display_name,
    appearance: isAppearance(row.appearance) ? row.appearance : 'system',
    hideMovies: row.hide_movies ?? false,
    hideBooks: row.hide_books ?? false,
    hideMtg: row.hide_mtg ?? false,
  };
}

export function householdShows(household: HouseholdMembership, type: MediaType): boolean {
  if (type === 'movies') return household.showMovies;
  if (type === 'books') return household.showBooks;
  return household.showMtg;
}

export function isTypeVisible(
  household: HouseholdMembership,
  profile: UserProfile,
  type: MediaType,
): boolean {
  if (!householdShows(household, type)) return false;
  if (type === 'movies') return !profile.hideMovies;
  if (type === 'books') return !profile.hideBooks;
  return !profile.hideMtg;
}

export function ProfileProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfile(DEFAULT_PROFILE);
      setLoading(false);
      return;
    }

    const cached = await AsyncStorage.getItem(appearanceKey(user.id));
    if (isAppearance(cached)) {
      setProfile((prev) => ({ ...prev, appearance: cached }));
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, appearance, hide_movies, hide_books, hide_mtg')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;

    const next = data ? rowToProfile(data) : DEFAULT_PROFILE;
    setProfile(next);
    await AsyncStorage.setItem(appearanceKey(user.id), next.appearance);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void refresh().catch(() => {
      setLoading(false);
    });
  }, [refresh]);

  const saveDisplayName = useCallback(
    async (name: string) => {
      if (!user) throw new Error('Not signed in');
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Enter a display name');

      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', user.id);
      if (error) throw error;
      setProfile((prev) => ({ ...prev, displayName: trimmed }));
    },
    [user],
  );

  const saveAppearance = useCallback(
    async (appearance: AppearancePreference) => {
      if (!user) throw new Error('Not signed in');
      const previous = profile.appearance;
      setProfile((prev) => ({ ...prev, appearance }));
      await AsyncStorage.setItem(appearanceKey(user.id), appearance);

      const { error } = await supabase.from('profiles').update({ appearance }).eq('id', user.id);
      if (error) {
        setProfile((prev) => ({ ...prev, appearance: previous }));
        await AsyncStorage.setItem(appearanceKey(user.id), previous);
        throw error;
      }
    },
    [profile.appearance, user],
  );

  const savePersonalHide = useCallback(
    async (hide: PersonalHide) => {
      if (!user) throw new Error('Not signed in');
      const previous = {
        hideMovies: profile.hideMovies,
        hideBooks: profile.hideBooks,
        hideMtg: profile.hideMtg,
      };
      setProfile((prev) => ({ ...prev, ...hide }));

      const { error } = await supabase
        .from('profiles')
        .update({
          hide_movies: hide.hideMovies,
          hide_books: hide.hideBooks,
          hide_mtg: hide.hideMtg,
        })
        .eq('id', user.id);

      if (error) {
        setProfile((prev) => ({ ...prev, ...previous }));
        throw error;
      }
    },
    [profile.hideBooks, profile.hideMovies, profile.hideMtg, user],
  );

  const value = useMemo(
    () => ({
      profile,
      loading,
      refresh,
      saveDisplayName,
      saveAppearance,
      savePersonalHide,
    }),
    [profile, loading, refresh, saveDisplayName, saveAppearance, savePersonalHide],
  );

  return (
    <AppearanceContext.Provider value={profile.appearance}>
      <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
    </AppearanceContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
}
