import { CompanyType } from './company-types';
import type { FeeItem } from '../fees';

/** Re-exported for existing importers; the source is `@bentham/constants/fees`. */
export type { FeeItem, FeeItemId } from '../fees';

export interface FeeBreakdown {
  companyType: CompanyType;
  items: FeeItem[];
  totalAmount: number;
  metadata?: { authorizedCapital: number; directorCount: number; waivedDscCount: number };
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
