import { useContext } from 'react';
import { useColorScheme } from 'react-native';

import { AppearanceContext } from './appearanceContext';

export {
  TMDB_IMAGE_BASE,
  backdropUrl,
  extractYear,
  formatRuntime,
  posterUrl,
} from './mediaFormat';

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
  const preference = useContext(AppearanceContext);
  const isDark =
    preference === 'dark' || (preference !== 'light' && scheme !== 'light');
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

export const typeScale = {
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
} as const;
