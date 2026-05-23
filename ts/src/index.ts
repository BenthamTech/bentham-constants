import states from '../../data/states.json';
import companyStatuses from '../../data/company-statuses.json';
import trademarkStatuses from '../../data/trademark-statuses.json';
import documentKeys from '../../data/document-keys.json';
import directorDesignations from '../../data/director-designations.json';
import entityTypes from '../../data/entity-types.json';
import mcaDefaults from '../../data/mca-defaults.json';

// --- States ---
export const STATES = states as Record<string, string>;
export const STATE_KEYS = Object.keys(states) as string[];
export const STATE_DISPLAY_NAMES = Object.values(states) as string[];

// --- Company Statuses ---
export type CompanyStatus = keyof typeof companyStatuses;
export const COMPANY_STATUSES = companyStatuses as Record<string, string>;

// --- Trademark Statuses ---
export type TrademarkStatus = keyof typeof trademarkStatuses;
export const TRADEMARK_STATUSES = trademarkStatuses as Record<string, string>;

// --- Document Keys ---
export const DOCUMENT_KEYS = documentKeys;

// --- Director Designations ---
export type DirectorDesignation = keyof typeof directorDesignations;
export const DIRECTOR_DESIGNATIONS = directorDesignations as Record<string, string>;

// --- Entity Types ---
export type EntityType = keyof typeof entityTypes;
export const ENTITY_TYPES = entityTypes as Record<string, string>;

// --- MCA Defaults ---
export const MCA_DEFAULTS = mcaDefaults;
