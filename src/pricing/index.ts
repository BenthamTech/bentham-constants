import { pricingConfig } from '../incorporation';
import { trademarkPricingConfig } from '../trademark';

/**
 * Maximum discountable service fee per entity type.
 * Used by coupon validation to cap discount amounts.
 */
export const SERVICE_FEE_CEILING: Record<string, number> = {
  incorporation: pricingConfig.serviceFee,
  trademark: trademarkPricingConfig.benthamFeePerClass,
};
