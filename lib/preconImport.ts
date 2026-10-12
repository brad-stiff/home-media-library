import { addMtgPrintingsFromScryfall } from './mtgCards';
import { createMtgDeckWithCards, draftFromScryfall } from './mtgDecks';
import { ParsedPrecon } from './precons';
import { getScryfallCardsByIds } from './scryfall';

export async function importPrecon(parsed: ParsedPrecon, alsoDeck: boolean): Promise<{ deckId: string | null }> {
  if (parsed.missingNames.length > 0) {
    throw new Error(`${parsed.missingNames.length} cards have no Scryfall id. Nothing was added.`);
  }
  if (parsed.cards.length === 0) throw new Error('This precon has no cards.');

  const found = await getScryfallCardsByIds(parsed.cards.map((card) => card.scryfallId));
  const byId = new Map(found.map((card) => [card.id, card]));
  const unresolved = parsed.cards.filter((card) => !byId.has(card.scryfallId)).length;
  if (unresolved > 0) {
    throw new Error(`Could not find ${unresolved} cards on Scryfall. Nothing was added.`);
  }

  await addMtgPrintingsFromScryfall(
    parsed.cards.map((card) => ({
      card: byId.get(card.scryfallId)!,
      qty: card.qty,
      foil: card.foil,
    })),
  );

  if (!alsoDeck) return { deckId: null };

  try {
    const deck = await createMtgDeckWithCards(
      parsed.name,
      'commander',
      parsed.cards.map((card) =>
        draftFromScryfall(byId.get(card.scryfallId)!, {
          board: card.board,
          foil: card.foil,
          qty: card.qty,
        }),
      ),
    );
    return { deckId: deck.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save the deck.';
    throw new Error(`The cards are in your collection. ${message}`);
  }
}
