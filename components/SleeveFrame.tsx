import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DragonSleeve } from '../lib/dragonShield';
import { radius, useTheme } from '../lib/theme';

/** Each band is the same width, so matte, dual, and unsleeved tiles stay the same size. */
const BAND = 4;

/** Colored rim around a deck. Matte fills the rim. Dual splits it into two equal bands. */
export function SleeveFrame({
  sleeve,
  children,
  fill = false,
}: {
  sleeve: DragonSleeve | null;
  children: ReactNode;
  /** Grow with a stretched parent so every tile in a row shares one height. */
  fill?: boolean;
}) {
  const { colors } = useTheme();
  const outer = sleeve?.outer ?? colors.border;
  const inner = sleeve?.inner ?? outer;
  return (
    <View style={[styles.outer, fill && styles.grow, { backgroundColor: outer, borderColor: colors.border }]}>
      <View style={[styles.band, fill && styles.grow, { backgroundColor: inner }]}>
        <View style={[styles.face, fill && styles.grow, fill && styles.centered, { backgroundColor: colors.surface }]}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    padding: BAND,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  band: {
    padding: BAND,
    borderRadius: radius.md - BAND,
  },
  face: {
    borderRadius: radius.md - BAND * 2,
    overflow: 'hidden',
  },
  grow: {
    flexGrow: 1,
  },
  centered: {
    justifyContent: 'center',
  },
});
