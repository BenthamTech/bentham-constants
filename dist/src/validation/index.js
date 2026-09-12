"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REF_ID_REGEX = exports.EMAIL_REGEX = exports.DIN_REGEX = exports.PINCODE_REGEX = exports.MOBILE_REGEX = exports.PAN_REGEX = void 0;
/** PAN: 5 uppercase letters + 4 digits + 1 uppercase letter */
exports.PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
/** Indian mobile: 10 digits starting with 6-9 */
exports.MOBILE_REGEX = /^[6-9][0-9]{9}$/;
/** Indian PIN code: 6 digits, first digit 1-9 */
exports.PINCODE_REGEX = /^[1-9][0-9]{5}$/;
/** DIN (Director Identification Number): exactly 8 digits */
exports.DIN_REGEX = /^[0-9]{8}$/;
/** Basic email format validation */
exports.EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** MCA application reference ID: digits-digits */
exports.REF_ID_REGEX = /^\d+-\d+$/;
