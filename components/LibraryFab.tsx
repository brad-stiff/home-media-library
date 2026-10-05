import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, typeScale, useTheme } from '../lib/theme';
import { PlusIcon } from './icons';

export type FabAction = {
  id: string;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
};

export function LibraryFab({ actions, bottom }: { actions: FabAction[]; bottom: number }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const actionKey = actions.map((action) => action.id).join('|');

  useEffect(() => {
    setOpen(false);
  }, [actionKey]);

  if (actions.length === 0) return null;

  const run = (action: FabAction) => {
    setOpen(false);
    action.onPress();
  };

  if (actions.length === 1) {
    const action = actions[0];
    return (
      <Pressable
        onPress={() => run(action)}
        accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel}
        style={({ pressed }) => [
          styles.fab,
          styles.wide,
          { backgroundColor: colors.accent, bottom, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[typeScale.label, { color: colors.accentText, fontSize: 14 }]}>{action.label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.stack, { bottom, pointerEvents: 'box-none' }]}>
      {open
        ? actions.map((action) => (
            <Pressable
              key={action.id}
              onPress={() => run(action)}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
              style={({ pressed }) => [
                styles.fab,
                styles.wide,
                { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[typeScale.label, { color: colors.accentText, fontSize: 14 }]}>{action.label}</Text>
            </Pressable>
          ))
        : null}
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close add menu' : 'Add to library'}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        {open ? (
          <Text style={[styles.plus, { color: colors.accentText }]}>×</Text>
        ) : (
          <PlusIcon color={colors.accentText} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    right: spacing.md,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  fab: {
    minWidth: 56,
    minHeight: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wide: {
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
  },
  plus: {
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '500',
  },
});
