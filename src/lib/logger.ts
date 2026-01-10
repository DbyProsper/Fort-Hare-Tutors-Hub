/**
 * Secure logging utility that only logs in development mode.
 * In production, only errors are logged (without sensitive data).
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /**
   * Log informational messages - only in development
   */
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log debug messages - only in development
   */
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },

  /**
   * Log warnings - only in development
   */
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Log errors - always logged but sanitized in production
   */
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error(...args);
    } else {
      // In production, log a sanitized version without sensitive data
      const sanitizedArgs = args.map(arg => {
        if (arg instanceof Error) {
          return arg.message;
        }
        if (typeof arg === 'string') {
          return arg;
        }
        return '[Object]';
      });
      console.error(...sanitizedArgs);
    }
  },

  /**
   * Log informational messages (alias for log)
   */
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
};

export default logger;
