import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from './theme';

type ToastTone = 'success' | 'error';

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

type LiftApi = {
  set: (id: string, lift: number) => void;
  clear: (id: string) => void;
};

const ToastLiftContext = createContext<LiftApi | null>(null);

/** Keep a toast above a bottom bar. Several screens can register; the tallest lift wins. */
export function useToastLift(id: string, lift: number) {
  const api = useContext(ToastLiftContext);
  useEffect(() => {
    if (!api) return undefined;
    api.set(id, lift);
    return () => api.clear(id);
  }, [api, id, lift]);
}

export function ToastProvider({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [lift, setLift] = useState(0);
  const lifts = useRef(new Map<string, number>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liftApi = useMemo<LiftApi>(
    () => ({
      set: (id, value) => {
        lifts.current.set(id, value);
        setLift(Math.max(0, ...lifts.current.values()));
      },
      clear: (id) => {
        lifts.current.delete(id);
        setLift(lifts.current.size === 0 ? 0 : Math.max(0, ...lifts.current.values()));
      },
    }),
    [],
  );

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastLiftContext.Provider value={liftApi}>
      <View style={styles.fill}>
        {children}
        {toast ? (
          <View
            style={[
              styles.banner,
              {
                bottom: insets.bottom + spacing.md + lift,
                backgroundColor: colors.surfaceElevated,
                borderColor: toast.tone === 'error' ? colors.danger : colors.border,
                pointerEvents: 'none',
              },
            ]}
          >
            <Text style={[styles.message, { color: colors.text }]}>{toast.message}</Text>
          </View>
        ) : null}
      </View>
      </ToastLiftContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  banner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
