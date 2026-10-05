import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { ApiCredit } from '../../../components/ApiCredit';
import { CheckoutPanel } from '../../../components/CheckoutPanel';
import { DetailHeader, DetailScroll, DetailSection } from '../../../components/DetailLayout';
import { LoanHistory } from '../../../components/LoanHistory';
import { MoviePoster } from '../../../components/MoviePoster';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { useAuth } from '../../../lib/auth';
import { Checkout, getActiveCheckout, listItemCheckouts } from '../../../lib/checkouts';
import { listHouseholdMembers } from '../../../lib/household';
import { useHousehold } from '../../../lib/householdContext';
import { deleteMovie, getMovieById } from '../../../lib/movies';
import { attributionName, canDeleteOwned, canEditHouseholdFacts, isWriter } from '../../../lib/roles';
import { formatRuntime, radius, spacing, useTheme } from '../../../lib/theme';
import { formatOwnershipLabel, Movie } from '../../../lib/types';

export default function MovieDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { household } = useHousehold();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canLend, setCanLend] = useState(false);
  const [addedByLabel, setAddedByLabel] = useState<string | null>(null);
  const [activeCheckout, setActiveCheckout] = useState<Checkout | null>(null);
  const [loanHistory, setLoanHistory] = useState<Checkout[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        if (!id || !household) return;
        setLoading(true);
        try {
          const [result, members, checkout, history] = await Promise.all([
            getMovieById(id),
            listHouseholdMembers(),
            getActiveCheckout('movie', id),
            listItemCheckouts('movie', id),
          ]);
          if (active) {
            setMovie(result);
            const memberIds = new Set(members.map((member) => member.userId));
            setCanEdit(result != null && canEditHouseholdFacts(household.role, result.addedBy, memberIds));
            setCanDelete(result != null && canDeleteOwned(household.role, result.addedBy, user?.id ?? null));
            setCanLend(isWriter(household.role));
            setAddedByLabel(result ? attributionName(result.addedBy, members, result.addedByName) : null);
            setActiveCheckout(checkout);
            setLoanHistory(history);
          }
        } catch (error) {
          if (active) {
            const message = error instanceof Error ? error.message : 'Could not load movie.';
            Alert.alert('Error', message);
            setMovie(null);
          }
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [household, id, user?.id]),
  );

  const handleDelete = () => {
    if (!movie) return;

    Alert.alert('Remove movie?', `Remove "${movie.title}" from your library?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteMovie(movie.id);
            router.back();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not remove this movie.';
            Alert.alert('Error', message);
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!movie) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.textSecondary }}>Movie not found.</Text>
      </View>
    );
  }

  const ownershipLabel = formatOwnershipLabel(movie);
  const lendingOn = household?.lendingEnabled !== false;
  const subtitle = [movie.year, formatRuntime(movie.runtime)].filter(Boolean).join(' · ');

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <DetailScroll>
        <DetailHeader
          art={<MoviePoster posterPath={movie.posterPath} title={movie.title} size="sm" />}
          title={movie.title}
          subtitle={subtitle || null}
        />

        <View style={styles.ownershipRow}>
          {movie.hasBluray ? <FormatBadge label="Blu-ray" /> : null}
          {movie.has4k ? <FormatBadge label="4K" /> : null}
          {movie.hasDigital ? <FormatBadge label="Digital" /> : null}
          {movie.platform?.trim() ? <FormatBadge label={movie.platform.trim()} muted /> : null}
        </View>

        {movie.genres.length > 0 ? (
          <View style={styles.genreRow}>
            {movie.genres.map((genre) => (
              <View
                key={genre}
                style={[styles.genreChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.genreText, { color: colors.textSecondary }]}>{genre}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {movie.overview ? (
          <DetailSection title="Overview">
            <Text style={[styles.body, { color: colors.textSecondary }]}>{movie.overview}</Text>
          </DetailSection>
        ) : null}

        {lendingOn || activeCheckout ? (
          <DetailSection title="Lending">
            <CheckoutPanel
              itemType="movie"
              itemId={movie.id}
              activeCheckout={activeCheckout}
              onChanged={(next) => {
                setActiveCheckout(next);
                void listItemCheckouts('movie', movie.id).then(setLoanHistory);
              }}
              canWrite={canLend}
              allowCheckout={movie.hasBluray || movie.has4k}
              lendingEnabled={lendingOn}
            />
            {lendingOn ? <LoanHistory loans={loanHistory} /> : null}
          </DetailSection>
        ) : null}

        <DetailSection title="In your library">
          <Text style={[styles.body, { color: colors.textSecondary }]}>{ownershipLabel}</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Added {new Date(movie.addedAt).toLocaleDateString()}
            {addedByLabel ? ` · ${addedByLabel}` : ''}
          </Text>
        </DetailSection>

        {canEdit ? (
          <PrimaryButton label="Edit formats" onPress={() => router.push(`/edit-movie?id=${movie.id}`)} />
        ) : null}

        {canDelete ? (
          <PrimaryButton label="Remove from library" onPress={handleDelete} loading={deleting} variant="danger" />
        ) : null}
        <ApiCredit providers={['tmdb']} />
      </DetailScroll>
    </>
  );
}

function FormatBadge({ label, muted = false }: { label: string; muted?: boolean }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.formatBadge,
        muted
          ? { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }
          : { backgroundColor: colors.accentMuted },
      ]}
    >
      <Text style={[styles.formatText, { color: muted ? colors.textSecondary : colors.accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  ownershipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  formatBadge: {
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  formatText: {
    fontSize: 13,
    fontWeight: '700',
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  genreChip: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  genreText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
