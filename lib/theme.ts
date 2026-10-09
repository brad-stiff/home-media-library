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
    background: '#121416',
    surface: '#1C1E22',
    surfaceElevated: '#26282E',
    border: '#2E3136',
    text: '#F4F4F5',
    textSecondary: '#A6A6AD',
    textTertiary: '#8E8E96',
    accent: '#E0A84A',
    accentText: '#1A1408',
    accentMuted: '#2C2618',
    danger: '#FF453A',
    dangerMuted: '#3A1F1D',
    placeholder: '#5C5C64',
    overlay: 'rgba(0,0,0,0.6)',
  },
  light: {
    background: '#F4F4F5',
    surface: '#FFFFFF',
    surfaceElevated: '#E8E8EC',
    border: '#E4E4E7',
    text: '#18181B',
    textSecondary: '#5E5E66',
    textTertiary: '#62626A',
    accent: '#8A5A12',
    accentText: '#FFFFFF',
    accentMuted: '#F6EBD8',
    danger: '#FF3B30',
    dangerMuted: '#FFECEB',
    placeholder: '#C4C4C8',
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
