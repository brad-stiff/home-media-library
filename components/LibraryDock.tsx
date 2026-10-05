import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DockType, DOCK_LABELS } from '../lib/libraryView';
import { radius, spacing, typeScale, useTheme } from '../lib/theme';

interface LibraryDockProps {
  tabs: DockType[];
  activeTab: DockType | 'loans';
  onTab: (tab: DockType) => void;
  showLoans: boolean;
  onLoans: () => void;
}

export function LibraryDock({ tabs, activeTab, onTab, showLoans, onLoans }: LibraryDockProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

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
              <Text style={[typeScale.label, { color: active ? colors.accent : colors.textSecondary, fontSize: 14 }]}>
                {DOCK_LABELS[tab]}
              </Text>
              <View style={[styles.indicator, { backgroundColor: active ? colors.accent : 'transparent' }]} />
            </Pressable>
          );
        })}
        {showLoans ? (
          <Pressable
            onPress={onLoans}
            accessibilityRole="tab"
            accessibilityLabel="Loans"
            accessibilityState={{ selected: activeTab === 'loans' }}
            style={styles.tab}
          >
            <Text
              style={[
                typeScale.label,
                { color: activeTab === 'loans' ? colors.accent : colors.textSecondary, fontSize: 14 },
              ]}
            >
              Loans
            </Text>
            <View
              style={[styles.indicator, { backgroundColor: activeTab === 'loans' ? colors.accent : 'transparent' }]}
            />
          </Pressable>
        ) : null}
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
    paddingTop: spacing.xs,
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
