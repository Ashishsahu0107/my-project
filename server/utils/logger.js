const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  info: '\x1b[36m',    // cyan
  success: '\x1b[32m', // green
  warn: '\x1b[33m',    // yellow
  error: '\x1b[31m',   // red
};

const timestamp = () => new Date().toISOString();

export const logger = {
  info: (msg, ...args) => {
    console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.info}ℹ INFO:${colors.reset} ${msg}`, ...args);
  },
  success: (msg, ...args) => {
    console.log(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.success}✓ SUCCESS:${colors.reset} ${msg}`, ...args);
  },
  warn: (msg, ...args) => {
    console.warn(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.warn}⚠ WARN:${colors.reset} ${msg}`, ...args);
  },
  error: (msg, ...args) => {
    console.error(`${colors.dim}[${timestamp()}]${colors.reset} ${colors.error}✖ ERROR:${colors.reset} ${msg}`, ...args);
  },
  debug: (msg, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${colors.dim}[${timestamp()}] [DEBUG] ${msg}${colors.reset}`, ...args);
    }
  }
};
