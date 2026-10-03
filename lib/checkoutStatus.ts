export type CheckoutStatus = 'active' | 'returned' | 'cancelled';

export function checkoutStatus(checkout: {
  returnedAt: string | null;
  cancelledAt: string | null;
}): CheckoutStatus {
  if (checkout.cancelledAt) return 'cancelled';
  if (checkout.returnedAt) return 'returned';
  return 'active';
}
