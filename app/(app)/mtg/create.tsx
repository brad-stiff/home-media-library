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

import { AuthTextField } from '../../../components/AuthForm';
import { FilterChoices } from '../../../components/LibraryDock';
import { MediaGate } from '../../../components/MediaGate';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { WriterOnly } from '../../../components/WriterOnly';
import { DeckFormat } from '../../../lib/deckLegality';
import { createMtgDeck } from '../../../lib/mtgDecks';
import { spacing, useTheme } from '../../../lib/theme';

const FORMATS: { id: DeckFormat; label: string }[] = [
  { id: 'commander', label: 'Commander' },
  { id: 'standard', label: 'Standard' },
];

function CreateMtgDeckScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [format, setFormat] = useState<DeckFormat>('commander');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter a deck name.');
      return;
    }
    setCreating(true);
    try {
      const deck = await createMtgDeck(name, format);
      router.replace(`/mtg/deck/${deck.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create deck.';
      Alert.alert('Error', message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={[styles.title, { color: colors.text }]}>Create an empty deck</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Name a Commander or Standard deck. You can add cards after it is saved.
          </Text>
          <AuthTextField
            label="Deck name"
            value={name}
            onChangeText={setName}
            placeholder="My Commander deck"
          />
          <FilterChoices label="Format" options={FORMATS} value={format} onChange={setFormat} />
          <PrimaryButton label="Create deck" onPress={handleCreate} loading={creating} />
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

export default function CreateMtgDeckRoute() {
  return (
    <WriterOnly>
      <MediaGate type="mtg">
        <CreateMtgDeckScreen />
      </MediaGate>
    </WriterOnly>
  );
}
