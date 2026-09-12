"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOTAL_PER_CLASS = exports.trademarkPricingConfig = void 0;
exports.calculateBenthamFee = calculateBenthamFee;
exports.calculateGovernmentFee = calculateGovernmentFee;
exports.calculateStampPaperFee = calculateStampPaperFee;
exports.calculateTrademarkCost = calculateTrademarkCost;
const pricing_config_json_1 = __importDefault(require("./pricing-config.json"));
exports.trademarkPricingConfig = pricing_config_json_1.default;
/** Total cost per trademark class (government + stamp paper + Bentham fee) */
exports.TOTAL_PER_CLASS = pricing_config_json_1.default.governmentFeePerClass +
    pricing_config_json_1.default.stampPaperPerClass +
    pricing_config_json_1.default.benthamFeePerClass;
/** Calculate Bentham platform fee for N trademark classes */
function calculateBenthamFee(numberOfClasses) {
    const classes = Math.max(1, numberOfClasses);
    return pricing_config_json_1.default.benthamFeePerClass * classes;
}
/** Calculate government fee for N trademark classes */
function calculateGovernmentFee(numberOfClasses) {
    const classes = Math.max(1, numberOfClasses);
    return pricing_config_json_1.default.governmentFeePerClass * classes;
}
/** Calculate stamp paper fee for N trademark classes */
function calculateStampPaperFee(numberOfClasses) {
    const classes = Math.max(1, numberOfClasses);
    return pricing_config_json_1.default.stampPaperPerClass * classes;
}
/** Calculate full cost breakdown for N trademark classes */
function calculateTrademarkCost(numberOfClasses) {
    const classes = Math.max(1, numberOfClasses);
    const governmentFee = calculateGovernmentFee(classes);
    const stampPaper = calculateStampPaperFee(classes);
    const benthamFee = calculateBenthamFee(classes);
    return {
        governmentFee,
        stampPaper,
        benthamFee,
        total: governmentFee + stampPaper + benthamFee,
        numberOfClasses: classes,
    };
}
