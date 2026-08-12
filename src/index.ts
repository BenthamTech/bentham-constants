// --- Common ---
import entityTypes from '../data/common/entity-types.json';

// --- Incorporation ---
import incorporationStates from '../data/incorporation/states.json';
import companyStatuses from '../data/incorporation/company-statuses.json';
import documentKeys from '../data/incorporation/document-keys.json';
import directorDesignations from '../data/incorporation/director-designations.json';
import mcaDefaults from '../data/incorporation/mca-defaults.json';
import feeEnquiryOptions from '../data/incorporation/fee-enquiry-options.json';
import type { FeeEnquiryEntityType } from './incorporation/fee-enquiry-types';

// --- Trademark ---
import trademarkStatuses from '../data/trademark/trademark-statuses.json';
import stateDistricts from '../data/trademark/state-districts.json';

// Common
export type EntityType = keyof typeof entityTypes;
export const ENTITY_TYPES = entityTypes as Record<string, string>;

// Incorporation
export const INCORPORATION_STATES = incorporationStates as string[];
export type CompanyStatus = keyof typeof companyStatuses;
export const COMPANY_STATUSES = companyStatuses as Record<string, string>;
export const DOCUMENT_KEYS = documentKeys;
export type DirectorDesignation = keyof typeof directorDesignations;
export const DIRECTOR_DESIGNATIONS = directorDesignations as Record<string, string>;
export const MCA_DEFAULTS = mcaDefaults;
export type FeeEnquiryOptions = Record<FeeEnquiryEntityType, Record<string, string[]>>;
export const FEE_ENQUIRY_OPTIONS: FeeEnquiryOptions = feeEnquiryOptions;

// Trademark
export type TrademarkStatus = keyof typeof trademarkStatuses;
export const TRADEMARK_STATUSES = trademarkStatuses as Record<string, string>;
export const TRADEMARK_STATE_DISTRICTS = stateDistricts as Record<string, string[]>;
export const TRADEMARK_STATES = Object.keys(stateDistricts) as string[];
