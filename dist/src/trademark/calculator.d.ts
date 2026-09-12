import type { TrademarkCostBreakdown, TrademarkPricingConfig } from './types';
export declare const trademarkPricingConfig: TrademarkPricingConfig;
/** Total cost per trademark class (government + stamp paper + Bentham fee) */
export declare const TOTAL_PER_CLASS: number;
/** Calculate Bentham platform fee for N trademark classes */
export declare function calculateBenthamFee(numberOfClasses: number): number;
/** Calculate government fee for N trademark classes */
export declare function calculateGovernmentFee(numberOfClasses: number): number;
/** Calculate stamp paper fee for N trademark classes */
export declare function calculateStampPaperFee(numberOfClasses: number): number;
/** Calculate full cost breakdown for N trademark classes */
export declare function calculateTrademarkCost(numberOfClasses: number): TrademarkCostBreakdown;
