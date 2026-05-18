## Plan: AI Image Recognition, Auto-matching & OCR MSSV (Optimized)

TL;DR: Tối ưu hóa lộ trình theo nguyên tắc incremental, low-risk first: (1) thêm worker xử lý ảnh bất đồng bộ (image-processor) để phân loại + OCR, (2) publish event Kafka `lostfound.analyzed` / `lostfound.match`, (3) mở rộng `notification-service` để tiêu thụ event và gửi in-app/push/email, (4) bổ sung endpoint lookup MSSV ở `user-service`, (5) cải tiến Admin UI và infra (Redis/Kafka/ LB). Giữ gateway Node hiện tại (circuit-breaker, rate-limit) — chuyển sang Spring Cloud/Resilience4j là migration lớn và được tách riêng.

**Steps (phased, priorities & estimates)**
1. Phase A — Core (high, 3–5 days)
   1.1. Add `image-processor` scaffold in `lost-found-service` to run async analysis (S3 event / job queue). (*depends: presigned-upload exists*)
   1.2. Persist `detectedType`, `extracted.studentId`, `analysisConfidence` on `LostFoundItem` and mark `analysisStatus`.
   1.3. Publish `lostfound.analyzed` (analysis done) and `lostfound.match` (if auto-match score >= threshold) to Kafka.
2. Phase B — Notifications & Lookup (high, 2–4 days) *parallel with Phase A step 1.2*
   2.1. Extend `packages/notification-service/src/services/kafka-consumer.service.js` to subscribe to `lostfound.analyzed`/`lostfound.match` and call existing `sendNotification` flow.
   2.2. Add `GET /api/v1/users/by-student/:studentId` in `user-service` (rate-limited) to resolve MSSV → userId/email.
3. Phase C — UX, Admin, Privacy (medium, 3 days)
   3.1. Frontend `ReportLostFound_FIX.tsx`: show detected label/MSSV, consent checkbox, allow user confirmation/overwrite.
   3.2. Admin: add heatmap endpoint `/admin/lost-found/heatmap` and a lightweight frontend chart; add bulk-moderation endpoints for admin (batch approve/reject).
4. Phase D — Ops & Hardening (medium, ongoing)
   4.1. Document LB placement in front of gateway; add NGINX staging LB config and health checks in `docker-compose` (optional for local).
   4.2. Add monitoring alerts for DLQ growth and OCR failure rate; ensure DLQ handling in notification-service exists (it does).
   4.3. Add rate-limit/quotas for OCR per-user and consent logging for privacy.
5. Phase E — Optional (large)
   - Evaluate cloud Vision API vs Tesseract (accuracy/cost). Start with cloud vendor PoC for MSSV OCR.
   - If organization requires Spring Cloud + Resilience4j, plan standalone migration project (non-blocking for features above).

**Concrete tasks & ownership (file-level)**
- New: `packages/lost-found-service/src/services/image-processor.service.js` — worker, config-driven (provider adapter), retry & backoff.
- Update: `packages/lost-found-service/src/controllers/lostfound.controller.js` — set `analysisStatus` and emit analysis-start/complete events.
- Update: `packages/lost-found-service/src/services/kafka.service.js` — add `publishLostFoundAnalyzed` / `publishLostFoundMatch` helpers.
- Update: `packages/notification-service/src/services/kafka-consumer.service.js` — add handlers for `lostfound.analyzed`/`lostfound.match` (reuse `sendNotification` + `getUserEmail`).
- New: `packages/user-service/src/controllers/user.controller.js` — `GET /api/v1/users/by-student/:studentId` with input validation and rate-limit middleware.
- Frontend: `frontend/src/pages/ReportLostFound_FIX.tsx` — UX consent + preview; `frontend/src/pages/AdminDashboard.tsx` — heatmap tab.
- Ops: docs in `DOCKER_SETUP.md` / `project_checklist.md` describing LB, health checks, and prod deployment notes.

**Verification (measurable acceptance criteria)**
- Unit: `image-processor` unit tests mock provider responses; DB shows `detectedType` and `extracted.studentId` stored.
- Integration: upload test image → worker processes → Kafka `lostfound.analyzed` emitted → notification created in DB and pushed to Redis pub/sub.
- E2E: Simulate FOUND/Lost pair → match generated automatically and both users receive in-app notification; if consent + user resolved by MSSV → email sent to university address (domain check @student.iuh.edu.vn).
- Infra: Gateway rejects downstream when circuit OPEN; rate-limit triggers on spamming endpoints.

**Key decisions / trade-offs**
- Use async analysis to minimize user latency and cost spikes (non-blocking create). Auto-match runs both pre-analysis quick-match (metadata) and post-analysis full-match.
- Start with cloud Vision API (best accuracy, fast PoC). Fallback to Tesseract if cost unacceptable, but expect extra preprocessing work.
- Keep Node API Gateway with existing circuit-breaker/rate-limit. Migrate to Spring Cloud Gateway only if organization needs Java-first solution.

**Risks & mitigations**
- OCR false positives → validate MSSV by regex + DB cross-check and require user confirmation before auto-email. Default: notify in-app, require explicit consent to send email.
- Cost of Vision API → add budget/quotas and sampling for model calls; consider caching results.
- Kafka consumer backpressure/DLQ → use existing DLQ UI and monitoring; add alert when DLQ rate increases.

**Estimates & timeline (minimal incremental delivery)**
- Week 0: PoC cloud OCR on 20 sample student-card images (1–2 days).
- Week 1: Phase A + Phase B MVP (image-processor scaffold + notification handler + studentId lookup) — deploy to staging.
- Week 2: Phase C UX + Admin heatmap + privacy flows; run integration tests.
- Week 3: Ops hardening, monitoring, docs, and roll-out to production (can be earlier if staged rollout desired).

**Next actions (pick one)**
- I: Generate scaffolds only (image-processor + notification handler) — I'll produce file templates and TODOs.
- II: Produce a PR skeleton with changes across services and tests (bigger, I will stage changes and include run commands).

---
