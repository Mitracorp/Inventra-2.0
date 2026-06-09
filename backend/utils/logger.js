const util = require('util');
const { createWriteStream } = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', 'logs', 'app.log');
// Ensure logs directory exists (best-effort)
try {
  require('fs').mkdirSync(path.dirname(logFile), { recursive: true });
} catch (e) {
  // ignore
}

const stream = createWriteStream(logFile, { flags: 'a' });

function write(level, args) {
  const message = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${args.map(a => (typeof a === 'string' ? a : util.inspect(a))).join(' ')}\n`;
  try { stream.write(message); } catch (e) { /* ignore */ }
  // Also print to console for developer visibility
  if (level === 'error') console.error(message);
  else if (level === 'warn') console.warn(message);
  else console.log(message);
}

module.exports = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
  debug: (...args) => write('debug', args),
};
