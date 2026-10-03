export type DeckFormat = 'commander' | 'standard';

export type DeckBoard = 'commander' | 'main' | 'sideboard' | 'maybeboard';

export type LegalityCard = {
  name: string;
  qty: number;
  board: DeckBoard;
  typeLine: string | null;
  oracleText: string | null;
  keywords: readonly string[];
  /** WUBRG letters, '' for colorless, null when Scryfall has not been read yet. */
  colorIdentity: string | null;
  /** Scryfall legalities.standard. Null when it has not been read yet. */
  standardLegality: string | null;
};

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const;

export function isDeckFormat(value: unknown): value is DeckFormat {
  return value === 'commander' || value === 'standard';
}

export function isDeckBoard(value: unknown): value is DeckBoard {
  return value === 'commander' || value === 'main' || value === 'sideboard' || value === 'maybeboard';
}

export function formatLabel(format: DeckFormat): string {
  return format === 'commander' ? 'Commander' : 'Standard';
}

export function boardLabel(board: DeckBoard): string {
  if (board === 'commander') return 'Commander';
  if (board === 'sideboard') return 'Sideboard';
  if (board === 'maybeboard') return 'Maybeboard';
  return 'Main';
}

export function categoryForBoard(board: DeckBoard): string {
  return board === 'main' ? 'Main' : boardLabel(board);
}

export function colorIdentityKey(colors: readonly string[] | null | undefined): string {
  const present = new Set((colors ?? []).map((color) => color.toUpperCase()));
  return COLOR_ORDER.filter((color) => present.has(color)).join('');
}

export function foldCardName(name: string): string {
  return name.trim().toLowerCase().replaceAll('û', 'u').replaceAll('ü', 'u');
}

function stripReminder(text: string): string {
  let current = text;
  let previous = '';
  while (current !== previous) {
    previous = current;
    current = current.replace(/\([^()]*\)/g, '');
  }
  return current;
}

function hasKeyword(card: LegalityCard, keyword: string): boolean {
  const target = keyword.toLowerCase();
  if (card.keywords.some((entry) => entry.toLowerCase() === target)) return true;
  if (card.keywords.length > 0 || card.oracleText == null) return false;
  return stripReminder(card.oracleText).toLowerCase().includes(target);
}

function partnerWithName(card: LegalityCard): string | null {
  if (!hasKeyword(card, 'Partner with') && card.oracleText == null) return null;
  const text = card.oracleText ?? '';
  const match = text.match(/partner with ([^\n.(]+)/i);
  return match?.[1]?.trim() || null;
}

function hasGenericPartner(card: LegalityCard): boolean {
  if (card.keywords.some((entry) => entry.toLowerCase() === 'partner')) return true;
  if (card.keywords.length > 0 || card.oracleText == null) return false;
  const text = stripReminder(card.oracleText);
  if (/partner with/i.test(text)) return false;
  return /\bpartner\b/i.test(text);
}

function namesMatch(left: string, right: string): boolean {
  return foldCardName(left) === foldCardName(right);
}

export function isBasicLand(typeLine: string | null): boolean {
  const type = typeLine ?? '';
  return /\bbasic\b/i.test(type) && /\bland\b/i.test(type);
}

export function canBeCommander(card: LegalityCard): boolean {
  if (/legendary creature/i.test(card.typeLine ?? '')) return true;
  return /can be your commander/i.test(card.oracleText ?? '');
}

function isBackground(card: LegalityCard): boolean {
  return /\bbackground\b/i.test(card.typeLine ?? '');
}

function choosesBackground(card: LegalityCard): boolean {
  return hasKeyword(card, 'Choose a Background');
}

function isDoctor(card: LegalityCard): boolean {
  return /\bdoctor\b/i.test(card.typeLine ?? '');
}

function isDoctorsCompanion(card: LegalityCard): boolean {
  return hasKeyword(card, "Doctor's companion");
}

function hasFriendsForever(card: LegalityCard): boolean {
  return hasKeyword(card, 'Friends forever');
}

/** Null means any number of copies is allowed. */
export function copyLimit(format: DeckFormat, card: LegalityCard): number | null {
  if (isBasicLand(card.typeLine)) return null;
  const name = foldCardName(card.name);
  const oracle = card.oracleText ?? '';
  if (name === 'seven dwarves' || /up to seven cards named seven dwarves/i.test(oracle)) return 7;
  if (name === 'nazgul' || /up to nine cards named nazg[uû]l/i.test(oracle)) return 9;
  if (/a deck can have any number of cards named/i.test(oracle)) return null;
  return format === 'commander' ? 1 : 4;
}

function sumQty(cards: readonly LegalityCard[]): number {
  return cards.reduce((sum, card) => sum + card.qty, 0);
}

function onBoards(cards: readonly LegalityCard[], boards: readonly DeckBoard[]): LegalityCard[] {
  return cards.filter((card) => card.qty > 0 && boards.includes(card.board));
}

function combinedIdentity(commanders: readonly LegalityCard[]): string {
  return colorIdentityKey(commanders.flatMap((card) => (card.colorIdentity ?? '').split('')));
}

function fitsIdentity(cardIdentity: string, commanderIdentity: string): boolean {
  for (const color of cardIdentity) {
    if (!commanderIdentity.includes(color)) return false;
  }
  return true;
}

function commandersCanPair(left: LegalityCard, right: LegalityCard): boolean {
  if (hasGenericPartner(left) && hasGenericPartner(right) && canBeCommander(left) && canBeCommander(right)) {
    return true;
  }
  const leftPartner = partnerWithName(left);
  const rightPartner = partnerWithName(right);
  if (
    leftPartner &&
    rightPartner &&
    namesMatch(leftPartner, right.name) &&
    namesMatch(rightPartner, left.name) &&
    canBeCommander(left) &&
    canBeCommander(right)
  ) {
    return true;
  }
  if (hasFriendsForever(left) && hasFriendsForever(right) && canBeCommander(left) && canBeCommander(right)) {
    return true;
  }
  if (choosesBackground(left) && isBackground(right) && canBeCommander(left)) return true;
  if (choosesBackground(right) && isBackground(left) && canBeCommander(right)) return true;
  if (isDoctor(left) && isDoctorsCompanion(right) && canBeCommander(left)) return true;
  if (isDoctor(right) && isDoctorsCompanion(left) && canBeCommander(right)) return true;
  return false;
}

function copyWarnings(format: DeckFormat, cards: readonly LegalityCard[], zones: readonly DeckBoard[]): string[] {
  const groups = new Map<string, { name: string; qty: number; sample: LegalityCard }>();
  for (const card of onBoards(cards, zones)) {
    const key = foldCardName(card.name);
    const current = groups.get(key);
    if (current) {
      current.qty += card.qty;
    } else {
      groups.set(key, { name: card.name, qty: card.qty, sample: card });
    }
  }

  const warnings: string[] = [];
  for (const group of groups.values()) {
    const limit = copyLimit(format, group.sample);
    if (limit != null && group.qty > limit) {
      const rule = format === 'commander' ? 'Commander allows' : 'Standard allows';
      warnings.push(`${group.name} appears ${group.qty} times. ${rule} ${limit}.`);
    }
  }
  return warnings;
}

function commanderWarnings(cards: readonly LegalityCard[]): string[] {
  const warnings: string[] = [];
  const commanders = onBoards(cards, ['commander']);
  const sideboardQty = sumQty(onBoards(cards, ['sideboard']));
  const size = sumQty(onBoards(cards, ['commander', 'main']));

  if (sideboardQty > 0) {
    warnings.push(
      `Commander decks have no sideboard. ${sideboardQty} ${sideboardQty === 1 ? 'card is' : 'cards are'} not counted.`,
    );
  }

  if (commanders.length === 0) {
    warnings.push('Choose a commander.');
  } else if (commanders.length > 2) {
    warnings.push('A Commander deck can have at most two commanders.');
  } else if (commanders.length === 1) {
    const commander = commanders[0];
    if (commander && !canBeCommander(commander)) {
      warnings.push(`${commander.name} can't be your commander.`);
    }
  } else if (commanders.length === 2) {
    const [first, second] = commanders;
    if (first && second && !commandersCanPair(first, second)) {
      warnings.push(`${first.name} and ${second.name} can't be paired as commanders.`);
    }
  }

  if (size !== 100) {
    warnings.push(`Commander decks are 100 cards including the commander. This one has ${size}.`);
  }

  warnings.push(...copyWarnings('commander', cards, ['commander', 'main']));

  if (commanders.length > 0 && commanders.length <= 2 && commanders.every((card) => card.colorIdentity != null)) {
    const identity = combinedIdentity(commanders);
    const seen = new Set<string>();
    for (const card of onBoards(cards, ['main'])) {
      if (card.colorIdentity == null) {
        warnings.push(`Couldn't check color identity for ${card.name}.`);
        continue;
      }
      const key = foldCardName(card.name);
      if (seen.has(key) || fitsIdentity(card.colorIdentity, identity)) continue;
      seen.add(key);
      warnings.push(`${card.name} is outside the commander's color identity.`);
    }
  }

  return warnings;
}

function standardWarnings(cards: readonly LegalityCard[]): string[] {
  const warnings: string[] = [];
  const mainQty = sumQty(onBoards(cards, ['main']));
  const sideQty = sumQty(onBoards(cards, ['sideboard']));
  const commanders = onBoards(cards, ['commander']);

  if (mainQty < 60) {
    warnings.push(`Standard decks need at least 60 cards in the main deck. This one has ${mainQty}.`);
  }
  if (sideQty > 15) {
    warnings.push(`A Standard sideboard can have at most 15 cards. This one has ${sideQty}.`);
  }
  if (commanders.length > 0) {
    warnings.push("Standard decks don't have a commander.");
  }

  const zones: DeckBoard[] = ['main', 'sideboard'];
  warnings.push(...copyWarnings('standard', cards, zones));

  const seen = new Set<string>();
  for (const card of onBoards(cards, zones)) {
    const key = foldCardName(card.name);
    if (seen.has(key)) continue;
    seen.add(key);
    if (card.standardLegality == null) {
      warnings.push(`Couldn't check Standard legality for ${card.name}.`);
    } else if (card.standardLegality !== 'legal') {
      const status = card.standardLegality === 'banned' ? 'banned in Standard' : 'not legal in Standard';
      warnings.push(`${card.name} is ${status}.`);
    }
  }

  return warnings;
}

/** Warn and still save. Maybeboard never counts. This does not simulate a game. */
export function deckWarnings(format: DeckFormat, cards: readonly LegalityCard[]): string[] {
  return format === 'commander' ? commanderWarnings(cards) : standardWarnings(cards);
}
