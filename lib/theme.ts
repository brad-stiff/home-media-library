import { useColorScheme } from 'react-native';

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export function posterUrl(path: string | null, size: 'w342' | 'w500' | 'w780' = 'w500'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function backdropUrl(path: string | null): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/w780${path}`;
}

export function extractYear(releaseDate: string | null | undefined): string | null {
  if (!releaseDate) return null;
  const year = releaseDate.slice(0, 4);
  return year || null;
}

export function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

const palette = {
  dark: {
    background: '#0A0A0B',
    surface: '#161618',
    surfaceElevated: '#1E1E22',
    border: '#2A2A2E',
    text: '#F5F5F7',
    textSecondary: '#98989F',
    textTertiary: '#636366',
    accent: '#E8B04B',
    accentText: '#1A1408',
    accentMuted: '#2E2618',
    danger: '#FF453A',
    dangerMuted: '#3A1F1D',
    placeholder: '#48484A',
    overlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    border: '#E5E5EA',
    text: '#1C1C1E',
    textSecondary: '#636366',
    textTertiary: '#8E8E93',
    accent: '#C9922A',
    accentText: '#FFFFFF',
    accentMuted: '#FFF4DC',
    danger: '#FF3B30',
    dangerMuted: '#FFECEB',
    placeholder: '#C7C7CC',
    overlay: 'rgba(0,0,0,0.4)',
  },
} as const;

export type ThemeColors = (typeof palette)['dark'];

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';
  return {
    colors: isDark ? palette.dark : palette.light,
    isDark,
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;
