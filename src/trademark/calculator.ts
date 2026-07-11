import pricingConfig from './pricing-config.json';
import type { TrademarkCostBreakdown, TrademarkPricingConfig } from './types';

export const trademarkPricingConfig: TrademarkPricingConfig = pricingConfig;

/** Total cost per trademark class (government + stamp paper + Bentham fee) */
export const TOTAL_PER_CLASS =
  pricingConfig.governmentFeePerClass +
  pricingConfig.stampPaperPerClass +
  pricingConfig.benthamFeePerClass;

/** Calculate Bentham platform fee for N trademark classes */
export function calculateBenthamFee(numberOfClasses: number): number {
  return pricingConfig.benthamFeePerClass * numberOfClasses;
}

/** Calculate government fee for N trademark classes */
export function calculateGovernmentFee(numberOfClasses: number): number {
  return pricingConfig.governmentFeePerClass * numberOfClasses;
}

/** Calculate stamp paper fee for N trademark classes */
export function calculateStampPaperFee(numberOfClasses: number): number {
  return pricingConfig.stampPaperPerClass * numberOfClasses;
}

/** Calculate full cost breakdown for N trademark classes */
export function calculateTrademarkCost(numberOfClasses: number): TrademarkCostBreakdown {
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
