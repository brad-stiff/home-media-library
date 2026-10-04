import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { API_CREDITS } from '../../lib/credits';
import { spacing, useTheme } from '../../lib/theme';

export default function AboutScreen() {
  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.section}>
        {API_CREDITS.map((credit) => (
          <View key={credit.id} style={styles.credit}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{credit.name}</Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>{credit.notice}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  section: {
    gap: spacing.sm,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  credit: {
    gap: 2,
  },
});
