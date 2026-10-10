import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DragonSleeve } from '../lib/dragonShield';
import { radius, useTheme } from '../lib/theme';

/** Colored rim around a deck, matching the sleeve back and, for duals, the interior. */
export function SleeveFrame({ sleeve, children }: { sleeve: DragonSleeve | null; children: ReactNode }) {
  const { colors } = useTheme();
  if (!sleeve) return <>{children}</>;
  return (
    <View style={[styles.outer, { backgroundColor: sleeve.outer, borderColor: colors.border }]}>
      <View
        style={[
          styles.lip,
          { backgroundColor: sleeve.inner ?? colors.surface, padding: sleeve.inner ? 2 : 0 },
        ]}
      >
        <View style={[styles.face, { backgroundColor: colors.surface }]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    padding: 4,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lip: {
    borderRadius: radius.md - 2,
  },
  face: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
