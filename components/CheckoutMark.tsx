import { StyleSheet, View } from 'react-native';

import { useTheme } from '../lib/theme';

/** Small corner mark for a checked-out poster. The borrower name stays on the detail screen. */
export function CheckoutMark() {
  const { colors } = useTheme();

  return (
    <View style={[styles.mark, { backgroundColor: colors.accent, borderColor: colors.background }]} />
  );
}

const styles = StyleSheet.create({
  mark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});
