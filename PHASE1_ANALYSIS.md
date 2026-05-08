# PHASE 1: Missing Business Features Analysis

**Date:** 2026-05-09
**Project:** IUH Exchange Backend (Node.js Microservices)
**Services:** api-gateway, ws-gateway, user-service, product-service, order-service, notification-service, chat-service, lost-found-service, common

---

## Summary

This analysis compares the current IUH Exchange platform against a complete campus marketplace system and identifies all missing features organized by domain. Each feature is assigned a priority level: **CRITICAL**, **HIGH**, **MEDIUM**, or **LOW**.

### What's Already Implemented ✅

- **User:** Registration, OTP verification, login/logout, password reset/change, profile management, admin user management (ban/unban/role/permissions), karma system with history
- **Product:** Full CRUD, admin approval workflow, profanity filter, S3 image upload, ElasticSearch fuzzy search, category filter, pagination & sorting
- **Reviews/Ratings:** Review model, create review (per-order), product reviews, seller reviews, average rating aggregation
- **Wishlist/Favorites:** Toggle wishlist, check wishlist, paginated wishlist with product details
- **Order:** Create with idempotency, seller confirm/reject, Saga choreography pattern (Kafka), Redis-based deduplication
- **Notification:** Kafka-driven notifications, FCM push, email delivery, WebSocket pub/sub via Redis, mark read/unread, delete
- **Chat:** Conversations list, message history, search, read/unread tracking, IMAGE/FILE message types, S3 upload
- **Lost & Found:** CRUD, claim workflow, S3 image upload
- **Common:** JWT auth, gateway signature verification, role-based authorization, Zod validation, error handling, caching, metrics, Kafka/Redis/MongoDB utilities
- **API Gateway:** Rate limiting (global/auth/sensitive), circuit breaker, WebSocket proxy (SockJS/STOMP), health checks with downstream ping, graceful shutdown, correlation IDs, Prometheus metrics
- **Infrastructure:** Dockerfiles for all services, docker-compose with MongoDB, Redis, Kafka, ElasticSearch, Logstash, Kibana, Prometheus, Grafana

---

## Missing Features by Domain

### 1. USER DOMAIN

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| U1 | **Failed Login Lockout** | 🔴 CRITICAL | No protection against brute-force login attacks. After N failed attempts, account should be temporarily locked or cooldown enforced. |
| U2 | **Account Deletion (Soft-Delete)** | 🟠 HIGH | Users cannot delete their own account. Need `DELETE /api/v1/users/me` with soft-delete (mark as deleted, anonymize data). |
| U3 | **2FA (Two-Factor Authentication)** | 🟡 MEDIUM | Only OTP for registration verification. No TOTP/SMS-based 2FA for login security. |
| U4 | **Activity History / Audit Log** | 🟠 HIGH | Only karma history exists. No general activity log (login, profile changes, product actions). |
| U5 | **Profile Privacy Settings** | 🔴 LOW | No way to control profile visibility (hide email, studentId from public view). |

### 2. PRODUCT DOMAIN

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| P1 | **Reviews/Ratings** | ✅ DONE | Already implemented |
| P2 | **Wishlist/Favorites** | ✅ DONE | Already implemented |
| P3 | **Discount/Coupon System** | 🔴 LOW | No coupon or discount codes. Complex feature with low ROI for MVP. |
| P4 | **Product Reporting** | 🔴 LOW | Lost-found has reports but no product-specific reporting for inappropriate listings. |

### 3. ORDER DOMAIN

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| O1 | **Buyer Order Cancellation** | 🔴 CRITICAL | Only seller can reject. Buyer cannot cancel their own PENDING order. Critical for UX. |
| O2 | **Refund Flow** | 🟠 HIGH | No refund mechanism when order is cancelled after any payment. |
| O3 | **Order Timeline/Status History** | 🟡 MEDIUM | No tracking of status changes over time. Users can't see when order moved from PENDING→AWAITING_SELLER→COMPLETED. |
| O4 | **Invoice Generation** | 🔴 LOW | No invoice/receipt generation for completed orders. |

### 4. CHAT DOMAIN

| # | Feature | Priority | Status/Description |
|---|---------|----------|-----|
| C1 | **Image/File Sharing** | ✅ DONE | ChatMessage model supports TEXT/IMAGE/FILE types |
| C2 | **Typing Indicators** | 🟡 MEDIUM | WebSocket-based typing status not implemented. |
| C3 | **Online/Offline Status** | 🔴 LOW | No presence tracking for users. |
| C4 | **Message Reporting** | 🔴 LOW | No way to report inappropriate messages. |

### 5. NOTIFICATION DOMAIN

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| N1 | **Notification Preferences** | 🟠 HIGH | Users can't control which notification types they receive (email, push, in-app). All notifications are sent unconditionally. |

### 6. PAYMENT DOMAIN

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| PM1 | **Payment Simulation (Mock VNPay)** | 🟠 HIGH | No payment flow at all. Orders go directly to seller confirmation without any payment step. Need mock payment gateway. |
| PM2 | **Refund Processing** | 🟠 HIGH | Tied to O2. When orders are cancelled, no refund mechanism exists. |
| PM3 | **Transaction History** | 🟡 MEDIUM | No record of financial transactions. |
| PM4 | **Wallet System** | 🔴 LOW | No virtual wallet for users. Low priority for MVP. |

### 7. SEARCH DOMAIN

| # | Feature | Priority | Status/Description |
|---|---------|----------|-----|
| S1 | **Price Range Filter** | 🟠 HIGH | ElasticSearch query only does fuzzy text match. No price range filtering (min/max). |
| S2 | **Location Filter** | 🟡 MEDIUM | Product model has no location field. Campus location filter would be useful. |
| S3 | **Category Filter (ES)** | 🟠 HIGH | Category filter exists in MongoDB query but NOT in ElasticSearch search. ES search ignores category. |
| S4 | **Sort Options (ES)** | 🟡 MEDIUM | ES search returns results by relevance only. No sort by price/date in ES. |
| S5 | **Autocomplete/Suggestions** | 🔴 LOW | No search suggestions or autocomplete. |

### 8. SECURITY DOMAIN

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| SC1 | **Failed Login Lockout** | 🔴 CRITICAL | Same as U1. Critical security feature. |
| SC2 | **Audit Logging** | 🟠 HIGH | No audit trail for sensitive operations (role changes, bans, permission updates). |
| SC3 | **CSRF Protection** | 🟡 MEDIUM | API-only backend with JWT, CSRF less critical but still good practice for cookie-based refresh tokens. |

### 9. SYSTEM DOMAIN

| # | Feature | Priority | Status/Description |
|---|---------|----------|-----|
| SY1 | **Health Check Improvements** | 🟡 MEDIUM | Basic health checks exist. Could add dependency health (DB, Redis, Kafka connectivity). |
| SY2 | **Monitoring** | ✅ DONE | Prometheus + Grafana already configured |
| SY3 | **Graceful Shutdown** | ✅ DONE | API Gateway has graceful shutdown. Other services lack it. |

### 10. INFRASTRUCTURE

| # | Feature | Priority | Status/Description |
|---|---------|----------|-----|
| I1 | **Per-service Dockerfiles** | ✅ DONE | All services have Dockerfiles |
| I2 | **docker-compose** | ✅ DONE | Full stack with all dependencies |
| I3 | **CI/CD Pipeline** | 🔴 LOW | No GitHub Actions or CI/CD configuration. |

---

## Implementation Priority Matrix

### 🔴 CRITICAL (Must implement)

1. **O1: Buyer Order Cancellation** — order-service
   - Add `PATCH /api/v1/orders/:id/cancel` endpoint
   - Only buyer can cancel their own PENDING/AWAITING_SELLER order
   - Publish OrderCancelledEvent to Kafka
   - Update order.service.js with cancelByBuyer method

2. **U1/SC1: Failed Login Lockout** — user-service
   - Track failed login attempts in User model (failedLoginAttempts, lockUntil)
   - After 5 failed attempts, lock account for 15 minutes
   - Reset counter on successful login
   - Add to auth.controller.js login flow

### 🟠 HIGH (Should implement)

3. **U2: Account Deletion** — user-service
   - Add `DELETE /api/v1/users/me` with soft-delete
   - Add `isDeleted` flag to User model
   - Anonymize personal data (email, name)
   - Invalidate all sessions

4. **U4/SC2: Audit Logging** — common middleware
   - Create AuditLog model in common
   - Audit middleware that logs sensitive operations
   - Track: who, what, when, IP, user-agent

5. **N1: Notification Preferences** — notification-service
   - Create NotificationPreference model
   - CRUD for user preferences (email, push, in-app per type)
   - Check preferences before sending notifications

6. **PM1: Payment Simulation** — order-service
   - Mock VNPay payment flow
   - Add payment status to Order model
   - Create payment endpoints (create payment URL, callback)
   - Integrate with order lifecycle

7. **S1/S3: Search Filters** — product-service
   - Add price range (min/max) to ES query
   - Add category filter to ES query
   - Add condition filter to ES query
   - Update searchProducts in elasticsearch.service.js

### 🟡 MEDIUM (Nice to have)

8. **O3: Order Timeline** — order-service
9. **C2: Typing Indicators** — chat-service/ws-gateway
10. **S2: Location Filter** — product-service
11. **SC3: CSRF Protection** — api-gateway
12. **SY1: Health Check Improvements** — all services

### 🔴 LOW (Future)

13. **U3: 2FA** — user-service
14. **U5: Profile Privacy** — user-service
15. **P3: Discount/Coupon** — product-service/order-service
16. **P4: Product Reporting** — product-service
17. **O4: Invoice** — order-service
18. **C3: Online/Offline Status** — chat-service
19. **C4: Message Reporting** — chat-service
20. **PM3: Transaction History** — order-service
21. **PM4: Wallet** — new service
22. **S5: Autocomplete** — product-service
23. **I3: CI/CD** — GitHub Actions

---

## Phase 2 Implementation Order

Based on priority and dependencies:

1. ✅ Reviews/Ratings (already done)
2. ✅ Wishlist (already done)
3. **Buyer Order Cancellation** (order-service)
4. **Failed Login Lockout** (user-service)
5. **Audit Logging** (common middleware)
6. **Account Deletion** (user-service)
7. **Notification Preferences** (notification-service)
8. **Payment Simulation Mock** (order-service)
9. **Search Improvements** (product-service)
10. **Health Check Improvements** (api-gateway)

---

*Analysis completed: 2026-05-09*
