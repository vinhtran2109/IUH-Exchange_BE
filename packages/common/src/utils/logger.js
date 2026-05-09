import winston from 'winston';
import Transport from 'winston-transport';
import http from 'http';
import { createRequire } from 'module';

/**
 * Logstash HTTP transport - sends JSON logs to Logstash via HTTP input.
 * Extends winston-transport directly (not Stream) to avoid isStream() validation.
 */
class LogstashHttpTransport extends Transport {
  constructor(opts = {}) {
    super(opts);
    this.logstashUrl = opts.logstashUrl || process.env.LOGSTASH_URL || 'http://localhost:9600';
  }

  log(info, callback) {
    setImmediate(() => this.emit('logged', info));
    try {
      const body = JSON.stringify(info);
      const url = new URL(this.logstashUrl);
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: '/_bulk',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 3000,
      });
      req.on('error', () => {}); // Silent fail - don't crash app on log shipping failure
      req.write(body);
      req.end();
    } catch (e) { /* ignore parse errors */ }
    callback();
  }
}

/**
 * Logger thống nhất cho toàn bộ microservices.
 * Format: JSON structured logging (dễ parse cho ELK Stack).
 * 
 * Outputs:
 * - Console: human-readable with colors
 * - Logstash: JSON structured (when LOGSTASH_URL is set)
 */
// Bug #36 fix: Add file transport with rotation for production
const LOG_DIR = process.env.LOG_DIR || 'logs';
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE || '20m'; // 20MB per file
const LOG_MAX_FILES = process.env.LOG_MAX_FILES || '14d'; // Keep 14 days

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
      })
    ),
  }),
];

// Add rotating file transport in production (lazy load to avoid crash if not installed)
if (process.env.NODE_ENV === 'production') {
  try {
    const require = createRequire(import.meta.url);
    const DailyRotateFile = require('winston-daily-rotate-file');
    transports.push(new DailyRotateFile({
      dirname: LOG_DIR,
      filename: `${process.env.SERVICE_NAME || 'app'}-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES,
      zippedArchive: true,
    }));
  } catch {
    // winston-daily-rotate-file not installed — skip file logging
  }
}

// Add Logstash transport if LOGSTASH_URL is configured
if (process.env.LOGSTASH_URL) {
  transports.push(new LogstashHttpTransport({ logstashUrl: process.env.LOGSTASH_URL }));
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'unknown',
  },
  transports,
});
