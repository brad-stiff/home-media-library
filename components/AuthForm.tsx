import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { radius, spacing, useTheme } from '../lib/theme';

type AuthTextFieldProps = TextInputProps & {
  label: string;
};

export function AuthTextField({ label, style, ...props }: AuthTextFieldProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.placeholder}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

type AuthLinkProps = {
  label: string;
  onPress: () => void;
};

export function AuthLink({ label, onPress }: AuthLinkProps) {
  const { colors } = useTheme();

  return (
    <Pressable onPress={onPress} style={styles.link}>
      <Text style={[styles.linkText, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  link: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
