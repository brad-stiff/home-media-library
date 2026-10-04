import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, typeScale, useTheme } from '../lib/theme';

export type ActionMenuItem = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export function ActionMenu({
  title,
  actions,
  onClose,
}: {
  title: string;
  actions: ActionMenuItem[] | null;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={actions != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              marginBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <Text style={[typeScale.body, styles.title, { color: colors.text }]}>{title}</Text>
          {(actions ?? []).map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={({ pressed }) => [
                styles.action,
                {
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.surfaceElevated : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  typeScale.body,
                  { color: action.destructive ? colors.danger : colors.text, fontWeight: '600' },
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: pressed ? colors.surfaceElevated : 'transparent' },
            ]}
          >
            <Text style={[typeScale.body, { color: colors.textSecondary, fontWeight: '600' }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  title: {
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  action: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
});
