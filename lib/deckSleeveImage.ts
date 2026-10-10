import { fetch } from 'expo/fetch';
import * as ImagePicker from 'expo-image-picker';

import { isDeckSleeveImageUrl } from './deckSleeve';
import { updateMtgDeck } from './mtgDecks';
import { supabase } from './supabase';

const BUCKET = 'deck-sleeves';
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type SleevePhoto = {
  uri: string;
  mimeType: string;
};

export async function pickDeckSleevePhoto(): Promise<SleevePhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Allow photo access to attach a sleeve image.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [63, 88],
    quality: 0.6,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  const mimeType = asset.mimeType ?? 'image/jpeg';
  if (!ALLOWED.has(mimeType)) throw new Error('Use a JPEG, PNG, or WebP photo.');
  return { uri: asset.uri, mimeType };
}

function objectPath(householdId: string, deckId: string): string {
  return `${householdId}/${deckId}`;
}

export async function uploadDeckSleevePhoto(
  deck: { id: string; householdId: string },
  photo: SleevePhoto,
): Promise<string> {
  const response = await fetch(photo.uri);
  if (!response.ok) throw new Error('Could not read that photo.');
  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_BYTES) throw new Error('That photo is too large. Try a smaller one.');
  const path = objectPath(deck.householdId, deck.id);
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: photo.mimeType,
    upsert: true,
  });
  if (error) throw new Error('Could not upload the sleeve photo.');
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;
  if (!isDeckSleeveImageUrl(url)) throw new Error('Could not save the sleeve photo.');
  await updateMtgDeck(deck.id, { sleeveImageUrl: url });
  return url;
}

export async function removeDeckSleevePhoto(deck: { id: string; householdId: string }): Promise<void> {
  await updateMtgDeck(deck.id, { sleeveImageUrl: null });
  await supabase.storage.from(BUCKET).remove([objectPath(deck.householdId, deck.id)]);
}
