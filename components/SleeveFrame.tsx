import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DragonSleeve } from '../lib/dragonShield';
import { radius, useTheme } from '../lib/theme';

/** Each band is the same width, so matte, dual, and unsleeved tiles stay the same size. */
const BAND = 4;

/** Colored rim around a deck. Matte fills the rim. Dual splits it into two equal bands. */
export function SleeveFrame({ sleeve, children }: { sleeve: DragonSleeve | null; children: ReactNode }) {
  const { colors } = useTheme();
  const outer = sleeve?.outer ?? colors.border;
  const inner = sleeve?.inner ?? outer;
  return (
    <View style={[styles.outer, { backgroundColor: outer, borderColor: colors.border }]}>
      <View style={[styles.band, { backgroundColor: inner }]}>
        <View style={[styles.face, { backgroundColor: colors.surface }]}>{children}</View>
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
});
