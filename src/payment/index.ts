/**
 * Payment-related enums shared between bentham-app and bentham-payment-api.
 * Provides a single source of truth for entity types, payment types, and providers.
 */

/**
 * Entity types that can have payments associated with them.
 */
export enum PaymentEntityType {
  TRADEMARK = 'trademark',
  INCORPORATION = 'incorporation',
}

/**
 * Payment type identifiers used for categorization and reconciliation.
 */
export enum PaymentType {
  TRADEMARK_APPLICATION = 'TRADEMARK_APPLICATION',
  COMPANY_INCORPORATION = 'COMPANY_INCORPORATION',
}

/**
 * Supported payment gateway providers.
 */
export enum PaymentProvider {
  BILLDESK = 'billdesk',
  RAZORPAY = 'razorpay',
}

/**
 * Normalized payment status returned by bentham-payment-api.
 * Maps provider-specific statuses to a canonical set.
 */
export enum PaymentStatus {
  SUCCESS = 'success',
  PENDING = 'pending',
  FAILED = 'failed',
}
