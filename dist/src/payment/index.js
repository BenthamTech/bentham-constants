"use strict";
/**
 * Payment-related enums shared between bentham-app and bentham-payment-api.
 * Provides a single source of truth for entity types, payment types, and providers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentStatus = exports.PaymentProvider = exports.PaymentType = exports.PaymentEntityType = void 0;
/**
 * Entity types that can have payments associated with them.
 */
var PaymentEntityType;
(function (PaymentEntityType) {
    PaymentEntityType["TRADEMARK"] = "trademark";
    PaymentEntityType["INCORPORATION"] = "incorporation";
})(PaymentEntityType || (exports.PaymentEntityType = PaymentEntityType = {}));
/**
 * Payment type identifiers used for categorization and reconciliation.
 */
var PaymentType;
(function (PaymentType) {
    PaymentType["TRADEMARK_APPLICATION"] = "TRADEMARK_APPLICATION";
    PaymentType["COMPANY_INCORPORATION"] = "COMPANY_INCORPORATION";
})(PaymentType || (exports.PaymentType = PaymentType = {}));
/**
 * Supported payment gateway providers.
 */
var PaymentProvider;
(function (PaymentProvider) {
    PaymentProvider["BILLDESK"] = "billdesk";
    PaymentProvider["RAZORPAY"] = "razorpay";
})(PaymentProvider || (exports.PaymentProvider = PaymentProvider = {}));
/**
 * Normalized payment status returned by bentham-payment-api.
 * Maps provider-specific statuses to a canonical set.
 */
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["SUCCESS"] = "success";
    PaymentStatus["PENDING"] = "pending";
    PaymentStatus["FAILED"] = "failed";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
