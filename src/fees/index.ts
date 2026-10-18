/**
 * Fee breakdown primitives shared by every product (incorporation, trademark,
 * requests, compliance): a fee line, the shared top-level line ids, and the
 * reader for Bentham's own fee. A leaf module: it imports nothing, so product
 * modules (and `pricing`) can build on it without a cycle.
 */

/** One line of a fee breakdown, optionally with sub-lines. Amounts are rupees. */
export interface FeeItem {
  id: string;
  label: string;
  amount: number;
  children?: FeeItem[];
}

/**
 * Ids of the top-level fee lines shared across products. SERVICE marks Bentham's
 * own fee, the line `fetchServiceFee` reads; every fee breakdown writes its
 * service line with this id.
 */
export const FEE_ITEM_ID = {
  GOVERNMENT: 'government',
  DSC: 'dsc',
  SERVICE: 'service',
} as const;

/**
 * Bentham's service fee in a fee breakdown: the amount of its top-level SERVICE
 * line, or undefined if it has none. Takes any breakdown with `items`.
 */
export function fetchServiceFee(breakdown: { items: readonly FeeItem[] }): number | undefined {
  return breakdown.items.find((item) => item.id === FEE_ITEM_ID.SERVICE)?.amount;
}
