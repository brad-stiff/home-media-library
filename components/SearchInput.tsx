import { StyleSheet, TextInput, View } from 'react-native';

import { radius, spacing, useTheme } from '../lib/theme';
import { SearchIcon } from './icons';

interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  accessibilityLabel?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search',
  autoFocus,
  accessibilityLabel = 'Search',
  onFocus,
  onBlur,
  onSubmitEditing,
}: SearchInputProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <SearchIcon color={colors.placeholder} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={[styles.input, { color: colors.text, flex: 1 }]}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    fontSize: 16,
    paddingVertical: spacing.sm,
  },
});
