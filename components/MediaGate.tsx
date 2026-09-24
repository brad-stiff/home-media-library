import { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useHousehold } from '../lib/householdContext';
import { isTypeVisible, MediaType, useProfile } from '../lib/profile';
import { spacing, useTheme } from '../lib/theme';

const LABELS: Record<MediaType, string> = {
  movies: 'Movies',
  books: 'Books',
  mtg: 'MTG',
};

export function MediaGate({ type, children }: PropsWithChildren<{ type: MediaType }>) {
  const { household, loading } = useHousehold();
  const { profile, loading: profileLoading } = useProfile();
  const { colors } = useTheme();

  if (loading || profileLoading || !household) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!isTypeVisible(household, profile, type)) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.title, { color: colors.text }]}>{LABELS[type]} is hidden</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Open Settings to change what you see. An admin turns types on for the whole household.
        </Text>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
});
