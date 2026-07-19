// Tiny structured console logger shared across the backend service.
const ts = () => new Date().toISOString();
const fmt = (level, tag, args) => [`${ts()} [${level}] [API]${tag ? ' ' + tag : ''}`, ...args];

export const log = {
  info: (...a) => console.log(...fmt('INFO', '', a)),
  warn: (...a) => console.warn(...fmt('WARN', '', a)),
  error: (...a) => console.error(...fmt('ERROR', '', a)),
};
