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

function makeLogFn(level: 'debug' | 'info' | 'warn' | 'error') {
  return (msgOrCtx: string | Record<string, unknown>, msg?: string) => {
    if (typeof msgOrCtx === 'string') pinoInstance[level](buildLog(), msgOrCtx);
    else pinoInstance[level](buildLog(msgOrCtx), msg!);
  };
}

export const logger = {
  debug: makeLogFn('debug'),
  info: makeLogFn('info'),
  warn: makeLogFn('warn'),
  error: makeLogFn('error'),
};
