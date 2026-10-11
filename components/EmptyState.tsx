import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from './PrimaryButton';
import { spacing, typeScale, useTheme } from '../lib/theme';

interface EmptyStateProps {
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
  actions?: { label: string; onPress: () => void }[];
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function EmptyState({ title, message, action, actions, refreshing = false, onRefresh }: EmptyStateProps) {
  const { colors } = useTheme();
  const buttons = actions && actions.length > 0 ? actions : action ? [action] : [];

  const body = (
    <View style={styles.container}>
      <Text style={[styles.title, typeScale.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, typeScale.body, { color: colors.textSecondary }]}>{message}</Text>
      {buttons.length > 0 ? (
        <View style={styles.action}>
          {buttons.map((button) => (
            <PrimaryButton key={button.label} label={button.label} onPress={button.onPress} />
          ))}
        </View>
      ) : null}
    </View>
  );

  if (!onRefresh) return body;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
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
    gap: spacing.sm,
  },
});
