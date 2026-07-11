import pricingConfig from './pricing-config.json';

export interface TrademarkFeeBreakdown {
  governmentFee: number;
  stampPaper: number;
  benthamFee: number;
  total: number;
  numberOfClasses: number;
}

export const TRADEMARK_PRICING = {
  /** Government fee per trademark class (INR) */
  GOVERNMENT_FEE_PER_CLASS: pricingConfig.governmentFeePerClass,
  /** Stamp paper cost per trademark class (INR) */
  STAMP_PAPER_PER_CLASS: pricingConfig.stampPaperPerClass,
  /** Bentham platform fee per trademark class (INR) */
  BENTHAM_FEE_PER_CLASS: pricingConfig.benthamFeePerClass,
  /** Total cost per class (government + stamp + Bentham) */
  TOTAL_PER_CLASS: pricingConfig.governmentFeePerClass + pricingConfig.stampPaperPerClass + pricingConfig.benthamFeePerClass,
} as const;

export function calculateBenthamFee(numberOfClasses: number): number {
  return TRADEMARK_PRICING.BENTHAM_FEE_PER_CLASS * numberOfClasses;
}

export function calculateGovernmentFee(numberOfClasses: number): number {
  return TRADEMARK_PRICING.GOVERNMENT_FEE_PER_CLASS * numberOfClasses;
}

export function calculateStampPaperFee(numberOfClasses: number): number {
  return TRADEMARK_PRICING.STAMP_PAPER_PER_CLASS * numberOfClasses;
}

export function calculateTrademarkCost(numberOfClasses: number): TrademarkFeeBreakdown {
  const governmentFee = calculateGovernmentFee(numberOfClasses);
  const stampPaper = calculateStampPaperFee(numberOfClasses);
  const benthamFee = calculateBenthamFee(numberOfClasses);
  return {
    governmentFee,
    stampPaper,
    benthamFee,
    total: governmentFee + stampPaper + benthamFee,
    numberOfClasses,
  };
}
