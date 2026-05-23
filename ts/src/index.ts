// --- Common ---
import states from '../../data/common/states.json';
import entityTypes from '../../data/common/entity-types.json';

// --- Incorporation ---
import companyStatuses from '../../data/incorporation/company-statuses.json';
import documentKeys from '../../data/incorporation/document-keys.json';
import directorDesignations from '../../data/incorporation/director-designations.json';
import mcaDefaults from '../../data/incorporation/mca-defaults.json';

// --- Trademark ---
import trademarkStatuses from '../../data/trademark/trademark-statuses.json';

// Common
export const STATES = states as Record<string, string>;
export const STATE_KEYS = Object.keys(states) as string[];
export const STATE_DISPLAY_NAMES = Object.values(states) as string[];
export type EntityType = keyof typeof entityTypes;
export const ENTITY_TYPES = entityTypes as Record<string, string>;

// Incorporation
export type CompanyStatus = keyof typeof companyStatuses;
export const COMPANY_STATUSES = companyStatuses as Record<string, string>;
export const DOCUMENT_KEYS = documentKeys;
export type DirectorDesignation = keyof typeof directorDesignations;
export const DIRECTOR_DESIGNATIONS = directorDesignations as Record<string, string>;
export const MCA_DEFAULTS = mcaDefaults;

// Trademark
export type TrademarkStatus = keyof typeof trademarkStatuses;
export const TRADEMARK_STATUSES = trademarkStatuses as Record<string, string>;
