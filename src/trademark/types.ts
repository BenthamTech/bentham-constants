export interface TrademarkPricingConfig {
  governmentFeePerClass: number;
  stampPaperPerClass: number;
  benthamFeePerClass: number;
}

export interface TrademarkCostBreakdown {
  governmentFee: number;
  stampPaper: number;
  benthamFee: number;
  total: number;
  numberOfClasses: number;
}
