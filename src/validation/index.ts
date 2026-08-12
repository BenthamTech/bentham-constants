/** PAN: 5 uppercase letters + 4 digits + 1 uppercase letter */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Indian mobile: 10 digits starting with 6-9 */
export const MOBILE_REGEX = /^[6-9][0-9]{9}$/;

/** Indian PIN code: 6 digits, first digit 1-9 */
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

/** DIN (Director Identification Number): exactly 8 digits */
export const DIN_REGEX = /^[0-9]{8}$/;

/** Basic email format validation */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** MCA application reference ID: digits-digits */
export const REF_ID_REGEX = /^\d+-\d+$/;
