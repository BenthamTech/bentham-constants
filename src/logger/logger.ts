import pino from 'pino';
import { getContext } from './context';

const pinoInstance = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: null, // we inject our own base fields via context
});

function buildLog(contextOverrides?: Record<string, unknown>) {
  return { ...getContext(), ...contextOverrides };
}

export const logger = {
  debug(msgOrCtx: string | Record<string, unknown>, msg?: string) {
    if (typeof msgOrCtx === 'string') {
      pinoInstance.debug(buildLog(), msgOrCtx);
    } else {
      pinoInstance.debug(buildLog(msgOrCtx), msg!);
    }
  },
  info(msgOrCtx: string | Record<string, unknown>, msg?: string) {
    if (typeof msgOrCtx === 'string') {
      pinoInstance.info(buildLog(), msgOrCtx);
    } else {
      pinoInstance.info(buildLog(msgOrCtx), msg!);
    }
  },
  warn(msgOrCtx: string | Record<string, unknown>, msg?: string) {
    if (typeof msgOrCtx === 'string') {
      pinoInstance.warn(buildLog(), msgOrCtx);
    } else {
      pinoInstance.warn(buildLog(msgOrCtx), msg!);
    }
  },
  error(msgOrCtx: string | Record<string, unknown>, msg?: string) {
    if (typeof msgOrCtx === 'string') {
      pinoInstance.error(buildLog(), msgOrCtx);
    } else {
      pinoInstance.error(buildLog(msgOrCtx), msg!);
    }
  },
};
