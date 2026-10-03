import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DockType, DOCK_LABELS } from '../lib/libraryView';
import { radius, spacing, typeScale, useTheme } from '../lib/theme';

interface LibraryDockProps {
  tabs: DockType[];
  activeTab: DockType;
  onTab: (tab: DockType) => void;
  placeholder: string;
  query: string;
  searchOpen: boolean;
  onSearchPress: () => void;
  onClearSearch: () => void;
  filtersOpen: boolean;
  filtersLabel: string;
  onToggleFilters: () => void;
  children?: ReactNode;
}

export function LibraryDock({
  tabs,
  activeTab,
  onTab,
  placeholder,
  query,
  searchOpen,
  onSearchPress,
  onClearSearch,
  filtersOpen,
  filtersLabel,
  onToggleFilters,
  children,
}: LibraryDockProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const searchLabel = query ? `${placeholder}, ${query}` : placeholder;

  return (
    <View
      style={[
        styles.dock,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {searchOpen ? null : (
        <View style={styles.searchRow}>
          <Pressable
            onPress={onSearchPress}
            accessibilityRole="search"
            accessibilityLabel={searchLabel}
            style={[styles.search, { borderColor: colors.border, backgroundColor: colors.background }]}
          >
            <Text
              numberOfLines={1}
              style={[typeScale.body, { color: query ? colors.text : colors.placeholder }]}
            >
              {query || placeholder}
            </Text>
          </Pressable>
          {query ? (
            <Pressable
              onPress={onClearSearch}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={styles.clear}
            >
              <Text style={[typeScale.label, { color: colors.textSecondary }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {filtersOpen ? <View style={styles.filters}>{children}</View> : null}

      <Pressable
        onPress={onToggleFilters}
        accessibilityRole="button"
        accessibilityLabel={filtersLabel}
        accessibilityState={{ expanded: filtersOpen }}
        style={styles.filtersButton}
      >
        <Text style={[typeScale.label, { color: filtersOpen ? colors.accent : colors.textSecondary }]}>
          {filtersOpen ? 'Hide filters' : 'Filters'}
        </Text>
      </Pressable>

      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs.map((tab) => {
          const active = tab === activeTab;
          return (
            <Pressable
              key={tab}
              onPress={() => onTab(tab)}
              accessibilityRole="tab"
              accessibilityLabel={DOCK_LABELS[tab]}
              accessibilityState={{ selected: active }}
              style={styles.tab}
            >
              <Text
                style={[
                  typeScale.label,
                  { color: active ? colors.accent : colors.textSecondary, fontSize: 14 },
                ]}
              >
                {DOCK_LABELS[tab]}
              </Text>
              <View
                style={[
                  styles.indicator,
                  { backgroundColor: active ? colors.accent : 'transparent' },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function FilterChoices<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.choiceGroup} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={[typeScale.caption, { color: colors.textTertiary }]}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => {
          const active = option.id === value;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id)}
              accessibilityRole="radio"
              accessibilityLabel={`${label} ${option.label}`}
              accessibilityState={{ selected: active }}
              style={[
                styles.choice,
                {
                  backgroundColor: active ? colors.accentMuted : 'transparent',
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[typeScale.label, { color: active ? colors.accent : colors.textSecondary }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  search: {
    flex: 1,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  clear: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filters: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  filtersButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  indicator: {
    height: 2,
    width: 24,
    borderRadius: 1,
  },
  choiceGroup: {
    gap: spacing.xs,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choice: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
