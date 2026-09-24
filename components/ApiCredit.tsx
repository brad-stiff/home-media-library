import { StyleSheet, Text } from 'react-native';

import { ApiProvider, creditNotice } from '../lib/credits';
import { spacing, useTheme } from '../lib/theme';

export function ApiCredit({ providers }: { providers: ApiProvider[] }) {
  const { colors } = useTheme();
  const notice = providers.map((provider) => creditNotice(provider)).filter(Boolean).join(' ');
  if (!notice) return null;

  return <Text style={[styles.notice, { color: colors.textTertiary }]}>{notice}</Text>;
}

const styles = StyleSheet.create({
  notice: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
