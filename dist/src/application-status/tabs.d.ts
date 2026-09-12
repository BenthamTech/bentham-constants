/**
 * Application status tabs — the shared, API-facing vocabulary for grouping company
 * application entries by their current status. Used by the services that produce and
 * consume the application status API.
 */
/** Friendly, API-facing tab names. */
export declare const ApplicationStatusTab: {
    readonly PENDING_FOR_ACTION: "pending_for_action";
    readonly UNDER_PROCESSING: "under_processing";
    readonly APPROVED: "approved";
    readonly REJECTED: "rejected";
    readonly CANCELLED: "cancelled";
    readonly PAYMENT_STATUS: "payment_status";
    readonly CERTIFICATES: "certificates";
    readonly CHALLANS: "challans";
    readonly NOTICES: "notices";
};
export type ApplicationStatusTabType = (typeof ApplicationStatusTab)[keyof typeof ApplicationStatusTab];
/** All tab names, in display order. */
export declare const APPLICATION_STATUS_TABS: ApplicationStatusTabType[];
