#!/usr/bin/env python3
"""
Load test threshold checker for CI/CD pipelines.
Parses JMeter JTL results and validates against thresholds.

Usage: python check-thresholds.py results.jtl [--p95-max 2000] [--error-rate-max 5]
"""

import sys
import csv
import argparse
from pathlib import Path


def parse_jtl(filepath):
    """Parse JMeter JTL CSV results."""
    results = []
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            results.append({
                'elapsed': int(row.get('elapsed', 0)),
                'success': row.get('success', 'true').lower() == 'true',
                'response_code': row.get('responseCode', '0'),
            })
    return results


def percentile(data, p):
    """Calculate p-th percentile."""
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * (p / 100)
    f = int(k)
    c = f + 1
    if c >= len(sorted_data):
        return sorted_data[-1]
    return sorted_data[f] + (k - f) * (sorted_data[c] - sorted_data[f])


def main():
    parser = argparse.ArgumentParser(description='Check JMeter results against thresholds')
    parser.add_argument('jtl', help='Path to JTL results file')
    parser.add_argument('--p95-max', type=int, default=2000, help='Max p95 latency in ms (default: 2000)')
    parser.add_argument('--p50-max', type=int, default=500, help='Max p50 latency in ms (default: 500)')
    parser.add_argument('--error-rate-max', type=float, default=5.0, help='Max error rate %% (default: 5)')
    args = parser.parse_args()

    if not Path(args.jtl).exists():
        print(f"❌ File not found: {args.jtl}")
        sys.exit(1)

    results = parse_jtl(args.jtl)
    if not results:
        print("❌ No results found in JTL file")
        sys.exit(1)

    elapsed = [r['elapsed'] for r in results]
    errors = [r for r in results if not r['success']]
    error_rate = (len(errors) / len(results)) * 100

    p50 = percentile(elapsed, 50)
    p95 = percentile(elapsed, 95)
    p99 = percentile(elapsed, 99)

    print(f"\n📊 Load Test Results Summary")
    print(f"{'─' * 40}")
    print(f"  Total requests:  {len(results):,}")
    print(f"  Errors:          {len(errors):,} ({error_rate:.1f}%)")
    print(f"  p50 latency:     {p50:.0f}ms")
    print(f"  p95 latency:     {p95:.0f}ms")
    print(f"  p99 latency:     {p99:.0f}ms")
    print(f"{'─' * 40}")

    failed = False

    if p50 > args.p50_max:
        print(f"  ❌ p50 latency ({p50:.0f}ms) exceeds threshold ({args.p50_max}ms)")
        failed = True
    else:
        print(f"  ✅ p50 latency OK")

    if p95 > args.p95_max:
        print(f"  ❌ p95 latency ({p95:.0f}ms) exceeds threshold ({args.p95_max}ms)")
        failed = True
    else:
        print(f"  ✅ p95 latency OK")

    if error_rate > args.error_rate_max:
        print(f"  ❌ Error rate ({error_rate:.1f}%) exceeds threshold ({args.error_rate_max}%)")
        failed = True
    else:
        print(f"  ✅ Error rate OK")

    print()
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
