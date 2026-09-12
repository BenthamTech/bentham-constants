"use strict";
/**
 * Application status tabs — the shared, API-facing vocabulary for grouping company
 * application entries by their current status. Used by the services that produce and
 * consume the application status API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPLICATION_STATUS_TABS = exports.ApplicationStatusTab = void 0;
/** Friendly, API-facing tab names. */
exports.ApplicationStatusTab = {
    PENDING_FOR_ACTION: 'pending_for_action',
    UNDER_PROCESSING: 'under_processing',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
    PAYMENT_STATUS: 'payment_status',
    CERTIFICATES: 'certificates',
    CHALLANS: 'challans',
    NOTICES: 'notices',
};
/** All tab names, in display order. */
exports.APPLICATION_STATUS_TABS = Object.values(exports.ApplicationStatusTab);
