import { calculateStampDuty, calculateIncorporationCost, getAvailableStates, toDisplayName } from '../../src/incorporation';
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
    expect(result.items).toHaveLength(3);
    expect(result.items[0]!.id).toBe('government');
    expect(result.items[0]!.children).toHaveLength(3);
    expect(result.items[1]!.id).toBe('dsc');
    expect(result.items[2]!.id).toBe('service');
    expect(result.metadata).toEqual({ authorizedCapital: 1000000, directorCount: 2 });
  });

  it('uses defaults when no args', () => {
    const result = calculateIncorporationCost();
    expect(result.totalAmount).toBe(1000 + 143 + 1500 + 4000 + 5000); // defaultStampDuty since no state
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
