"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVICE_FEE_CEILING = void 0;
const incorporation_1 = require("../incorporation");
const trademark_1 = require("../trademark");
/**
 * Maximum discountable service fee per entity type.
 * Used by coupon validation to cap discount amounts.
 */
exports.SERVICE_FEE_CEILING = {
    incorporation: incorporation_1.pricingConfig.serviceFee,
    trademark: trademark_1.trademarkPricingConfig.benthamFeePerClass,
};
