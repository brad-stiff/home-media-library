import { Tables } from './database.types';
import { getMyHousehold } from './household';
import { mapInChunks, pageAll } from './pageAll';
import { supabase } from './supabase';

export { checkoutStatus, type CheckoutStatus } from './checkoutStatus';

export type CheckoutItemType = 'movie' | 'book';

export type Checkout = {
  id: string;
  householdId: string;
  itemType: CheckoutItemType;
  itemId: string;
  contactId: string | null;
  borrowerName: string;
  checkedOutAt: string;
  returnedAt: string | null;
  cancelledAt: string | null;
  checkedOutBy: string | null;
  notes: string | null;
};

export type HouseholdLoan = Checkout & {
  title: string;
};

type CheckoutRow = Tables<'checkouts'>;

function rowToCheckout(row: CheckoutRow): Checkout {
  const itemType: CheckoutItemType = row.item_type === 'book' ? 'book' : 'movie';
  return {
    id: row.id,
    householdId: row.household_id,
    itemType,
    itemId: row.item_id,
    contactId: row.contact_id,
    borrowerName: row.borrower_name,
    checkedOutAt: row.checked_out_at,
    returnedAt: row.returned_at,
    cancelledAt: row.cancelled_at,
    checkedOutBy: row.checked_out_by,
    notes: row.notes,
  };
}

export async function getActiveCheckout(
  itemType: CheckoutItemType,
  itemId: string,
): Promise<Checkout | null> {
  const { data, error } = await supabase
    .from('checkouts')
    .select('*')
    .eq('item_type', itemType)
    .eq('item_id', itemId)
    .is('returned_at', null)
    .is('cancelled_at', null)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToCheckout(data) : null;
}

/** Map of item_id → active checkout for a given type (for library badges/filters). */
export async function getActiveCheckoutsByItemIds(
  itemType: CheckoutItemType,
  itemIds: string[],
): Promise<Map<string, Checkout>> {
  const map = new Map<string, Checkout>();
  if (itemIds.length === 0) return map;

  const rows = await mapInChunks(itemIds, (ids) =>
    pageAll((from, to) =>
      supabase
        .from('checkouts')
        .select('*')
        .eq('item_type', itemType)
        .in('item_id', ids)
        .is('returned_at', null)
        .is('cancelled_at', null)
        .order('id', { ascending: true })
        .range(from, to),
    ),
  );
  for (const row of rows) {
    map.set(row.item_id, rowToCheckout(row));
  }
  return map;
}

export async function checkoutItem(
  itemType: CheckoutItemType,
  itemId: string,
  contactId: string,
  notes?: string,
): Promise<Checkout> {
  const { data, error } = await supabase.rpc('checkout_item', {
    p_item_type: itemType,
    p_item_id: itemId,
    p_contact_id: contactId,
    p_notes: notes?.trim() || null,
  });

  if (error) throw error;
  if (!data) throw new Error('Could not check out this item.');
  return rowToCheckout(data);
}

export async function returnCheckout(checkoutId: string): Promise<Checkout> {
  const { data, error } = await supabase.rpc('return_item', {
    p_checkout_id: checkoutId,
  });

  if (error) throw error;
  if (!data) throw new Error('Could not return this item.');
  return rowToCheckout(data);
}

export async function cancelCheckout(checkoutId: string): Promise<Checkout> {
  const { data, error } = await supabase.rpc('cancel_checkout', {
    p_checkout_id: checkoutId,
  });

  if (error) throw error;
  if (!data) throw new Error('Could not cancel this loan.');
  return rowToCheckout(data);
}

export async function updateCheckoutBorrower(checkoutId: string, contactId: string): Promise<Checkout> {
  const { data, error } = await supabase.rpc('update_checkout_borrower', {
    p_checkout_id: checkoutId,
    p_contact_id: contactId,
  });

  if (error) throw error;
  if (!data) throw new Error('Could not change this loan.');
  return rowToCheckout(data);
}

export async function listItemCheckouts(
  itemType: CheckoutItemType,
  itemId: string,
): Promise<Checkout[]> {
  const rows = await pageAll((from, to) =>
    supabase
      .from('checkouts')
      .select('*')
      .eq('item_type', itemType)
      .eq('item_id', itemId)
      .order('checked_out_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  );
  return rows.map(rowToCheckout);
}

export async function listHouseholdLoans(): Promise<HouseholdLoan[]> {
  const household = await getMyHousehold();
  const checkoutRows = await pageAll((from, to) =>
    supabase
      .from('checkouts')
      .select('*')
      .eq('household_id', household.householdId)
      .order('checked_out_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  );
  const rows = checkoutRows.map(rowToCheckout);
  const movieIds = rows.filter((row) => row.itemType === 'movie').map((row) => row.itemId);
  const bookIds = rows.filter((row) => row.itemType === 'book').map((row) => row.itemId);

  const [movies, books] = await Promise.all([
    mapInChunks(movieIds, async (ids) => {
      const { data, error } = await supabase.from('movies').select('id, title').in('id', ids);
      if (error) throw error;
      return data ?? [];
    }),
    mapInChunks(bookIds, async (ids) => {
      const { data, error } = await supabase.from('books').select('id, title').in('id', ids);
      if (error) throw error;
      return data ?? [];
    }),
  ]);

  const titles = new Map<string, string>();
  for (const movie of movies) titles.set(movie.id, movie.title);
  for (const book of books) titles.set(book.id, book.title);

  return rows.map((row) => ({
    ...row,
    title: titles.get(row.itemId) ?? 'Removed item',
  }));
}
