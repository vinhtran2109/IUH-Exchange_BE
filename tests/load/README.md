# IUH Exchange - Load Testing

## Prerequisites
- Apache JMeter 5.6+ installed
- Application running locally or on target environment

## Quick Start

### 1. Update Token
Edit `api-load-test.jmx` and replace `YOUR_JWT_TOKEN_HERE` with a valid JWT token.

Or pass via command line:
```bash
jmeter -n -t api-load-test.jmx \
  -Jhost=localhost \
  -Jport=8080 \
  -Jtoken=YOUR_JWT_TOKEN
```

### 2. Run Tests

```bash
# Basic run with default settings (50 threads, 60s duration)
jmeter -n -t api-load-test.jmx -l results/test-results.jtl

# Custom parameters
jmeter -n -t api-load-test.jmx \
  -Jhost=your-server.com \
  -Jport=8080 \
  -l results/test-results.jtl \
  -e -o results/html-report
```

### 3. View Results

```bash
# Generate HTML report from JTL
jmeter -g results/test-results.jtl -o results/html-report

# Open in browser
open results/html-report/index.html
```

## Test Scenarios

| Scenario | Threads | Ramp-up | Duration | Description |
|----------|---------|---------|----------|-------------|
| Browse Products | 50 | 10s | 60s | Product listing pagination |
| Search Products | 30 | 5s | 60s | Random keyword search |
| Authenticated Flow | 20 | 5s | 60s | Profile + conversations + products |
| Health Check | 5 | 1s | 60s | Gateway health endpoint |

## Expected Baselines

| Metric | Target | Critical |
|--------|--------|----------|
| p50 Latency | < 200ms | < 500ms |
| p95 Latency | < 500ms | < 2000ms |
| p99 Latency | < 1000ms | < 5000ms |
| Error Rate | < 1% | < 5% |
| Throughput | > 500 req/s | > 100 req/s |

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Load Test
  run: |
    jmeter -n -t tests/load/api-load-test.jmx \
      -Jhost=${{ secrets.STAGING_HOST }} \
      -Jport=8080 \
      -l results.jtl \
      -e -o report
    # Fail if p95 > 2s or error rate > 5%
    python tests/load/check-thresholds.py results.jtl
```
