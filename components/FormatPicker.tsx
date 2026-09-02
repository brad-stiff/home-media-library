import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, useTheme } from '../lib/theme';
import { MOVIE_FORMATS, MovieFormat } from '../lib/types';

interface FormatPickerProps {
  value: MovieFormat;
  onChange: (format: MovieFormat) => void;
}

export function FormatPicker({ value, onChange }: FormatPickerProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Format</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {MOVIE_FORMATS.map((format) => {
          const selected = value === format;
          return (
            <Pressable
              key={format}
              onPress={() => onChange(format)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? colors.accentText : colors.text }]}>
                {format}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  chip: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
