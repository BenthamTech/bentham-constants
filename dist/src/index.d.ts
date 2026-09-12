import entityTypes from '../data/common/entity-types.json';
import companyStatuses from '../data/incorporation/company-statuses.json';
import directorDesignations from '../data/incorporation/director-designations.json';
import type { FeeEnquiryEntityType } from './incorporation/fee-enquiry-types';
import trademarkStatuses from '../data/trademark/trademark-statuses.json';
export type EntityType = keyof typeof entityTypes;
export declare const ENTITY_TYPES: Record<string, string>;
export declare const INCORPORATION_STATES: string[];
export type CompanyStatus = keyof typeof companyStatuses;
export declare const COMPANY_STATUSES: Record<string, string>;
export declare const DOCUMENT_KEYS: {
    company: {
        OFFICE_ADDRESS_PROOF: string;
        OFFICE_ADDRESS_GEOTAGGED_PHOTO: string;
        NOC: string;
        SPECIMEN_DOC: string;
        SPICE_A_CLARIFICATION: string;
    };
    director: {
        ADDRESS_PROOF: string;
        PAN_CARD: string;
        AADHAAR_CARD: string;
        PASSPORT_SIZE_IMAGE: string;
    };
};
export type DirectorDesignation = keyof typeof directorDesignations;
export declare const DIRECTOR_DESIGNATIONS: Record<string, string>;
export declare const MCA_DEFAULTS: {
    COMPANY_TYPE: string;
    COMPANY_CLASS: string;
    COMPANY_CATEGORY: string;
    COMPANY_SUB_CATEGORY: string;
};
export type FeeEnquiryOptions = Record<FeeEnquiryEntityType, Record<string, string[]>>;
export declare const FEE_ENQUIRY_OPTIONS: FeeEnquiryOptions;
export type TrademarkStatus = keyof typeof trademarkStatuses;
export declare const TRADEMARK_STATUSES: Record<string, string>;
export declare const TRADEMARK_STATE_DISTRICTS: Record<string, string[]>;
export declare const TRADEMARK_STATES: string[];
