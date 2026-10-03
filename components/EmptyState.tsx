import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from './PrimaryButton';
import { spacing, typeScale, useTheme } from '../lib/theme';

interface EmptyStateProps {
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, typeScale.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, typeScale.body, { color: colors.textSecondary }]}>{message}</Text>
      {action ? (
        <View style={styles.action}>
          <PrimaryButton label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
});
