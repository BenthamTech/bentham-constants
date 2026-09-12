"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const context_1 = require("./context");
const pinoInstance = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    formatters: {
        level(label) {
            return { level: label };
        },
    },
    base: null, // we inject our own base fields via context
}, process.stdout);
function buildLog(contextOverrides) {
    return { ...(0, context_1.getContext)(), ...contextOverrides };
}
function makeLogFn(level) {
    return (msgOrCtx, msg) => {
        if (typeof msgOrCtx === 'string')
            pinoInstance[level](buildLog(), msgOrCtx);
        else
            pinoInstance[level](buildLog(msgOrCtx), msg);
    };
}
exports.logger = {
    debug: makeLogFn('debug'),
    info: makeLogFn('info'),
    warn: makeLogFn('warn'),
    error: makeLogFn('error'),
};
