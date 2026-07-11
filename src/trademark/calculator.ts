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
  const classes = Math.max(1, numberOfClasses);
  return pricingConfig.benthamFeePerClass * classes;
}

/** Calculate government fee for N trademark classes */
export function calculateGovernmentFee(numberOfClasses: number): number {
  const classes = Math.max(1, numberOfClasses);
  return pricingConfig.governmentFeePerClass * classes;
}

/** Calculate stamp paper fee for N trademark classes */
export function calculateStampPaperFee(numberOfClasses: number): number {
  const classes = Math.max(1, numberOfClasses);
  return pricingConfig.stampPaperPerClass * classes;
}

/** Calculate full cost breakdown for N trademark classes */
export function calculateTrademarkCost(numberOfClasses: number): TrademarkCostBreakdown {
  const classes = Math.max(1, numberOfClasses);
  const governmentFee = calculateGovernmentFee(classes);
  const stampPaper = calculateStampPaperFee(classes);
  const benthamFee = calculateBenthamFee(classes);
  return {
    governmentFee,
    stampPaper,
    benthamFee,
    total: governmentFee + stampPaper + benthamFee,
    numberOfClasses: classes,
  };
}
