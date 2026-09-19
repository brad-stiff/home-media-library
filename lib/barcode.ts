import { MovieOwnership } from './types';

/** Digits only. */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isIsbn(digits: string): boolean {
  if (digits.length === 10) return true;
  if (digits.length === 13 && (digits.startsWith('978') || digits.startsWith('979'))) {
    return true;
  }
  return false;
}

export function isLikelyProductUpc(digits: string): boolean {
  return digits.length === 12 || digits.length === 13 || digits.length === 8;
}

/** Strip common retail format noise so TMDb search works better. */
export function cleanProductTitleForSearch(title: string): string {
  return title
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(
      /\b(4k|uhd|ultra\s*hd|blu-?ray|bluray|dvd|digital|combo\s*pack|steelbook|collector'?s?\s*edition|special\s*edition|limited\s*edition|anniversary\s*edition)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function ownershipHintsFromProductTitle(title: string): Partial<MovieOwnership> {
  const lower = title.toLowerCase();
  const hints: Partial<MovieOwnership> = {};
  if (/\b(4k|uhd|ultra\s*hd)\b/.test(lower)) hints.has4k = true;
  if (/\b(blu-?ray|bluray)\b/.test(lower)) hints.hasBluray = true;
  if (/\bdigital\b/.test(lower)) hints.hasDigital = true;
  // Many 4K retail titles omit "Blu-ray" in the string — still mark 4K only.
  return hints;
}
