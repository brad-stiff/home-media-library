import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OwnershipPicker } from '../../components/OwnershipPicker';
import { PrimaryButton } from '../../components/PrimaryButton';
import { listHouseholdMembers } from '../../lib/household';
import { useHousehold } from '../../lib/householdContext';
import { getMovieById, refreshMovieFromTmdb, updateMovieOwnership } from '../../lib/movies';
import { canEditHouseholdFacts } from '../../lib/roles';
import { spacing, useTheme } from '../../lib/theme';
import { Movie, MovieOwnership } from '../../lib/types';

export default function EditMovieScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { household } = useHousehold();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [ownership, setOwnership] = useState<MovieOwnership | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!id || !household) return;
      setLoading(true);
      try {
        const [result, members] = await Promise.all([getMovieById(id), listHouseholdMembers()]);
        if (!active) return;
        setMovie(result);
        if (result) {
          setOwnership({
            hasBluray: result.hasBluray,
            has4k: result.has4k,
            hasDigital: result.hasDigital,
            platform: result.platform,
          });
        }
        const memberIds = new Set(members.map((member) => member.userId));
        setAllowed(
          result != null && canEditHouseholdFacts(household.role, result.addedBy, memberIds),
        );
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : 'Could not load movie.';
          Alert.alert('Error', message);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [household, id]);

  const handleSave = async () => {
    if (!movie || !ownership) return;
    setSaving(true);
    try {
      await updateMovieOwnership(movie.id, ownership);
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save changes.';
      Alert.alert('Error', message);
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    if (!movie) return;
    setRefreshing(true);
    try {
      const next = await refreshMovieFromTmdb(movie);
      setMovie(next);
      Alert.alert('Updated', 'Movie details were refreshed from TMDb.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not refresh from TMDb.';
      Alert.alert('Error', message);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading || !household) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!movie || !ownership) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>Movie not found.</Text>
      </View>
    );
  }

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          Only an admin can edit this movie while the person who added it is gone.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{movie.title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        Formats and platform are household facts. Title and overview come from TMDb.
      </Text>
      <OwnershipPicker value={ownership} onChange={setOwnership} />
      <PrimaryButton label="Save" onPress={handleSave} loading={saving} disabled={refreshing} />
      <PrimaryButton
        label="Refresh from TMDb"
        onPress={handleRefresh}
        loading={refreshing}
        disabled={saving}
      />
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
    gap: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
});
