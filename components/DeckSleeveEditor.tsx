import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickDeckSleevePhoto, removeDeckSleevePhoto, uploadDeckSleevePhoto } from '../lib/deckSleeveImage';
import { DragonSleeve, sleeveById, sleeveLabel, sleevesIn } from '../lib/dragonShield';
import { MtgDeck, updateMtgDeck } from '../lib/mtgDecks';
import { radius, spacing, typeScale, useTheme } from '../lib/theme';
import { SleeveFrame } from './SleeveFrame';

const SWATCH = 44;

export function DeckSleeveEditor({
  deck,
  canEdit,
  onChange,
}: {
  deck: MtgDeck;
  canEdit: boolean;
  onChange: (deck: MtgDeck) => void;
}) {
  const { colors } = useTheme();
  const sleeve = sleeveById(deck.sleeveId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'photo' | 'remove' | null>(null);

  if (!canEdit && !sleeve && !deck.sleeveImageUrl) return null;

  const saveColor = async (sleeveId: string | null) => {
    try {
      await updateMtgDeck(deck.id, { sleeveId });
      onChange({ ...deck, sleeveId });
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the sleeve.';
      Alert.alert('Error', message);
    }
  };

  const addPhoto = async () => {
    setBusy('photo');
    try {
      const photo = await pickDeckSleevePhoto();
      if (!photo) return;
      const sleeveImageUrl = await uploadDeckSleevePhoto(deck, photo);
      onChange({ ...deck, sleeveImageUrl });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not attach the sleeve photo.';
      Alert.alert('Error', message);
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async () => {
    setBusy('remove');
    try {
      await removeDeckSleevePhoto(deck);
      onChange({ ...deck, sleeveImageUrl: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not remove the sleeve photo.';
      Alert.alert('Error', message);
    } finally {
      setBusy(null);
    }
  };

  const body = (
    <View style={styles.block}>
      <View style={styles.summary}>
        <View
          style={[
            styles.preview,
            !sleeve && {
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <SleeveFrame sleeve={sleeve}>
            <View style={[styles.previewFace, { backgroundColor: colors.surface }]} />
          </SleeveFrame>
        </View>
        <View style={styles.summaryText}>
          <Text style={[typeScale.label, { color: colors.textSecondary }]}>Sleeve</Text>
          <Text style={[typeScale.body, { color: colors.text }]}>
            {sleeve ? sleeveLabel(sleeve) : 'No sleeve'}
          </Text>
        </View>
      </View>
      {deck.sleeveImageUrl ? (
        <Image
          source={{ uri: deck.sleeveImageUrl }}
          style={[styles.photo, { backgroundColor: colors.surfaceElevated }]}
          contentFit="cover"
          accessibilityLabel="Sleeve photo"
        />
      ) : null}
      {canEdit ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={sleeve ? `Change sleeve, ${sleeveLabel(sleeve)}` : 'Choose a sleeve color'}
            style={styles.action}
          >
            <Text style={[typeScale.label, { color: colors.accent }]}>
              {sleeve ? 'Change color' : 'Choose color'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void addPhoto()}
            disabled={busy != null}
            accessibilityRole="button"
            accessibilityLabel={deck.sleeveImageUrl ? 'Replace sleeve photo' : 'Add sleeve photo'}
            style={styles.action}
          >
            <Text style={[typeScale.label, { color: colors.accent }]}>
              {busy === 'photo' ? 'Saving photo…' : deck.sleeveImageUrl ? 'Replace photo' : 'Add photo'}
            </Text>
          </Pressable>
          {deck.sleeveImageUrl ? (
            <Pressable
              onPress={() => void removePhoto()}
              disabled={busy != null}
              accessibilityRole="button"
              accessibilityLabel="Remove sleeve photo"
              style={styles.action}
            >
              <Text style={[typeScale.label, { color: colors.danger }]}>
                {busy === 'remove' ? 'Removing photo…' : 'Remove photo'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      {body}
      {canEdit ? (
        <SleeveColorModal
          visible={open}
          selectedId={deck.sleeveId}
          onSelect={(id) => void saveColor(id)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function SleeveColorModal({
  visible,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const trimmed = query.trim().toLowerCase();
  const matte = useMemo(
    () => sleevesIn('matte').filter((sleeve) => !trimmed || sleeve.name.toLowerCase().includes(trimmed)),
    [trimmed],
  );
  const dual = useMemo(
    () => sleevesIn('dual').filter((sleeve) => !trimmed || sleeve.name.toLowerCase().includes(trimmed)),
    [trimmed],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.modalHeader}>
          <Text style={[typeScale.title, { color: colors.text }]}>Dragon Shield</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Done" style={styles.done}>
            <Text style={[typeScale.label, { color: colors.accent }]}>Done</Text>
          </Pressable>
        </View>
        <Text style={[typeScale.caption, styles.note, { color: colors.textSecondary }]}>
          Matte and Dual Matte. Swatches approximate the sleeve color.
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search colors"
          placeholderTextColor={colors.placeholder}
          autoCorrect={false}
          style={[
            styles.search,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
          ]}
          accessibilityLabel="Search sleeve colors"
        />
        <ScrollView contentContainerStyle={[styles.modalList, { paddingBottom: insets.bottom + spacing.lg }]}>
          <SwatchButton
            label="No sleeve"
            selected={selectedId == null}
            onPress={() => onSelect(null)}
          />
          <SleeveGroup title="Matte" sleeves={matte} selectedId={selectedId} onSelect={onSelect} />
          <SleeveGroup title="Dual Matte" sleeves={dual} selectedId={selectedId} onSelect={onSelect} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function SleeveGroup({
  title,
  sleeves,
  selectedId,
  onSelect,
}: {
  title: string;
  sleeves: DragonSleeve[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { colors } = useTheme();
  if (sleeves.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={[typeScale.label, { color: colors.textSecondary }]}>{title}</Text>
      <View style={styles.swatches}>
        {sleeves.map((sleeve) => (
          <SwatchButton
            key={sleeve.id}
            label={sleeveLabel(sleeve)}
            sleeve={sleeve}
            selected={sleeve.id === selectedId}
            onPress={() => onSelect(sleeve.id)}
          />
        ))}
      </View>
    </View>
  );
}

function SwatchButton({
  label,
  sleeve = null,
  selected,
  onPress,
}: {
  label: string;
  sleeve?: DragonSleeve | null;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={styles.swatchHit}
    >
      {sleeve ? (
        <View
          style={[
            styles.swatch,
            {
              backgroundColor: sleeve.outer,
              borderColor: selected ? colors.accent : colors.border,
              borderWidth: selected ? 3 : StyleSheet.hairlineWidth,
            },
          ]}
        >
          <View style={[styles.swatchInner, { backgroundColor: sleeve.inner ?? sleeve.outer }]} />
        </View>
      ) : (
          <View
            style={[
              styles.swatch,
              styles.noneSwatch,
              {
                borderColor: selected ? colors.accent : colors.border,
                borderWidth: selected ? 3 : StyleSheet.hairlineWidth,
                backgroundColor: colors.surface,
              },
            ]}
          >
          <Text style={[typeScale.caption, { color: colors.textSecondary }]}>None</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.sm,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  preview: {
    width: 56,
  },
  previewFace: {
    height: 72,
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  photo: {
    width: 120,
    height: 168,
    borderRadius: radius.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: spacing.sm,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  done: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  note: {
    paddingHorizontal: spacing.md,
  },
  search: {
    margin: spacing.md,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  modalList: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  group: {
    gap: spacing.sm,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  swatchHit: {
    minWidth: SWATCH,
    minHeight: SWATCH,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: radius.sm,
    padding: 6,
  },
  swatchInner: {
    flex: 1,
    borderRadius: 4,
  },
  noneSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
});
