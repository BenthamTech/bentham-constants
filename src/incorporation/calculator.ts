import stampDutyConfig from './stamp-duty-config.json';
import pricingConfig from './pricing-config.json';
import llpPricingConfig from './llp-pricing-config.json';
import type { AoaFormula, FeeBreakdown, FeeItem, StateStampDutyEntry } from './types';

const states = stampDutyConfig as Record<string, StateStampDutyEntry>;

function calculateAoa(formula: AoaFormula, capital: number): number {
  switch (formula.type) {
    case 'fixed': return formula.amount;
    case 'zero': return 0;
    case 'percentage': {
      const raw = capital * formula.rate;
      return Math.max(formula.min ?? 0, Math.min(raw, formula.max ?? Infinity));
    }
    case 'slab': {
      const slabs = Math.ceil(capital / formula.slabSize);
      const aoa = slabs * formula.perSlab;
      return formula.max ? Math.min(aoa, formula.max) : aoa;
    }
    case 'threshold':
      return capital <= formula.cutoff ? formula.below : formula.above;
    case 'tiered': {
      for (const tier of formula.tiers) {
        if (capital <= tier.maxCapital) return tier.amount;
      }
      return capital * formula.fallbackRate;
    }
  }
}

export function calculateStampDuty(state: string, authorizedCapital: number): number {
  const config = states[state];
  if (!config) return pricingConfig.defaultStampDuty;

  const total = config.inc + config.moa + calculateAoa(config.aoa, authorizedCapital);
  const result = config.maxTotal ? Math.min(total, config.maxTotal) : total;

  if (typeof result !== 'number' || result < 0 || !isFinite(result)) {
    return pricingConfig.defaultStampDuty;
  }
  return result;
}

export function calculateIncorporationCost(
  state?: string,
  directorCount = pricingConfig.defaultDirectorCount,
  authorizedCapital = pricingConfig.defaultAuthorizedCapital
): FeeBreakdown {
  const validDirectors = Math.min(Math.max(1, directorCount), 100);
  const stampDuty = state ? calculateStampDuty(state, authorizedCapital) : pricingConfig.defaultStampDuty;

  const governmentChildren: FeeItem[] = [
    { id: 'name-filing', label: 'Name Filing Fee', amount: pricingConfig.nameFilingFee },
    { id: 'pan-tan', label: 'PAN + TAN Fee', amount: pricingConfig.panTanCharges },
    { id: 'stamp-duty', label: state ? `Stamp Duty (${state})` : 'Stamp Duty', amount: stampDuty },
  ];
  const governmentFee = governmentChildren.reduce((sum, item) => sum + item.amount, 0);

  const dscFee = pricingConfig.dscFeePerDirector * validDirectors;

  const items: FeeItem[] = [
    { id: 'government', label: 'Government Fee', amount: governmentFee, children: governmentChildren },
    { id: 'dsc', label: `DSC Fee (₹${pricingConfig.dscFeePerDirector.toLocaleString('en-IN')} × ${validDirectors} director${validDirectors > 1 ? 's' : ''})`, amount: dscFee },
    { id: 'service', label: 'Service Fee (incl. CA/CS)', amount: pricingConfig.serviceFee },
  ];

  return {
    items,
    totalAmount: governmentFee + dscFee + pricingConfig.serviceFee,
    metadata: { authorizedCapital, directorCount: validDirectors },
  };
}

export function getAvailableStates(): string[] {
  return Object.keys(states);
}

export function calculateLlpStampDuty(contribution: number): number {
  const formula = llpPricingConfig.stampDuty as AoaFormula;
  return calculateAoa(formula, contribution);
}

export function calculateLlpCost(
  partnerCount = llpPricingConfig.defaultPartnerCount,
  contribution = llpPricingConfig.defaultContribution
): FeeBreakdown {
  const validPartners = Math.min(Math.max(1, partnerCount), 100);
  const stampDuty = calculateLlpStampDuty(contribution);

  const governmentChildren: FeeItem[] = [
    { id: 'name-filing', label: 'Name Filing Fee (RUN-LLP)', amount: llpPricingConfig.nameFilingFee },
    { id: 'pan-tan', label: 'PAN + TAN Fee', amount: llpPricingConfig.panTanCharges },
    { id: 'stamp-duty', label: 'Stamp Duty (contribution-based)', amount: stampDuty },
  ];
  const governmentFee = governmentChildren.reduce((sum, item) => sum + item.amount, 0);

  const dscFee = llpPricingConfig.dscFeePerDirector * validPartners;

  const items: FeeItem[] = [
    { id: 'government', label: 'Government Fee', amount: governmentFee, children: governmentChildren },
    { id: 'dsc', label: `DSC Fee (₹${llpPricingConfig.dscFeePerDirector.toLocaleString('en-IN')} × ${validPartners} partner${validPartners > 1 ? 's' : ''})`, amount: dscFee },
    { id: 'service', label: 'Service Fee (incl. CA/CS)', amount: llpPricingConfig.serviceFee },
  ];

  return {
    items,
    totalAmount: governmentFee + dscFee + llpPricingConfig.serviceFee,
    metadata: { authorizedCapital: contribution, directorCount: validPartners },
  };
}

export function toDisplayName(state: string): string {
  return state.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
