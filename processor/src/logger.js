const ts = () => new Date().toISOString();
const fmt = (level, args) => [`${ts()} [${level}] [WORKER]`, ...args];

export const log = {
  info: (...a) => console.log(...fmt('INFO', a)),
  warn: (...a) => console.warn(...fmt('WARN', a)),
  error: (...a) => console.error(...fmt('ERROR', a)),
  stage: (docId, stage, msg = '') => console.log(...fmt('STAGE', [`doc=${docId} stage=${stage} ${msg}`.trim()])),
};
