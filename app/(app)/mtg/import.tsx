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
import { MediaGate } from '../../../components/MediaGate';
import { AuthTextField } from '../../../components/AuthForm';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { WriterOnly } from '../../../components/WriterOnly';
import { fetchArchidektDeck } from '../../../lib/archidekt';
import { createMtgDeck, importArchidektDeck } from '../../../lib/mtgDecks';
import { spacing, useTheme } from '../../../lib/theme';

function ImportMtgDeckScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [archidekt, setArchidekt] = useState('');
  const [blankName, setBlankName] = useState('');
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleImport = async () => {
    setImporting(true);
    try {
      const deckData = await fetchArchidektDeck(archidekt);
      const deck = await importArchidektDeck(deckData);
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
      const deck = await createMtgDeck(blankName);
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
            Scryfall.
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
          <Text style={[styles.title, { color: colors.text }]}>Or create empty deck</Text>
          <AuthTextField
            label="Deck name"
            value={blankName}
            onChangeText={setBlankName}
            placeholder="My Commander deck"
          />
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
