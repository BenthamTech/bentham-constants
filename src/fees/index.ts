/**
 * Fee breakdown primitives shared by every product (incorporation, trademark,
 * requests, compliance): a fee line, the shared top-level line ids, and the
 * reader for Bentham's own fee. A leaf module: it imports nothing, so product
 * modules (and `pricing`) can build on it without a cycle.
 */

/**
 * The id of every kind of fee line, shared across products: a government fee is
 * GOVERNMENT whichever product charges it, so ids are never per-product. SERVICE
 * marks Bentham's own fee, the line `fetchServiceFee` reads. Add a kind here
 * before using it; `FeeItem.id` accepts only these.
 */
export const FEE_ITEM_ID = {
  /** Government fees (MCA, IP India), or the group of them. */
  GOVERNMENT: 'government',
  /** Name reservation filing (RUN / RUN-LLP). */
  NAME_FILING: 'name-filing',
  /** PAN and TAN application charges. */
  PAN_TAN: 'pan-tan',
  /** Stamp duty on incorporation documents. */
  STAMP_DUTY: 'stamp-duty',
  /** Non-judicial stamp paper. */
  STAMP_PAPER: 'stamp-paper',
  /** Digital signature certificates. */
  DSC: 'dsc',
  /** A notarised affidavit (with its notary and stamp charges). */
  AFFIDAVIT_NOTARIZATION: 'affidavit-notarization',
  /** A plan or subscription period, grouping its own lines. */
  PLAN: 'plan',
  /** Bentham's own fee. */
  SERVICE: 'service',
} as const;

export type FeeItemId = (typeof FEE_ITEM_ID)[keyof typeof FEE_ITEM_ID];

/** One line of a fee breakdown, optionally with sub-lines. Amounts are rupees. */
export interface FeeItem {
  id: FeeItemId;
  label: string;
  amount: number;
  children?: FeeItem[];
}

/**
 * A product's fee breakdown as a payment step shows and charges it: the lines and
 * their total (the amount charged). Products add their own fields on top (see
 * incorporation's `FeeBreakdown`).
 */
export interface FeeLines {
  items: FeeItem[];
  totalAmount: number;
}

/**
 * Bentham's service fee in a fee breakdown: the amount of its top-level SERVICE
 * line, or undefined if it has none. Takes any breakdown with `items`.
 */
export function fetchServiceFee(breakdown: Pick<FeeLines, 'items'>): number | undefined {
  return breakdown.items.find((item) => item.id === FEE_ITEM_ID.SERVICE)?.amount;
}
