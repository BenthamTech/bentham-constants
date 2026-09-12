"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRADEMARK_STATES = exports.TRADEMARK_STATE_DISTRICTS = exports.TRADEMARK_STATUSES = exports.FEE_ENQUIRY_OPTIONS = exports.MCA_DEFAULTS = exports.DIRECTOR_DESIGNATIONS = exports.DOCUMENT_KEYS = exports.COMPANY_STATUSES = exports.INCORPORATION_STATES = exports.ENTITY_TYPES = void 0;
// --- Common ---
const entity_types_json_1 = __importDefault(require("../data/common/entity-types.json"));
// --- Incorporation ---
const states_json_1 = __importDefault(require("../data/incorporation/states.json"));
const company_statuses_json_1 = __importDefault(require("../data/incorporation/company-statuses.json"));
const document_keys_json_1 = __importDefault(require("../data/incorporation/document-keys.json"));
const director_designations_json_1 = __importDefault(require("../data/incorporation/director-designations.json"));
const mca_defaults_json_1 = __importDefault(require("../data/incorporation/mca-defaults.json"));
const fee_enquiry_options_json_1 = __importDefault(require("../data/incorporation/fee-enquiry-options.json"));
// --- Trademark ---
const trademark_statuses_json_1 = __importDefault(require("../data/trademark/trademark-statuses.json"));
const state_districts_json_1 = __importDefault(require("../data/trademark/state-districts.json"));
exports.ENTITY_TYPES = entity_types_json_1.default;
// Incorporation
exports.INCORPORATION_STATES = states_json_1.default;
exports.COMPANY_STATUSES = company_statuses_json_1.default;
exports.DOCUMENT_KEYS = document_keys_json_1.default;
exports.DIRECTOR_DESIGNATIONS = director_designations_json_1.default;
exports.MCA_DEFAULTS = mca_defaults_json_1.default;
exports.FEE_ENQUIRY_OPTIONS = fee_enquiry_options_json_1.default;
exports.TRADEMARK_STATUSES = trademark_statuses_json_1.default;
exports.TRADEMARK_STATE_DISTRICTS = state_districts_json_1.default;
exports.TRADEMARK_STATES = Object.keys(state_districts_json_1.default);
