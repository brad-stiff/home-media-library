import { StyleSheet, TextInput, View } from 'react-native';

import { radius, spacing, useTheme } from '../lib/theme';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search',
  autoFocus,
  accessibilityLabel = 'Search',
  onFocus,
  onBlur,
}: SearchInputProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        onFocus={onFocus}
        onBlur={onBlur}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={[styles.input, { color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    paddingVertical: spacing.sm,
  },
});
