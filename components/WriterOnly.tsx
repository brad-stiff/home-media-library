import { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useHousehold } from '../lib/householdContext';
import { isWriter } from '../lib/roles';
import { spacing, useTheme } from '../lib/theme';

export function WriterOnly({ children }: PropsWithChildren) {
  const { household, loading } = useHousehold();
  const { colors } = useTheme();

  if (loading || !household) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!isWriter(household.role)) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.title, { color: colors.text }]}>Viewers can browse only</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Ask an admin to promote you before adding or editing.
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
