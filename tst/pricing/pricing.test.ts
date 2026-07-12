import { SERVICE_FEE_CEILING } from '../../src/pricing';

describe('SERVICE_FEE_CEILING', () => {
  it('has incorporation entry matching pricingConfig.serviceFee', () => {
    expect(SERVICE_FEE_CEILING.incorporation).toBe(3000);
  });

  it('has trademark entry matching trademarkPricingConfig.benthamFeePerClass', () => {
    expect(SERVICE_FEE_CEILING.trademark).toBe(1500);
  });

  it('has exactly 2 entity types', () => {
    expect(Object.keys(SERVICE_FEE_CEILING)).toHaveLength(2);
  });

  it('all values are positive numbers', () => {
    for (const [key, value] of Object.entries(SERVICE_FEE_CEILING)) {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    }
  });
});
