import {
  trademarkPricingConfig,
  TOTAL_PER_CLASS,
  calculateBenthamFee,
  calculateGovernmentFee,
  calculateStampPaperFee,
  calculateTrademarkCost,
} from '../../src/trademark';
import type { TrademarkCostBreakdown } from '../../src/trademark';

describe('trademarkPricingConfig', () => {
  it('exports pricing constants', () => {
    expect(trademarkPricingConfig.governmentFeePerClass).toBe(4500);
    expect(trademarkPricingConfig.stampPaperPerClass).toBe(120);
    expect(trademarkPricingConfig.benthamFeePerClass).toBe(1500);
  });
});

describe('TOTAL_PER_CLASS', () => {
  it('equals sum of all per-class fees', () => {
    expect(TOTAL_PER_CLASS).toBe(4500 + 120 + 1500);
    expect(TOTAL_PER_CLASS).toBe(6120);
  });
});

describe('calculateBenthamFee', () => {
  it('returns Bentham fee for 1 class', () => {
    expect(calculateBenthamFee(1)).toBe(1500);
  });

  it('scales linearly with number of classes', () => {
    expect(calculateBenthamFee(3)).toBe(4500);
    expect(calculateBenthamFee(5)).toBe(7500);
  });
});

describe('calculateGovernmentFee', () => {
  it('returns government fee for 1 class', () => {
    expect(calculateGovernmentFee(1)).toBe(4500);
  });

  it('scales linearly with number of classes', () => {
    expect(calculateGovernmentFee(2)).toBe(9000);
    expect(calculateGovernmentFee(4)).toBe(18000);
  });
});

describe('calculateStampPaperFee', () => {
  it('returns stamp paper fee for 1 class', () => {
    expect(calculateStampPaperFee(1)).toBe(120);
  });

  it('scales linearly with number of classes', () => {
    expect(calculateStampPaperFee(3)).toBe(360);
    expect(calculateStampPaperFee(10)).toBe(1200);
  });
});

describe('calculateTrademarkCost', () => {
  it('returns correct breakdown for 1 class', () => {
    const result: TrademarkCostBreakdown = calculateTrademarkCost(1);
    expect(result).toEqual({
      governmentFee: 4500,
      stampPaper: 120,
      benthamFee: 1500,
      total: 6120,
      numberOfClasses: 1,
    });
  });

  it('returns correct breakdown for multiple classes', () => {
    const result = calculateTrademarkCost(3);
    expect(result).toEqual({
      governmentFee: 13500,
      stampPaper: 360,
      benthamFee: 4500,
      total: 18360,
      numberOfClasses: 3,
    });
  });

  it('total equals sum of components', () => {
    const result = calculateTrademarkCost(5);
    expect(result.total).toBe(result.governmentFee + result.stampPaper + result.benthamFee);
  });

  it('total equals TOTAL_PER_CLASS * numberOfClasses', () => {
    for (const n of [1, 2, 5, 10, 45]) {
      const result = calculateTrademarkCost(n);
      expect(result.total).toBe(TOTAL_PER_CLASS * n);
    }
  });
});

describe('input clamping', () => {
  it('clamps zero to 1 class minimum', () => {
    expect(calculateBenthamFee(0)).toBe(1500);
    expect(calculateGovernmentFee(0)).toBe(4500);
    expect(calculateStampPaperFee(0)).toBe(120);
  });

  it('clamps negative values to 1 class minimum', () => {
    const result = calculateTrademarkCost(-5);
    expect(result.numberOfClasses).toBe(1);
    expect(result.total).toBe(6120);
  });
});