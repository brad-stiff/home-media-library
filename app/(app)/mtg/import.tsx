import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ApiCredit } from '../../../components/ApiCredit';
import { FilterChoices } from '../../../components/LibraryDock';
import { MediaGate } from '../../../components/MediaGate';
import { AuthTextField } from '../../../components/AuthForm';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { WriterOnly } from '../../../components/WriterOnly';
import { fetchArchidektDeck } from '../../../lib/archidekt';
import { DeckFormat } from '../../../lib/deckLegality';
import { createMtgDeck, importArchidektDeck } from '../../../lib/mtgDecks';
import { spacing, useTheme } from '../../../lib/theme';

const FORMATS: { id: DeckFormat; label: string }[] = [
  { id: 'commander', label: 'Commander' },
  { id: 'standard', label: 'Standard' },
];

function askDeckFormat(): Promise<DeckFormat | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Choose a format',
      'Archidekt lists this deck outside Commander and Standard. Pick which format to save. The list still imports either way.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Commander', onPress: () => resolve('commander') },
        { text: 'Standard', onPress: () => resolve('standard') },
      ],
    );
  });
}

function ImportMtgDeckScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [archidekt, setArchidekt] = useState('');
  const [blankName, setBlankName] = useState('');
  const [format, setFormat] = useState<DeckFormat>('commander');
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleImport = async () => {
    setImporting(true);
    try {
      const deckData = await fetchArchidektDeck(archidekt);
      const chosen = deckData.format ?? (await askDeckFormat());
      if (!chosen) return;
      const deck = await importArchidektDeck(deckData, chosen);
      router.replace(`/mtg/deck/${deck.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed.';
      Alert.alert('Archidekt import', message);
    } finally {
      setImporting(false);
    }
  };

  const handleCreateBlank = async () => {
    if (!blankName.trim()) {
      Alert.alert('Name required', 'Enter a deck name.');
      return;
    }
    setCreating(true);
    try {
      const deck = await createMtgDeck(blankName, format);
      router.replace(`/mtg/deck/${deck.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create deck.';
      Alert.alert('Error', message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={[styles.title, { color: colors.text }]}>Import from Archidekt</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Paste a deck URL (archidekt.com/decks/…) or the numeric deck ID. Cards resolve via
            Scryfall. Commander and Standard decks keep that format. Any other Archidekt format
            asks you to pick one. Legality warnings show on the deck and do not block the import.
          </Text>
          <AuthTextField
            label="Archidekt URL or ID"
            value={archidekt}
            onChangeText={setArchidekt}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://archidekt.com/decks/12345678/…"
          />
          <PrimaryButton
            label="Import deck"
            onPress={handleImport}
            loading={importing}
            disabled={!archidekt.trim()}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.title, { color: colors.text }]}>Or create an empty deck</Text>
          <AuthTextField
            label="Deck name"
            value={blankName}
            onChangeText={setBlankName}
            placeholder="My Commander deck"
          />
          <FilterChoices label="Format" options={FORMATS} value={format} onChange={setFormat} />
          <PrimaryButton label="Create deck" onPress={handleCreateBlank} loading={creating} />
        </View>
        <ApiCredit providers={['archidekt', 'scryfall']} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
});

export default function ImportMtgDeckRoute() {
  return (
    <WriterOnly>
      <MediaGate type="mtg">
        <ImportMtgDeckScreen />
      </MediaGate>
    </WriterOnly>
  );
}
