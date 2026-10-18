import { FEE_ITEM_ID, fetchServiceFee } from '../../src/fees';
import { calculateIncorporationCost, calculateLlpCost, llpPricingConfig, pricingConfig } from '../../src/incorporation';

describe('fetchServiceFee', () => {
  it("reads the private limited calculator's service line", () => {
    expect(fetchServiceFee(calculateIncorporationCost({ state: 'TELANGANA', waivedDscCount: 0 }))).toBe(pricingConfig.serviceFee);
  });

  it("reads the LLP calculator's service line", () => {
    expect(fetchServiceFee(calculateLlpCost({ waivedDscCount: 0 }))).toBe(llpPricingConfig.serviceFee);
  });

  it('reads any breakdown with items, not only incorporation', () => {
    expect(fetchServiceFee({ items: [{ id: FEE_ITEM_ID.GOVERNMENT, label: 'Government', amount: 100 }, { id: FEE_ITEM_ID.SERVICE, label: 'Service', amount: 500 }] })).toBe(500);
  });

  it('is undefined when there is no service line', () => {
    expect(fetchServiceFee({ items: [{ id: FEE_ITEM_ID.GOVERNMENT, label: 'Government', amount: 100 }] })).toBeUndefined();
  });

  it('only reads top-level lines', () => {
    expect(fetchServiceFee({ items: [{ id: FEE_ITEM_ID.PLAN, label: 'Plan', amount: 100, children: [{ id: FEE_ITEM_ID.SERVICE, label: 'Service', amount: 100 }] }] })).toBeUndefined();
  });
});

describe('FEE_ITEM_ID', () => {
  it('keeps the ids the calculators have always written', () => {
    const values = Object.values(FEE_ITEM_ID);
    expect(new Set(values).size).toBe(values.length);
    expect(FEE_ITEM_ID).toMatchObject({ GOVERNMENT: 'government', DSC: 'dsc', SERVICE: 'service', NAME_FILING: 'name-filing', PAN_TAN: 'pan-tan', STAMP_DUTY: 'stamp-duty' });
    const ids = calculateIncorporationCost({ waivedDscCount: 0 }).items.map((item) => item.id);
    expect(ids).toEqual([FEE_ITEM_ID.GOVERNMENT, FEE_ITEM_ID.DSC, FEE_ITEM_ID.SERVICE]);
  });
});
