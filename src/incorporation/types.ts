export interface FeeItem {
  id: string;
  label: string;
  amount: number;
  children?: FeeItem[];
}

export interface FeeBreakdown {
  items: FeeItem[];
  totalAmount: number;
  metadata?: { authorizedCapital: number; directorCount: number };
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
