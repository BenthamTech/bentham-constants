import { calculateStampDuty, calculateIncorporationCost, calculateLlpStampDuty, calculateLlpCost, getAvailableStates, toDisplayName } from '../../src/incorporation';
import expectedCosts from '../fixtures/expected-costs-36-states.json';

describe('calculateStampDuty', () => {
  describe('formula types', () => {
    it('fixed — returns fixed amount regardless of capital', () => {
      expect(calculateStampDuty('ARUNACHAL PRADESH', 100000)).toBe(710); // 10+200+500
      expect(calculateStampDuty('ARUNACHAL PRADESH', 5000000)).toBe(710);
    });

    it('zero — returns only inc+moa', () => {
      expect(calculateStampDuty('SIKKIM', 1000000)).toBe(0);
      expect(calculateStampDuty('LADAKH', 5000000)).toBe(0);
    });

    it('percentage — applies rate with min/max clamp', () => {
      // TELANGANA: rate=0.0015, min=1000, max=500000
      expect(calculateStampDuty('TELANGANA', 1000000)).toBe(2020); // 20+500+max(1000,1500)=1500 → 2020
      expect(calculateStampDuty('TELANGANA', 100000)).toBe(1520); // 20+500+max(1000,150)=1000 → 1520 (min kicks in)
      // GUJARAT: rate=0.005, no min, no max on aoa but maxTotal=500000
      expect(calculateStampDuty('GUJARAT', 1000000)).toBe(5320); // 20+300+5000=5320, no cap (< 500000)
      expect(calculateStampDuty('GUJARAT', 200000000)).toBe(500000); // maxTotal cap
    });

    it('slab — ceil(capital/slabSize) * perSlab', () => {
      // GOA: perSlab=1000, slabSize=500000
      expect(calculateStampDuty('GOA', 1000000)).toBe(2200); // 50+150+ceil(1000000/500000)*1000=2000 → 2200
      expect(calculateStampDuty('GOA', 500001)).toBe(2200); // ceil(500001/500000)=2 → 50+150+2000=2200
      expect(calculateStampDuty('GOA', 500000)).toBe(1200); // ceil(500000/500000)=1 → 50+150+1000=1200
    });

    it('threshold — below or above cutoff', () => {
      // HARYANA: cutoff=100000, below=60, above=120
      expect(calculateStampDuty('HARYANA', 100000)).toBe(135); // 15+60+60 (<=cutoff)
      expect(calculateStampDuty('HARYANA', 100001)).toBe(195); // 15+60+120 (>cutoff)
    });

    it('tiered — matches first tier or fallback rate', () => {
      // KERALA: tiers=[{1000000,2000},{2500000,5000}], fallbackRate=0.005
      expect(calculateStampDuty('KERALA', 1000000)).toBe(3025); // 25+1000+2000
      expect(calculateStampDuty('KERALA', 2500000)).toBe(6025); // 25+1000+5000
      expect(calculateStampDuty('KERALA', 5000000)).toBe(26025); // 25+1000+5000000*0.005=25000 → 26025
    });
  });

  describe('edge cases', () => {
    it('unknown state returns defaultStampDuty', () => {
      expect(calculateStampDuty('UNKNOWN STATE', 1000000)).toBe(1500);
    });

    it('zero capital', () => {
      // TELANGANA: percentage rate on 0 = 0, but min=1000 kicks in
      expect(calculateStampDuty('TELANGANA', 0)).toBe(1520); // 20+500+1000(min)
      // GOA: slab with 0 → ceil(0/500000)=0 slabs → 50+150+0=200
      expect(calculateStampDuty('GOA', 0)).toBe(200);
    });

    it('maxTotal cap applied', () => {
      // BIHAR: maxTotal=500000
      expect(calculateStampDuty('BIHAR', 1000000000)).toBe(500000);
    });
  });
});

describe('calculateIncorporationCost', () => {
  it('returns correct structure', () => {
    const result = calculateIncorporationCost('TELANGANA');
    expect(result.companyType).toBe('PRIVATE_LIMITED');
    expect(result.items).toHaveLength(3);
    expect(result.items[0]!.id).toBe('government');
    expect(result.items[0]!.children).toHaveLength(3);
    expect(result.items[1]!.id).toBe('dsc');
    expect(result.items[2]!.id).toBe('service');
    expect(result.metadata).toEqual({ authorizedCapital: 1000000, directorCount: 2 });
  });

  it('uses defaults when no args', () => {
    const result = calculateIncorporationCost();
    expect(result.totalAmount).toBe(1000 + 143 + 1500 + 4500 + 3000); // defaultStampDuty since no state
    expect(result.metadata).toEqual({ authorizedCapital: 1000000, directorCount: 2 });
  });

  it('clamps directorCount to [1, 100]', () => {
    const r1 = calculateIncorporationCost('SIKKIM', 0);
    expect(r1.metadata!.directorCount).toBe(1);
    const r2 = calculateIncorporationCost('SIKKIM', 200);
    expect(r2.metadata!.directorCount).toBe(100);
  });

  it('golden fixture — all 37 states at default capital', () => {
    const states = getAvailableStates();
    expect(states).toHaveLength(37);
    for (const state of states) {
      const result = calculateIncorporationCost(state);
      const expected = (expectedCosts as Record<string, { totalAmount: number; stampDuty: number }>)[state];
      expect(expected).toBeDefined();
      expect(result.totalAmount).toBe(expected!.totalAmount);
      expect(result.items[0]!.children![2]!.amount).toBe(expected!.stampDuty);
    }
  });
});

describe('getAvailableStates', () => {
  it('returns 37 states', () => {
    expect(getAvailableStates()).toHaveLength(37);
  });

  it('includes known states', () => {
    const states = getAvailableStates();
    expect(states).toContain('TELANGANA');
    expect(states).toContain('DELHI');
    expect(states).toContain('SIKKIM');
  });
});

describe('toDisplayName', () => {
  it('converts ALL CAPS to Title Case', () => {
    expect(toDisplayName('ANDHRA PRADESH')).toBe('Andhra Pradesh');
    expect(toDisplayName('JAMMU AND KASHMIR')).toBe('Jammu And Kashmir');
    expect(toDisplayName('DADRA & NAGAR HAVELI')).toBe('Dadra & Nagar Haveli');
  });
});

describe('calculateLlpStampDuty', () => {
  it('returns ₹500 for contribution up to ₹1,00,000', () => {
    expect(calculateLlpStampDuty(50000)).toBe(500);
    expect(calculateLlpStampDuty(100000)).toBe(500);
  });

  it('returns ₹2,000 for contribution ₹1L to ₹5L', () => {
    expect(calculateLlpStampDuty(100001)).toBe(2000);
    expect(calculateLlpStampDuty(300000)).toBe(2000);
    expect(calculateLlpStampDuty(500000)).toBe(2000);
  });

  it('returns ₹4,000 for contribution ₹5L to ₹10L', () => {
    expect(calculateLlpStampDuty(500001)).toBe(4000);
    expect(calculateLlpStampDuty(750000)).toBe(4000);
    expect(calculateLlpStampDuty(1000000)).toBe(4000);
  });

  it('returns ₹5,000 for contribution above ₹10L', () => {
    expect(calculateLlpStampDuty(1000001)).toBe(5000);
    expect(calculateLlpStampDuty(5000000)).toBe(5000);
    expect(calculateLlpStampDuty(100000000)).toBe(5000);
  });
});

describe('calculateLlpCost', () => {
  it('returns correct structure', () => {
    const result = calculateLlpCost();
    expect(result.companyType).toBe('LLP');
    expect(result.items).toHaveLength(3);
    expect(result.items[0]!.id).toBe('government');
    expect(result.items[0]!.children).toHaveLength(3);
    expect(result.items[1]!.id).toBe('dsc');
    expect(result.items[2]!.id).toBe('service');
    expect(result.metadata).toEqual({ authorizedCapital: 100000, directorCount: 2 });
  });

  it('uses defaults when no args (2 partners, ₹1L contribution)', () => {
    const result = calculateLlpCost();
    // govt: 200 + 143 + 500 = 843
    // dsc: 2250 * 2 = 4500
    // service: 10000
    expect(result.totalAmount).toBe(843 + 4500 + 10000);
  });

  it('scales DSC fee with partner count', () => {
    const r2 = calculateLlpCost(2);
    const r3 = calculateLlpCost(3);
    expect(r3.totalAmount - r2.totalAmount).toBe(2250);
  });

  it('stamp duty changes with contribution amount', () => {
    const r1 = calculateLlpCost(2, 100000);   // stamp: 500
    const r2 = calculateLlpCost(2, 500000);   // stamp: 2000
    const r3 = calculateLlpCost(2, 1000000);  // stamp: 4000
    const r4 = calculateLlpCost(2, 5000000);  // stamp: 5000

    expect(r1.items[0]!.children![2]!.amount).toBe(500);
    expect(r2.items[0]!.children![2]!.amount).toBe(2000);
    expect(r3.items[0]!.children![2]!.amount).toBe(4000);
    expect(r4.items[0]!.children![2]!.amount).toBe(5000);
  });

  it('clamps partnerCount to [1, 100]', () => {
    const r1 = calculateLlpCost(0);
    expect(r1.metadata!.directorCount).toBe(1);
    const r2 = calculateLlpCost(200);
    expect(r2.metadata!.directorCount).toBe(100);
  });

  it('name filing fee is ₹200 (not ₹1000 like company)', () => {
    const result = calculateLlpCost();
    expect(result.items[0]!.children![0]!.amount).toBe(200);
  });

  it('service fee is ₹10,000', () => {
    const result = calculateLlpCost();
    expect(result.items[2]!.amount).toBe(10000);
  });
});
