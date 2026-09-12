"use strict";
/**
 * Company type constants.
 * Shared between bentham-app (UI rendering, form selection) and
 * bentham-mca-api (filing logic, fee enquiry).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPANY_TYPE_CONFIG = exports.CompanyType = void 0;
var CompanyType;
(function (CompanyType) {
    CompanyType["PRIVATE_LIMITED"] = "PRIVATE_LIMITED";
    CompanyType["LLP"] = "LLP";
})(CompanyType || (exports.CompanyType = CompanyType = {}));
exports.COMPANY_TYPE_CONFIG = {
    [CompanyType.PRIVATE_LIMITED]: {
        label: 'Private Limited Company',
        suffix: 'PRIVATE LIMITED',
        description: 'Best for startups planning to raise funding. Limited liability, 2-200 shareholders.',
    },
    [CompanyType.LLP]: {
        label: 'Limited Liability Partnership',
        suffix: 'LLP',
        description: 'Best for professional services and small businesses. Lower compliance, no audit below ₹40L turnover.',
    },
};
