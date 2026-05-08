import winston from 'winston';
import http from 'http';

/**
 * Logstash HTTP transport - sends JSON logs to Logstash via HTTP input.
 */
class LogstashHttpTransport extends winston.transports.Stream {
  constructor(opts = {}) {
    const logstashUrl = opts.logstashUrl || process.env.LOGSTASH_URL || 'http://localhost:9600';
    super({
      write: (chunk) => {
        try {
          const data = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
          const body = JSON.stringify(data);
          const url = new URL(logstashUrl);
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
      }
    });
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
