import { getMyHousehold } from './household';
import { supabase } from './supabase';

export type CheckoutItemType = 'movie' | 'book';

export type Checkout = {
  id: string;
  householdId: string;
  itemType: CheckoutItemType;
  itemId: string;
  borrowerName: string;
  checkedOutAt: string;
  returnedAt: string | null;
  checkedOutBy: string | null;
  notes: string | null;
};

type CheckoutRow = {
  id: string;
  household_id: string;
  item_type: CheckoutItemType;
  item_id: string;
  borrower_name: string;
  checked_out_at: string;
  returned_at: string | null;
  checked_out_by: string | null;
  notes: string | null;
};

function rowToCheckout(row: CheckoutRow): Checkout {
  return {
    id: row.id,
    householdId: row.household_id,
    itemType: row.item_type,
    itemId: row.item_id,
    borrowerName: row.borrower_name,
    checkedOutAt: row.checked_out_at,
    returnedAt: row.returned_at,
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
    .maybeSingle();

  if (error) throw error;
  return data ? rowToCheckout(data as CheckoutRow) : null;
}

/** Map of item_id → active checkout for a given type (for library badges/filters). */
export async function getActiveCheckoutsByItemIds(
  itemType: CheckoutItemType,
  itemIds: string[],
): Promise<Map<string, Checkout>> {
  const map = new Map<string, Checkout>();
  if (itemIds.length === 0) return map;

  const { data, error } = await supabase
    .from('checkouts')
    .select('*')
    .eq('item_type', itemType)
    .in('item_id', itemIds)
    .is('returned_at', null);

  if (error) throw error;
  for (const row of (data as CheckoutRow[]) ?? []) {
    map.set(row.item_id, rowToCheckout(row));
  }
  return map;
}

export async function checkoutItem(
  itemType: CheckoutItemType,
  itemId: string,
  borrowerName: string,
  notes?: string,
): Promise<Checkout> {
  const { data, error } = await supabase.rpc('checkout_item', {
    p_item_type: itemType,
    p_item_id: itemId,
    p_borrower_name: borrowerName.trim(),
    p_notes: notes?.trim() || null,
  });

  if (error) throw error;
  return rowToCheckout(data as CheckoutRow);
}

export async function returnCheckout(checkoutId: string): Promise<Checkout> {
  const { data, error } = await supabase.rpc('return_item', {
    p_checkout_id: checkoutId,
  });

  if (error) throw error;
  return rowToCheckout(data as CheckoutRow);
}

export async function listActiveCheckouts(): Promise<Checkout[]> {
  const household = await getMyHousehold();
  const { data, error } = await supabase
    .from('checkouts')
    .select('*')
    .eq('household_id', household.householdId)
    .is('returned_at', null)
    .order('checked_out_at', { ascending: false });

  if (error) throw error;
  return ((data as CheckoutRow[]) ?? []).map(rowToCheckout);
}
