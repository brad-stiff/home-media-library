import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../../../components/PrimaryButton';
import { useHousehold } from '../../../lib/householdContext';
import {
  errorMessage,
  getLibrarySummary,
  isConfirmDeleteError,
  isTransferAdminError,
  joinHousehold,
  leaveHousehold,
  LibrarySummary,
  libraryCountLines,
} from '../../../lib/household';
import { shareLibraryBackup } from '../../../lib/shareBackup';
import { spacing, useTheme } from '../../../lib/theme';

export default function ConfirmDepartureScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { refresh } = useHousehold();
  const params = useLocalSearchParams<{ intent?: string; code?: string }>();
  const joining = params.intent === 'join';
  const code = typeof params.code === 'string' ? params.code : '';
  const [summary, setSummary] = useState<LibrarySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getLibrarySummary();
      if (!next) {
        if (joining && code) {
          await joinHousehold(code, false);
          await refresh();
          router.replace('/');
          return;
        }
        router.replace('/household/gate');
        return;
      }
      setSummary(next);
    } catch (err) {
      setError(errorMessage(err, 'Could not load this household.'));
    } finally {
      setLoading(false);
    }
  }, [code, joining, refresh, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const finish = async (acknowledge: boolean) => {
    if (joining) {
      await joinHousehold(code, acknowledge);
      await refresh();
      router.replace('/');
      return;
    }
    await leaveHousehold(acknowledge);
    await refresh();
    router.replace('/household/gate');
  };

  const handleSimpleLeave = async () => {
    setBusy(true);
    setError(null);
    try {
      await finish(false);
    } catch (err) {
      if (isConfirmDeleteError(err)) {
        await load();
        return;
      }
      setError(
        isTransferAdminError(err)
          ? 'Transfer admin to another member before leaving.'
          : errorMessage(err, 'Could not leave this household.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleShareAndLeave = async () => {
    setBusy(true);
    setError(null);
    try {
      const shared = await shareLibraryBackup();
      if (shared) {
        await finish(true);
        return;
      }
      if (Platform.OS === 'android') {
        Alert.alert(
          'Saved the backup?',
          'The household is deleted only after the backup file is saved. Dismissing the share sheet keeps it.',
          [
            { text: 'Stay', style: 'cancel' },
            {
              text: 'Backup saved',
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  setBusy(true);
                  try {
                    await finish(true);
                  } catch (err) {
                    setError(errorMessage(err, 'Could not leave this household.'));
                    setBusy(false);
                  }
                })();
              },
            },
          ],
        );
      }
    } catch (err) {
      setError(errorMessage(err, 'Could not share the backup.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !summary) {
    return (
      <View style={styles.centered}>
        {error ? (
          <Text style={{ color: colors.danger }}>{error}</Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }

  const lines = libraryCountLines(summary);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>
        {summary.wouldDelete ? 'This household would be deleted' : `Leave ${summary.householdName}`}
      </Text>
      {summary.isSoleAdmin ? (
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          You are the only admin and other people are still here. Promote someone else to admin
          before you leave. Nothing is deleted until you do.
        </Text>
      ) : summary.wouldDelete ? (
        <>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            You are the last member. Leaving abandons this library. It is not merged into
            {joining ? ' the household you are joining.' : ' another household.'} Sharing the backup
            is what allows the delete. Cancel or dismiss the share sheet and you stay here.
          </Text>
          {lines.map((line) => (
            <Text key={line} style={[styles.count, { color: colors.text }]}>
              {line}
            </Text>
          ))}
          <PrimaryButton
            label={joining ? 'Share backup and join' : 'Share backup and leave'}
            onPress={handleShareAndLeave}
            loading={busy}
            variant="danger"
          />
        </>
      ) : (
        <>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Other members stay, and their library stays with them. Your rows remain attributed to
            your account.
          </Text>
          <PrimaryButton
            label={joining ? 'Leave and join' : 'Leave household'}
            onPress={handleSimpleLeave}
            loading={busy}
            variant="danger"
          />
        </>
      )}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
  count: {
    fontSize: 16,
    fontWeight: '600',
  },
});
