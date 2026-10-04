import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { PrimaryButton } from '../../components/PrimaryButton';
import {
  errorMessage,
  setHouseholdLending,
  setHouseholdMedia,
} from '../../lib/household';
import { useHousehold } from '../../lib/householdContext';
import {
  DOCK_LABELS,
  LibraryLayout,
  moveDockTab,
  visibleDockTabs,
  withTabPrefs,
} from '../../lib/libraryView';
import {
  householdShows,
  isTypeVisible,
  MediaType,
  useProfile,
} from '../../lib/profile';
import { shareLibraryBackup } from '../../lib/shareBackup';
import { AppearancePreference } from '../../lib/appearanceContext';
import { radius, spacing, useTheme } from '../../lib/theme';
import { useToast } from '../../lib/toast';

const APPEARANCE_OPTIONS: { id: AppearancePreference; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const MEDIA: { id: MediaType; label: string }[] = [
  { id: 'movies', label: 'Movies' },
  { id: 'books', label: 'Books' },
  { id: 'mtg', label: 'MTG' },
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { household, refresh: refreshHousehold } = useHousehold();
  const { profile, saveAppearance, savePersonalHide, saveLibraryView } = useProfile();
  const [exporting, setExporting] = useState(false);

  const isAdmin = household?.role === 'admin';

  const handleAppearance = async (appearance: AppearancePreference) => {
    if (appearance === profile.appearance) return;
    try {
      await saveAppearance(appearance);
    } catch (error) {
      Alert.alert('Could not save appearance', errorMessage(error, 'Try again.'));
    }
  };

  const personalHide = {
    hideMovies: profile.hideMovies,
    hideBooks: profile.hideBooks,
    hideMtg: profile.hideMtg,
  };

  const handlePersonalToggle = async (type: MediaType, shown: boolean) => {
    const next = { ...personalHide };
    if (type === 'movies') next.hideMovies = !shown;
    if (type === 'books') next.hideBooks = !shown;
    if (type === 'mtg') next.hideMtg = !shown;
    try {
      await savePersonalHide(next);
    } catch (error) {
      Alert.alert('Could not update your tabs', errorMessage(error, 'Try again.'));
    }
  };

  const visibleDock = household
    ? visibleDockTabs(profile.libraryView.dockOrder, (type) => {
        if (type === 'games' || type === 'pokemon') return false;
        return isTypeVisible(household, profile, type);
      })
    : [];

  const saveView = async (next: typeof profile.libraryView) => {
    try {
      await saveLibraryView(next);
    } catch (error) {
      Alert.alert('Could not save library view', errorMessage(error, 'Try again.'));
    }
  };

  const handleHouseholdToggle = async (type: MediaType, shown: boolean) => {
    if (!household || !isAdmin) return;
    const shows = {
      movies: household.showMovies,
      books: household.showBooks,
      mtg: household.showMtg,
    };
    shows[type] = shown;
    try {
      await setHouseholdMedia(shows);
      await refreshHousehold();
    } catch (error) {
      Alert.alert('Could not update the household', errorMessage(error, 'Try again.'));
    }
  };

  const handleLending = async (enabled: boolean) => {
    try {
      await setHouseholdLending(enabled);
      await refreshHousehold();
    } catch (error) {
      Alert.alert('Could not update checkout', errorMessage(error, 'Try again.'));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const shared = await shareLibraryBackup();
      if (Platform.OS === 'ios') {
        if (shared) showToast('Library backup shared');
      } else {
        showToast('Library backup ready');
      }
    } catch (error) {
      Alert.alert('Could not export', errorMessage(error, 'Try again.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Appearance</Text>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Saved on your account. System follows this phone.
          </Text>
          <View style={styles.choices}>
            {APPEARANCE_OPTIONS.map((option) => {
              const active = profile.appearance === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => void handleAppearance(option.id)}
                  style={[
                    styles.choice,
                    {
                      backgroundColor: active ? colors.accentMuted : colors.surface,
                      borderColor: active ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? colors.accent : colors.text, fontWeight: '700' }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Your tabs</Text>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Hide a type from your library. Other people still see it, and active loans stay on the
            Loans list.
          </Text>
          {household ? (
            MEDIA.map((type) => {
              const available = householdShows(household, type.id);
              const shown = available && (
                type.id === 'movies'
                  ? !profile.hideMovies
                  : type.id === 'books'
                    ? !profile.hideBooks
                    : !profile.hideMtg
              );
              return (
                <View
                  key={type.id}
                  style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{type.label}</Text>
                    <Text style={[styles.hint, { color: colors.textTertiary }]}>
                      {available ? 'Shown in your library' : 'Off for the household'}
                    </Text>
                  </View>
                  <Switch
                    value={shown}
                    disabled={!available}
                    onValueChange={(value) => void handlePersonalToggle(type.id, value)}
                    trackColor={{ true: colors.accent, false: colors.border }}
                  />
                </View>
              );
            })
          ) : (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Create or join a household to choose which tabs you see.
            </Text>
          )}
        </View>

        {household ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Library view</Text>
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              Opening tab, dock order, layout, and density stay on your account. Sort and filters
              are remembered from the library.
            </Text>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Opening tab</Text>
            <View style={styles.choices}>
              {(['resume', ...visibleDock] as const).map((option) => {
                const active = profile.libraryView.opening === option;
                const label = option === 'resume' ? 'Resume' : DOCK_LABELS[option];
                return (
                  <Pressable
                    key={option}
                    onPress={() => void saveView({ ...profile.libraryView, opening: option })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.choice,
                      {
                        backgroundColor: active ? colors.accentMuted : colors.surface,
                        borderColor: active ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? colors.accent : colors.text, fontWeight: '700' }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {profile.libraryView.opening !== 'resume' &&
            !visibleDock.includes(profile.libraryView.opening) ? (
              <Text style={[styles.hint, { color: colors.textTertiary }]}>
                That tab is hidden, so the library opens on the first tab in your dock.
              </Text>
            ) : null}

            <Text style={[styles.rowTitle, { color: colors.text }]}>Density</Text>
            <View style={styles.choices}>
              {(
                [
                  ['comfortable', 'Comfortable'],
                  ['compact', 'Compact'],
                ] as const
              ).map(([id, label]) => {
                const active = profile.libraryView.density === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => void saveView({ ...profile.libraryView, density: id })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.choice,
                      {
                        backgroundColor: active ? colors.accentMuted : colors.surface,
                        borderColor: active ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? colors.accent : colors.text, fontWeight: '700' }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {visibleDock.length > 1 ? (
              <>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Dock order</Text>
                {visibleDock.map((type, index) => (
                  <View
                    key={type}
                    style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Text style={[styles.rowTitle, { color: colors.text, flex: 1 }]}>{DOCK_LABELS[type]}</Text>
                    <Pressable
                      disabled={index === 0}
                      onPress={() =>
                        void saveView({
                          ...profile.libraryView,
                          dockOrder: moveDockTab(profile.libraryView.dockOrder, visibleDock, type, -1),
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${DOCK_LABELS[type]} up`}
                      style={styles.nudge}
                    >
                      <Text style={{ color: index === 0 ? colors.textTertiary : colors.accent, fontWeight: '700' }}>
                        Up
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={index === visibleDock.length - 1}
                      onPress={() =>
                        void saveView({
                          ...profile.libraryView,
                          dockOrder: moveDockTab(profile.libraryView.dockOrder, visibleDock, type, 1),
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${DOCK_LABELS[type]} down`}
                      style={styles.nudge}
                    >
                      <Text
                        style={{
                          color: index === visibleDock.length - 1 ? colors.textTertiary : colors.accent,
                          fontWeight: '700',
                        }}
                      >
                        Down
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}

            {visibleDock.map((type) => (
              <View key={`layout-${type}`} style={styles.section}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  {type === 'mtg' ? 'MTG collection layout' : `${DOCK_LABELS[type]} layout`}
                </Text>
                <View style={styles.choices}>
                  {(
                    [
                      ['grid', 'Grid'],
                      ['list', 'List'],
                    ] as const
                  ).map(([id, label]) => {
                    const active = profile.libraryView[type].layout === id;
                    return (
                      <Pressable
                        key={id}
                        onPress={() =>
                          void saveView(withTabPrefs(profile.libraryView, type, { layout: id as LibraryLayout }))
                        }
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.choice,
                          {
                            backgroundColor: active ? colors.accentMuted : colors.surface,
                            borderColor: active ? colors.accent : colors.border,
                          },
                        ]}
                      >
                        <Text style={{ color: active ? colors.accent : colors.text, fontWeight: '700' }}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              Decks stay a list. Grid and list both use the density above.
            </Text>
          </View>
        ) : null}

        {isAdmin && household ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Household library</Text>
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              Turning a type off hides its tab and add buttons for everyone. The catalog stays.
            </Text>
            {MEDIA.map((type) => {
              const shown = householdShows(household, type.id);
              return (
                <View
                  key={type.id}
                  style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{type.label}</Text>
                    <Text style={[styles.hint, { color: colors.textTertiary }]}>
                      {shown ? 'Available to the household' : 'Hidden for everyone'}
                    </Text>
                  </View>
                  <Switch
                    value={shown}
                    onValueChange={(value) => void handleHouseholdToggle(type.id, value)}
                    trackColor={{ true: colors.accent, false: colors.border }}
                  />
                </View>
              );
            })}
          </View>
        ) : null}

        {isAdmin && household ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Checkout</Text>
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              Turning this off hides lending, the loans list, checkout badges, availability filters,
              and loan history. The catalog and existing loans stay. A title that is still out can
              be returned or cancelled.
            </Text>
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Checkout</Text>
                <Text style={[styles.hint, { color: colors.textTertiary }]}>
                  {household.lendingEnabled ? 'On for the household' : 'Hidden for everyone'}
                </Text>
              </View>
              <Switch
                value={household.lendingEnabled}
                onValueChange={(value) => void handleLending(value)}
                trackColor={{ true: colors.accent, false: colors.border }}
                accessibilityLabel="Household checkout"
              />
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Export library</Text>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Share a JSON backup of movies, books, MTG cards, decks, checkouts, and contacts. Sharing
            the file leaves the household in place.
          </Text>
          <PrimaryButton
            label="Export library"
            onPress={handleExport}
            loading={exporting}
            disabled={!household}
          />
          {!household ? (
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              Join a household to export its library.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  section: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choice: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  nudge: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
});
