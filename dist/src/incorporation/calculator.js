"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateStampDuty = calculateStampDuty;
exports.calculateIncorporationCost = calculateIncorporationCost;
exports.getAvailableStates = getAvailableStates;
exports.calculateLlpStampDuty = calculateLlpStampDuty;
exports.calculateLlpCost = calculateLlpCost;
exports.toDisplayName = toDisplayName;
const stamp_duty_config_json_1 = __importDefault(require("./stamp-duty-config.json"));
const pricing_config_json_1 = __importDefault(require("./pricing-config.json"));
const llp_pricing_config_json_1 = __importDefault(require("./llp-pricing-config.json"));
const company_types_1 = require("./company-types");
const states = stamp_duty_config_json_1.default;
function calculateAoa(formula, capital) {
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
                if (capital <= tier.maxCapital)
                    return tier.amount;
            }
            return capital * formula.fallbackRate;
        }
    }
}
function calculateStampDuty(state, authorizedCapital) {
    const config = states[state];
    if (!config)
        return pricing_config_json_1.default.defaultStampDuty;
    const total = config.inc + config.moa + calculateAoa(config.aoa, authorizedCapital);
    const result = config.maxTotal ? Math.min(total, config.maxTotal) : total;
    if (typeof result !== 'number' || result < 0 || !isFinite(result)) {
        return pricing_config_json_1.default.defaultStampDuty;
    }
    return result;
}
function calculateIncorporationCost(state, directorCount = pricing_config_json_1.default.defaultDirectorCount, authorizedCapital = pricing_config_json_1.default.defaultAuthorizedCapital) {
    const validDirectors = Math.min(Math.max(1, directorCount), 100);
    const stampDuty = state ? calculateStampDuty(state, authorizedCapital) : pricing_config_json_1.default.defaultStampDuty;
    const governmentChildren = [
        { id: 'name-filing', label: 'Name Filing Fee', amount: pricing_config_json_1.default.nameFilingFee },
        { id: 'pan-tan', label: 'PAN + TAN Fee', amount: pricing_config_json_1.default.panTanCharges },
        { id: 'stamp-duty', label: state ? `Stamp Duty (${state})` : 'Stamp Duty', amount: stampDuty },
    ];
    const governmentFee = governmentChildren.reduce((sum, item) => sum + item.amount, 0);
    const dscFee = pricing_config_json_1.default.dscFeePerDirector * validDirectors;
    const items = [
        { id: 'government', label: 'Government Fee', amount: governmentFee, children: governmentChildren },
        { id: 'dsc', label: `DSC Fee (₹${pricing_config_json_1.default.dscFeePerDirector.toLocaleString('en-IN')} × ${validDirectors} director${validDirectors > 1 ? 's' : ''})`, amount: dscFee },
        { id: 'service', label: 'Service Fee (incl. CA/CS)', amount: pricing_config_json_1.default.serviceFee },
    ];
    return {
        companyType: company_types_1.CompanyType.PRIVATE_LIMITED,
        items,
        totalAmount: governmentFee + dscFee + pricing_config_json_1.default.serviceFee,
        metadata: { authorizedCapital, directorCount: validDirectors },
    };
}
function getAvailableStates() {
    return Object.keys(states);
}
function calculateLlpStampDuty(contribution) {
    const formula = llp_pricing_config_json_1.default.stampDuty;
    return calculateAoa(formula, contribution);
}
function calculateLlpCost(partnerCount = llp_pricing_config_json_1.default.defaultPartnerCount, contribution = llp_pricing_config_json_1.default.defaultContribution) {
    const validPartners = Math.min(Math.max(1, partnerCount), 100);
    const stampDuty = calculateLlpStampDuty(contribution);
    const governmentChildren = [
        { id: 'name-filing', label: 'Name Filing Fee (RUN-LLP)', amount: llp_pricing_config_json_1.default.nameFilingFee },
        { id: 'pan-tan', label: 'PAN + TAN Fee', amount: llp_pricing_config_json_1.default.panTanCharges },
        { id: 'stamp-duty', label: `Stamp Duty (₹${contribution.toLocaleString('en-IN')} contribution)`, amount: stampDuty },
    ];
    const governmentFee = governmentChildren.reduce((sum, item) => sum + item.amount, 0);
    const dscFee = llp_pricing_config_json_1.default.dscFeePerDirector * validPartners;
    const items = [
        { id: 'government', label: 'Government Fee', amount: governmentFee, children: governmentChildren },
        { id: 'dsc', label: `DSC Fee (₹${llp_pricing_config_json_1.default.dscFeePerDirector.toLocaleString('en-IN')} × ${validPartners} partner${validPartners > 1 ? 's' : ''})`, amount: dscFee },
        { id: 'service', label: 'Service Fee (incl. CA/CS)', amount: llp_pricing_config_json_1.default.serviceFee },
    ];
    return {
        companyType: company_types_1.CompanyType.LLP,
        items,
        totalAmount: governmentFee + dscFee + llp_pricing_config_json_1.default.serviceFee,
        metadata: { authorizedCapital: contribution, directorCount: validPartners },
    };
}
function toDisplayName(state) {
    return state.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
