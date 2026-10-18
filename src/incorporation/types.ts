import { CompanyType } from './company-types';

export interface FeeItem {
  id: string;
  label: string;
  amount: number;
  children?: FeeItem[];
}

export interface FeeBreakdown {
  companyType: CompanyType;
  items: FeeItem[];
  totalAmount: number;
  metadata?: { authorizedCapital: number; directorCount: number; waivedDscCount: number };
}

/**
 * Ids of the top-level fee lines shared across products. SERVICE marks Bentham's
 * own fee, the line `fetchServiceFee` reads; every fee breakdown (incorporation,
 * trademark, requests) writes its service line with this id.
 */
export const FEE_ITEM_ID = {
  GOVERNMENT: 'government',
  DSC: 'dsc',
  SERVICE: 'service',
} as const;

/**
 * Bentham's service fee in a fee breakdown: the amount of its top-level SERVICE
 * line, or undefined if it has none. Takes any breakdown with `items`, so it reads
 * trademark and request breakdowns too, not only incorporation's.
 */
export function fetchServiceFee(breakdown: { items: readonly FeeItem[] }): number | undefined {
  return breakdown.items.find((item) => item.id === FEE_ITEM_ID.SERVICE)?.amount;
}

/**
 * waivedDscCount is required so every caller decides on the DSC waiver
 * (directors who already hold a DSC). Pass 0 when there is no application.
 */
export interface IncorporationCostInput {
  state?: string;
  directorCount?: number;
  authorizedCapital?: number;
  waivedDscCount: number;
}

export interface LlpCostInput {
  partnerCount?: number;
  contribution?: number;
  waivedDscCount: number;
}

export type AoaFormula =
  | { type: 'fixed'; amount: number }
  | { type: 'percentage'; rate: number; min?: number; max?: number }
  | { type: 'slab'; perSlab: number; slabSize: number; max?: number }
  | { type: 'threshold'; cutoff: number; below: number; above: number }
  | { type: 'tiered'; tiers: { maxCapital: number; amount: number }[]; fallbackRate: number }
  | { type: 'zero' };

export interface StateStampDutyEntry {
  inc: number;
  moa: number;
  aoa: AoaFormula;
  maxTotal?: number;
}
