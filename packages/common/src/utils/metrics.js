/**
 * Lightweight Prometheus metrics middleware for Express services.
 * Exposes /metrics endpoint with HTTP request metrics.
 */

const metrics = {
  httpRequestsTotal: new Map(),
  httpRequestDuration: new Map(),
  cacheHits: 0,
  cacheMisses: 0,
  wsConnections: 0,
  startTime: Date.now(),
};

/**
 * Express middleware to collect HTTP metrics.
 */
export function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const service = process.env.SERVICE_NAME || 'unknown';
    const method = req.method;
    const route = req.route?.path || req.path || 'unknown';
    const status = res.statusCode;

    // Count requests
    const reqKey = `${service}|${method}|${route}|${status}`;
    const current = metrics.httpRequestsTotal.get(reqKey) || 0;
    metrics.httpRequestsTotal.set(reqKey, current + 1);

    // Track duration
    const durKey = `${service}|${method}|${route}`;
    if (!metrics.httpRequestDuration.has(durKey)) {
      metrics.httpRequestDuration.set(durKey, []);
    }
    const durations = metrics.httpRequestDuration.get(durKey);
    durations.push(duration);
    // Keep only last 1000 samples
    if (durations.length > 1000) durations.shift();
  });

  next();
}

export function incrementCacheHit() { metrics.cacheHits++; }
export function incrementCacheMiss() { metrics.cacheMisses++; }
export function setWsConnections(count) { metrics.wsConnections = count; }

/**
 * Express handler for /metrics endpoint (Prometheus format).
 */
export function metricsHandler(_req, res) {
  const lines = [];
  const service = process.env.SERVICE_NAME || 'unknown';

  // HTTP request totals
  lines.push('# HELP http_requests_total Total HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  for (const [key, value] of metrics.httpRequestsTotal.entries()) {
    const [svc, method, route, status] = key.split('|');
    lines.push(`http_requests_total{service="${svc}",method="${method}",route="${route}",status="${status}"} ${value}`);
  }

  // HTTP request duration
  lines.push('# HELP http_request_duration_seconds HTTP request duration');
  lines.push('# TYPE http_request_duration_seconds summary');
  for (const [key, durations] of metrics.httpRequestDuration.entries()) {
    const [svc, method, route] = key.split('|');
    if (durations.length === 0) continue;
    const sorted = [...durations].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    lines.push(`http_request_duration_seconds{service="${svc}",method="${method}",route="${route}",quantile="0.5"} ${p50}`);
    lines.push(`http_request_duration_seconds{service="${svc}",method="${method}",route="${route}",quantile="0.95"} ${p95}`);
    lines.push(`http_request_duration_seconds{service="${svc}",method="${method}",route="${route}",quantile="0.99"} ${p99}`);
    lines.push(`http_request_duration_seconds_sum{service="${svc}",method="${method}",route="${route}"} ${sorted.reduce((a, b) => a + b, 0)}`);
    lines.push(`http_request_duration_seconds_count{service="${svc}",method="${method}",route="${route}"} ${durations.length}`);
  }

  // Cache metrics
  lines.push('# HELP cache_hits_total Cache hit count');
  lines.push('# TYPE cache_hits_total counter');
  lines.push(`cache_hits_total{service="${service}"} ${metrics.cacheHits}`);
  lines.push('# HELP cache_misses_total Cache miss count');
  lines.push('# TYPE cache_misses_total counter');
  lines.push(`cache_misses_total{service="${service}"} ${metrics.cacheMisses}`);

  // WebSocket connections
  lines.push('# HELP ws_active_connections Active WebSocket connections');
  lines.push('# TYPE ws_active_connections gauge');
  lines.push(`ws_active_connections{service="${service}"} ${metrics.wsConnections}`);

  // Process metrics
  const mem = process.memoryUsage();
  lines.push('# HELP process_memory_bytes Process memory usage');
  lines.push('# TYPE process_memory_bytes gauge');
  lines.push(`process_memory_bytes{service="${service}",type="rss"} ${mem.rss}`);
  lines.push(`process_memory_bytes{service="${service}",type="heapUsed"} ${mem.heapUsed}`);
  lines.push(`process_memory_bytes{service="${service}",type="heapTotal"} ${mem.heapTotal}`);

  // Uptime
  const uptime = (Date.now() - metrics.startTime) / 1000;
  lines.push('# HELP process_uptime_seconds Process uptime');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds{service="${service}"} ${uptime}`);

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(lines.join('\n') + '\n');
}
