# IUH Exchange - Docker Setup Guide

## Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux) — v24+
- **Docker Compose** v2.x (included in Docker Desktop)
- At least **4 GB RAM** allocated to Docker
- Ports available: `27018`, `3001-3007`, `5044`, `5601`, `6379`, `8080`, `9090`, `9092`, `9200`, `9600`, `3100`

## Quick Start

### 1. Clone & Configure

```bash
git clone <repo-url>
cd IUH-Exchange_BE

# Copy environment template
cp .env.example .env
```

### 2. Edit `.env`

At minimum, set these required values:

```env
JWT_SECRET=your-super-secret-jwt-key-change-this
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

### 3. Start Everything

```bash
# Start all infrastructure + services
docker compose up -d

# View logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f api-gateway
```

### 4. Verify

```bash
# Health check
curl http://localhost:8080/health

# Liveness probe
curl http://localhost:8080/health/live

# Readiness probe
curl http://localhost:8080/health/ready
```

---

## Architecture Overview

```
                    ┌─────────────┐
                    │  Frontend   │
                    │  (Port 5173)│
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ API Gateway │
                    │  (Port 8080)│
                    └──────┬──────┘
                           │
        ┌──────────┬───────┼───────┬──────────┬──────────┐
        │          │       │       │          │          │
   ┌────▼────┐ ┌───▼──┐ ┌─▼──┐ ┌──▼──┐ ┌────▼────┐ ┌───▼───┐
   │  User   │ │Product│ │Order│ │Notif│ │  Chat   │ │Lost & │
   │Service  │ │Service│ │Svc  │ │Svc  │ │ Service │ │Found  │
   │ (:3001) │ │(:3002)│ │(:303)│ (:3004)│ (:3005) │ │(:3006)│
   └────┬────┘ └───┬──┘ └──┬──┘ └──┬──┘ └────┬────┘ └───┬───┘
        │          │       │       │          │          │
        └──────────┴───────┼───────┴──────────┴──────────┘
                           │
        ┌──────────┬───────┼───────┬──────────┐
        │          │       │       │          │
   ┌────▼────┐ ┌───▼──┐ ┌─▼──┐ ┌──▼──┐ ┌────▼────┐
   │ MongoDB │ │Redis │ │Kafka│ │ ES  │ │Prometheus│
   │(:27018) │ │(:6379)│ │(:9092)│(:9200)│ (:9090) │
   └─────────┘ └──────┘ └─────┘ └─────┘ └─────────┘
```

### Services & Ports

| Service              | Port | Description                         |
|----------------------|------|-------------------------------------|
| API Gateway          | 8080 | Main entry point, routing, auth     |
| User Service         | 3001 | Auth, profiles, admin               |
| Product Service      | 3002 | Products, reviews, wishlist         |
| Order Service        | 3003 | Orders, payments                    |
| Notification Service | 3004 | Notifications, FCM, email           |
| Chat Service         | 3005 | Chat messages, conversations        |
| Lost & Found Service | 3006 | Lost & found items, reports         |
| WebSocket Gateway    | 3007 | WebSocket connections               |
| MongoDB              | 27018| Database                            |
| Redis                | 6379 | Cache, rate limiting, pub/sub       |
| Kafka                | 9092 | Event streaming                     |
| ElasticSearch        | 9200 | Full-text search                    |
| Kibana               | 5601 | ELK dashboards                      |
| Prometheus           | 9090 | Metrics collection                  |
| Grafana              | 3100 | Monitoring dashboards               |

### Default Credentials

| Service     | Username | Password              |
|-------------|----------|-----------------------|
| MongoDB     | root     | iuh_exchange_root     |
| Redis       | —        | iuh_exchange_redis    |
| Grafana     | admin    | iuh_exchange_grafana  |

---

## Development Mode

For development (with hot-reload), run only infrastructure in Docker and services locally:

```bash
# Start only infrastructure
docker compose up -d mongodb redis kafka elasticsearch logstash kibana

# Run services locally with npm
npm run dev:services
```

Or run individual services:

```bash
npm run dev:user      # User service only
npm run dev:product   # Product service only
npm run dev:order     # Order service only
```

---

## Useful Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Stop and remove volumes (fresh start)
docker compose down -v

# Rebuild a specific service
docker compose build api-gateway
docker compose up -d api-gateway

# View resource usage
docker stats

# Check service health
curl http://localhost:8080/health

# Run tests locally
npm test
```

---

## Troubleshooting

### Port already in use
```bash
# Find process using the port (Windows)
netstat -ano | findstr :8080

# Kill the process
taskkill /PID <pid> /F
```

### MongoDB connection failed
- Ensure MongoDB container is running: `docker compose ps`
- Check logs: `docker compose logs mongodb`
- Verify credentials in `.env` match `docker-compose.yml`

### Kafka not ready
- Kafka takes 30-60 seconds to start
- Check: `docker compose logs kafka`
- Ensure Zookeeper is running first

### ElasticSearch won't start
- Needs at least 1GB RAM
- Check: `docker compose logs elasticsearch`
- May need to increase `vm.max_map_count` on Linux:
  ```bash
  sudo sysctl -w vm.max_map_count=262144
  ```

### Services can't connect to each other
- All services use Docker internal network `iuh-exchange-net`
- Service URLs in `.env` use container names (e.g., `mongodb`, `redis`)
- For local dev, change to `localhost` with mapped ports

---

## Testing

```bash
# Run all tests
npx vitest run

# Run tests for a specific service
npx vitest run packages/user-service
npx vitest run packages/product-service
npx vitest run packages/order-service

# Run tests with coverage
npx vitest run --coverage
```

---

## Project Structure

```
IUH-Exchange_BE/
├── packages/
│   ├── api-gateway/        # API Gateway (Express + http-proxy-middleware)
│   ├── chat-service/       # Chat (Express + SockJS + STOMP)
│   ├── common/             # Shared library (auth, utils, middleware)
│   ├── lost-found-service/ # Lost & Found
│   ├── notification-service/ # Notifications (Kafka consumer + FCM)
│   ├── order-service/      # Orders + Payments (Saga pattern)
│   ├── product-service/    # Products + Reviews + Wishlist + ElasticSearch
│   ├── user-service/       # Auth + Users + Admin + Karma
│   └── ws-gateway/         # WebSocket Gateway
├── frontend/               # React + Vite + TypeScript
├── infra/                  # Infrastructure configs
│   ├── elk/                # Logstash pipeline
│   ├── mongo/              # MongoDB init scripts
│   └── monitoring/         # Prometheus + Grafana
├── docker-compose.yml      # Full stack orchestration
├── Dockerfile.*            # Per-service Dockerfiles
├── .env.example            # Environment template
└── vitest.config.js        # Test configuration
```

---

*Last updated: 2026-05-09*
