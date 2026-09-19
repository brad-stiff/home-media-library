import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { radius, spacing, useTheme } from '../lib/theme';
import { MovieOwnership } from '../lib/types';

type OwnershipPickerProps = {
  value: MovieOwnership;
  onChange: (next: MovieOwnership) => void;
};

const TOGGLES: { key: keyof Pick<MovieOwnership, 'hasBluray' | 'has4k' | 'hasDigital'>; label: string }[] =
  [
    { key: 'hasBluray', label: 'Blu-ray' },
    { key: 'has4k', label: '4K' },
    { key: 'hasDigital', label: 'Digital' },
  ];

export function OwnershipPicker({ value, onChange }: OwnershipPickerProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>How you own it</Text>
      <View style={styles.row}>
        {TOGGLES.map(({ key, label }) => {
          const selected = value[key];
          return (
            <Pressable
              key={key}
              onPress={() => onChange({ ...value, [key]: !selected })}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? colors.accentText : colors.text }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Platform (optional)</Text>
      <TextInput
        value={value.platform ?? ''}
        onChangeText={(platform) => onChange({ ...value, platform })}
        placeholder="Amazon, Apple TV, Disney+…"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="words"
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      />
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
});
