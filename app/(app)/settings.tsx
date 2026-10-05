import { Children, ReactNode, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import {
  errorMessage,
  setHouseholdLending,
  setHouseholdMedia,
} from '../../lib/household';
import { useHousehold } from '../../lib/householdContext';
import {
  DOCK_LABELS,
  moveDockTab,
  visibleDockTabs,
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
    <ScrollView contentContainerStyle={styles.content}>
      <SettingsSection title="Appearance" help="Saved on your account, and system follows this phone.">
        {APPEARANCE_OPTIONS.map((option) => (
          <ChoiceRow
            key={option.id}
            label={option.label}
            selected={profile.appearance === option.id}
            onPress={() => void handleAppearance(option.id)}
          />
        ))}
      </SettingsSection>

      <SettingsSection
        title="Your tabs"
        help="Hide a type from your library. Other people still see it, and active loans stay on the Loans list."
      >
        {household ? (
          MEDIA.map((type) => {
            const available = householdShows(household, type.id);
            const shown =
              available &&
              (type.id === 'movies' ? !profile.hideMovies : type.id === 'books' ? !profile.hideBooks : !profile.hideMtg);
            return (
              <View key={type.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{type.label}</Text>
                  {available ? null : (
                    <Text style={[styles.rowHint, { color: colors.textTertiary }]}>Off for the household</Text>
                  )}
                </View>
                <Switch
                  value={shown}
                  disabled={!available}
                  onValueChange={(value) => void handlePersonalToggle(type.id, value)}
                  trackColor={{ true: colors.accent, false: colors.border }}
                  accessibilityLabel={type.label}
                />
              </View>
            );
          })
        ) : (
          <Text style={[styles.rowHint, { color: colors.textSecondary, padding: spacing.md }]}>
            Create or join a household to choose which tabs you see.
          </Text>
        )}
      </SettingsSection>

      {household ? (
        <SettingsSection
          title="Library"
          help="Choose which tab opens first, and the order of the tabs along the bottom."
        >
          {(['resume', ...visibleDock] as const).map((option) => {
            const label = option === 'resume' ? 'Resume' : DOCK_LABELS[option];
            return (
              <ChoiceRow
                key={option}
                label={option === 'resume' ? 'Opening tab · Resume' : `Opening tab · ${label}`}
                selected={profile.libraryView.opening === option}
                onPress={() => void saveView({ ...profile.libraryView, opening: option })}
              />
            );
          })}
          {profile.libraryView.opening !== 'resume' && !visibleDock.includes(profile.libraryView.opening) ? (
            <Text style={[styles.rowHint, { color: colors.textTertiary, paddingHorizontal: spacing.md, paddingBottom: spacing.sm }]}>
              That tab is hidden, so the library opens on the first tab.
            </Text>
          ) : null}
          {visibleDock.length > 1
            ? visibleDock.map((type, index) => (
                <View key={type} style={styles.row}>
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
              ))
            : null}
        </SettingsSection>
      ) : null}

      {isAdmin && household ? (
        <SettingsSection
          title="Household library"
          help="Turning a type off hides its tab and add buttons for everyone. The catalog stays."
        >
          {MEDIA.map((type) => (
            <View key={type.id} style={styles.row}>
              <Text style={[styles.rowTitle, { color: colors.text, flex: 1 }]}>{type.label}</Text>
              <Switch
                value={householdShows(household, type.id)}
                onValueChange={(value) => void handleHouseholdToggle(type.id, value)}
                trackColor={{ true: colors.accent, false: colors.border }}
                accessibilityLabel={`${type.label} for the household`}
              />
            </View>
          ))}
        </SettingsSection>
      ) : null}

      {isAdmin && household ? (
        <SettingsSection
          title="Checkout"
          help="Turning this off hides lending for everyone. A title that is still out can be returned or cancelled."
        >
          <View style={styles.row}>
            <Text style={[styles.rowTitle, { color: colors.text, flex: 1 }]}>Checkout</Text>
            <Switch
              value={household.lendingEnabled}
              onValueChange={(value) => void handleLending(value)}
              trackColor={{ true: colors.accent, false: colors.border }}
              accessibilityLabel="Household checkout"
            />
          </View>
        </SettingsSection>
      ) : null}

      <SettingsSection
        title="Export"
        help={
          household
            ? 'Share a JSON backup of the catalog. Sharing the file leaves the household in place.'
            : 'Join a household to export its library.'
        }
      >
        <Pressable
          onPress={() => void handleExport()}
          disabled={!household || exporting}
          accessibilityRole="button"
          accessibilityLabel="Export library"
          style={styles.row}
        >
          <Text style={[styles.rowTitle, { color: household ? colors.accent : colors.textTertiary }]}>
            {exporting ? 'Exporting…' : 'Export library'}
          </Text>
        </Pressable>
      </SettingsSection>
    </ScrollView>
  );
}

function SettingsSection({ title, help, children }: { title: string; help: string; children: ReactNode }) {
  const { colors } = useTheme();

  const rows = Children.toArray(children);

  return (
    <View style={styles.section}>
      <Text style={[styles.header, { color: colors.textSecondary }]}>{title}</Text>
      <Text style={[styles.help, { color: colors.textTertiary }]}>{help}</Text>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {rows.map((row, index) => (
          <View
            key={index}
            style={index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null}
          >
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

function ChoiceRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={styles.row}
    >
      <Text style={[styles.rowTitle, { color: selected ? colors.accent : colors.text, flex: 1 }]}>{label}</Text>
      {selected ? <Text style={{ color: colors.accent, fontWeight: '700' }}>Selected</Text> : null}
    </Pressable>
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
  header: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  help: {
    fontSize: 14,
    lineHeight: 20,
  },
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  rowHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  nudge: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
