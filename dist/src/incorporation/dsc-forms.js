"use strict";
/**
 * DSC (Digital Signature Certificate) form constants.
 * Shared between bentham-app (UI rendering, metadata persistence) and
 * bentham-mca-api (request validation, response values).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DscMcaUploadStatus = exports.DSC_FORM_NAMES = void 0;
/**
 * Valid form names for DSC upload to MCA portal.
 * Note: Spice+ Part A is excluded — it does not require DSC upload to MCA.
 */
exports.DSC_FORM_NAMES = [
    'SPICE + Part B',
    'INC-9',
    'INC-33',
    'INC-34',
    'AGILE PRO',
];
/** MCA upload status for each DSC form — used in metadata persistence and API responses. */
var DscMcaUploadStatus;
(function (DscMcaUploadStatus) {
    DscMcaUploadStatus["PENDING"] = "PENDING";
    DscMcaUploadStatus["UPLOADED"] = "UPLOADED";
    DscMcaUploadStatus["SKIPPED"] = "SKIPPED";
    DscMcaUploadStatus["FAILED"] = "FAILED";
})(DscMcaUploadStatus || (exports.DscMcaUploadStatus = DscMcaUploadStatus = {}));
