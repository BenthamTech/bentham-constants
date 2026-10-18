import stampDutyConfig from './stamp-duty-config.json';
import pricingConfig from './pricing-config.json';
import llpPricingConfig from './llp-pricing-config.json';
import { CompanyType } from './company-types';
import type { AoaFormula, FeeBreakdown, FeeItem, IncorporationCostInput, LlpCostInput, StateStampDutyEntry } from './types';
import { FEE_ITEM_ID } from './types';

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

/** Number of DSC fees waived: a whole number from 0 up to the people being charged for. */
function clampWaivedDscCount(waivedDscCount: number, count: number): number {
  if (!Number.isFinite(waivedDscCount)) return 0;
  return Math.min(Math.max(0, Math.floor(waivedDscCount)), count);
}

function dscFeeItem(feePerPerson: number, count: number, waived: number, noun: 'director' | 'partner'): FeeItem {
  const charged = count - waived;
  const base = `₹${feePerPerson.toLocaleString('en-IN')} × ${charged} ${noun}${charged === 1 ? '' : 's'}`;
  const waiver = waived > 0 ? `; ${waived} already ${waived === 1 ? 'has' : 'have'} a DSC` : '';
  return { id: FEE_ITEM_ID.DSC, label: `DSC Fee (${base}${waiver})`, amount: feePerPerson * charged };
}

export function calculateIncorporationCost({
  state,
  directorCount = pricingConfig.defaultDirectorCount,
  authorizedCapital = pricingConfig.defaultAuthorizedCapital,
  waivedDscCount,
}: IncorporationCostInput): FeeBreakdown {
  const validDirectors = Math.min(Math.max(1, directorCount), 100);
  const waived = clampWaivedDscCount(waivedDscCount, validDirectors);
  const stampDuty = state ? calculateStampDuty(state, authorizedCapital) : pricingConfig.defaultStampDuty;

  const governmentChildren: FeeItem[] = [
    { id: 'name-filing', label: 'Name Filing Fee', amount: pricingConfig.nameFilingFee },
    { id: 'pan-tan', label: 'PAN + TAN Fee', amount: pricingConfig.panTanCharges },
    { id: 'stamp-duty', label: state ? `Stamp Duty (${state})` : 'Stamp Duty', amount: stampDuty },
  ];
  const governmentFee = governmentChildren.reduce((sum, item) => sum + item.amount, 0);

  const dsc = dscFeeItem(pricingConfig.dscFeePerDirector, validDirectors, waived, 'director');

  const items: FeeItem[] = [
    { id: FEE_ITEM_ID.GOVERNMENT, label: 'Government Fee', amount: governmentFee, children: governmentChildren },
    dsc,
    { id: FEE_ITEM_ID.SERVICE, label: 'Service Fee (incl. CA/CS)', amount: pricingConfig.serviceFee },
  ];

  return {
    companyType: CompanyType.PRIVATE_LIMITED,
    items,
    totalAmount: governmentFee + dsc.amount + pricingConfig.serviceFee,
    metadata: { authorizedCapital, directorCount: validDirectors, waivedDscCount: waived },
  };
}

export function getAvailableStates(): string[] {
  return Object.keys(states);
}

export function calculateLlpStampDuty(contribution: number): number {
  const formula = llpPricingConfig.stampDuty as AoaFormula;
  return calculateAoa(formula, contribution);
}

export function calculateLlpCost({
  partnerCount = llpPricingConfig.defaultPartnerCount,
  contribution = llpPricingConfig.defaultContribution,
  waivedDscCount,
}: LlpCostInput): FeeBreakdown {
  const validPartners = Math.min(Math.max(1, partnerCount), 100);
  const waived = clampWaivedDscCount(waivedDscCount, validPartners);
  const stampDuty = calculateLlpStampDuty(contribution);

  const governmentChildren: FeeItem[] = [
    { id: 'name-filing', label: 'Name Filing Fee (RUN-LLP)', amount: llpPricingConfig.nameFilingFee },
    { id: 'pan-tan', label: 'PAN + TAN Fee', amount: llpPricingConfig.panTanCharges },
    { id: 'stamp-duty', label: `Stamp Duty (₹${contribution.toLocaleString('en-IN')} contribution)`, amount: stampDuty },
  ];
  const governmentFee = governmentChildren.reduce((sum, item) => sum + item.amount, 0);

  const dsc = dscFeeItem(llpPricingConfig.dscFeePerDirector, validPartners, waived, 'partner');

  const items: FeeItem[] = [
    { id: FEE_ITEM_ID.GOVERNMENT, label: 'Government Fee', amount: governmentFee, children: governmentChildren },
    dsc,
    { id: FEE_ITEM_ID.SERVICE, label: 'Service Fee (incl. CA/CS)', amount: llpPricingConfig.serviceFee },
  ];

  return {
    companyType: CompanyType.LLP,
    items,
    totalAmount: governmentFee + dsc.amount + llpPricingConfig.serviceFee,
    metadata: { authorizedCapital: contribution, directorCount: validPartners, waivedDscCount: waived },
  };
}

export function toDisplayName(state: string): string {
  return state.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
