import { createContext } from 'react';

export type AppearancePreference = 'system' | 'light' | 'dark';

export const AppearanceContext = createContext<AppearancePreference>('system');
