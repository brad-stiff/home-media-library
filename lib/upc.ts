export type UpcLookupResult = {
  barcode: string;
  title: string;
  brand: string | null;
};

type UpcItemDbResponse = {
  code?: string;
  total?: number;
  items?: {
    title?: string;
    brand?: string;
    description?: string;
  }[];
};

/** Free trial endpoint — no API key (rate limited). */
export async function lookupUpcProduct(barcode: string): Promise<UpcLookupResult | null> {
  const digits = barcode.replace(/\D/g, '');
  const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(digits)}`;

  const response = await fetch(url);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`UPC lookup failed (${response.status}). Try manual search.`);
  }

  const data = (await response.json()) as UpcItemDbResponse;
  const item = data.items?.[0];
  if (!item?.title) {
    return null;
  }

  return {
    barcode: digits,
    title: item.title,
    brand: item.brand ?? null,
  };
}
