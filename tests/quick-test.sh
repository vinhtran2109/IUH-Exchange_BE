#!/bin/bash
# ============================================================
# IUH Exchange - Quick Start & Test
# Usage: bash tests/quick-test.sh
# ============================================================

echo "🚀 IUH Exchange - Quick Test Setup"
echo "=================================="

# Check prerequisites
check_cmd() {
  if command -v $1 &> /dev/null; then
    echo "✅ $1 installed"
  else
    echo "❌ $1 not found - please install first"
    MISSING=1
  fi
}

MISSING=0
check_cmd node
check_cmd npm
check_cmd docker
check_cmd mongosh

if [ $MISSING -eq 1 ]; then
  echo ""
  echo "⚠️  Missing prerequisites. Install them first."
  exit 1
fi

# Check if services are running
echo ""
echo "🔍 Checking services..."

check_port() {
  if nc -z localhost $1 2>/dev/null; then
    echo "✅ Port $1 ($2) is open"
  else
    echo "❌ Port $1 ($2) is not open"
  fi
}

check_port 27018 "MongoDB"
check_port 6379 "Redis"
check_port 9092 "Kafka"
check_port 9200 "ElasticSearch"
check_port 8080 "API Gateway"
check_port 3001 "User Service"
check_port 3002 "Product Service"
check_port 3003 "Order Service"
check_port 3004 "Notification Service"
check_port 3005 "Chat Service"
check_port 3006 "Lost-Found Service"

# Run tests
echo ""
echo "🧪 Running API tests..."
echo ""

bash tests/test-api.sh

echo ""
echo "📊 Running Node.js unit tests..."
echo ""

node --test tests/test-services.js
