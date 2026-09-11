/**
 * Application status tabs — the shared, API-facing vocabulary for grouping company
 * application entries by their current status. Used by the services that produce and
 * consume the application status API.
 */

/** Friendly, API-facing tab names. */
export const ApplicationStatusTab = {
  PENDING_FOR_ACTION: 'pending_for_action',
  UNDER_PROCESSING: 'under_processing',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  PAYMENT_STATUS: 'payment_status',
  CERTIFICATES: 'certificates',
  CHALLANS: 'challans',
  NOTICES: 'notices',
} as const;

export type ApplicationStatusTabType =
  (typeof ApplicationStatusTab)[keyof typeof ApplicationStatusTab];

/** All tab names, in display order. */
export const APPLICATION_STATUS_TABS = Object.values(
  ApplicationStatusTab,
) as ApplicationStatusTabType[];
