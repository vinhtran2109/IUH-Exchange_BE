# Tài liệu trả lời kiến trúc và DevOps - IUH Exchange

Tài liệu này dùng để trả lời khi bảo vệ đồ án. Mỗi ý đều có phần trả lời ngắn, giải thích chi tiết và ghi chú file code liên quan.

## 1. Tổng quan kiến trúc đã chọn

IUH Exchange chọn kiến trúc Microservices kết hợp API Gateway, Nginx reverse proxy/load balancer, Redis, Kafka, MongoDB theo từng service, WebSocket gateway và frontend React SPA.

Luồng chính:

1. Người dùng truy cập `https://iuhexchange.site`.
2. Nginx phục vụ frontend static và chuyển `/api/*` về API Gateway, `/ws/*` về WebSocket Gateway.
3. API Gateway xác thực JWT, giới hạn request, log request, gắn correlation id, kiểm tra circuit breaker rồi proxy request đến service phù hợp.
4. Các service nghiệp vụ xử lý riêng từng bounded context: User, Product, Order, Notification, Chat, Lost & Found.
5. Redis dùng cho cache, rate limiter, retry/backoff và một số trạng thái runtime.
6. Kafka dùng cho event bất đồng bộ như notification, karma, saga đơn hàng.
7. AI được tích hợp trong Chat Service và Lost & Found Service để hỗ trợ tìm kiếm, tư vấn, tự tạo tin đồ thất lạc và matching.

File code liên quan:

| Thành phần | File |
|---|---|
| Docker Compose toàn hệ thống | `docker-compose.yml` |
| Nginx reverse proxy/load balancer HTTPS | `infra/nginx/nginx.conf` |
| API Gateway entrypoint | `packages/api-gateway/src/index.js` |
| Route mapping gateway -> service | `packages/api-gateway/src/config/routes.js` |
| WebSocket Gateway | `packages/ws-gateway/src/index.js`, `packages/ws-gateway/src/services/socket.service.js` |
| User Service | `packages/user-service/src/index.js` |
| Product Service | `packages/product-service/src/index.js` |
| Order Service | `packages/order-service/src/index.js` |
| Notification Service | `packages/notification-service/src/index.js` |
| Chat Service | `packages/chat-service/src/index.js` |
| Lost & Found Service | `packages/lost-found-service/src/index.js` |
| Frontend React | `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx` |

## 2. Vì sao chọn Microservices thay vì Monolith

### Câu trả lời ngắn

Nhóm chọn Microservices vì hệ thống có nhiều miền nghiệp vụ độc lập: tài khoản, sản phẩm, đơn hàng, thông báo, chat real-time, đồ thất lạc và AI. Mỗi miền có tốc độ phát triển, tải truy cập và yêu cầu kỹ thuật khác nhau. Microservices giúp tách trách nhiệm, dễ scale riêng từng phần và giảm ảnh hưởng khi một module lỗi.

### So sánh với Monolith

| Tiêu chí | Monolith | Microservices của IUH Exchange |
|---|---|---|
| Triển khai | Một app duy nhất, deploy đơn giản | Nhiều service, deploy phức tạp hơn |
| Phát triển tính năng | Dễ bắt đầu, ít cấu hình | Tách team/module tốt hơn |
| Lỗi hệ thống | Lỗi một module có thể kéo sập toàn app | Lỗi một service có thể cô lập bằng gateway/circuit breaker |
| Scale | Scale cả hệ thống dù chỉ một phần bị tải cao | Scale riêng `chat-service`, `product-service`, `api-gateway` |
| Database | Một database lớn, dễ join | Mỗi service sở hữu dữ liệu riêng, cần API/event để đồng bộ |
| Chi phí vận hành | Thấp hơn | Cao hơn do nhiều container, monitoring, gateway, network |
| Phù hợp dự án | Phù hợp MVP nhỏ | Phù hợp hệ thống nhiều luồng nghiệp vụ và cần trình bày kiến trúc |

### So sánh với Layered Architecture thuần

Layered Architecture vẫn có Controller - Service - Repository trong từng service, nhưng nếu chỉ dùng layered monolith thì toàn bộ code vẫn nằm trong một deployment. IUH Exchange dùng layered bên trong từng service, còn cấp hệ thống dùng Microservices.

Ví dụ:

- Product có controller/service/model riêng trong `packages/product-service/src`.
- Order có saga riêng trong `packages/order-service/src/services/saga.service.js`.
- Lost & Found có matching/AI riêng trong `packages/lost-found-service/src/services`.

## 3. Ưu điểm và nhược điểm của kiến trúc đã chọn

### Ưu điểm

1. Dễ mở rộng theo từng service:
   - Khi chat đông, scale `chat-service` hoặc `ws-gateway`.
   - Khi tìm kiếm sản phẩm nhiều, scale `product-service` và Elasticsearch.
   - Khi AI/matching nặng, scale `lost-found-service`.

2. Cô lập lỗi tốt hơn:
   - API Gateway có circuit breaker, nếu một service lỗi thì gateway trả `503` cho service đó thay vì làm sập toàn hệ thống.
   - Docker/Kubernetes có health check, readiness/liveness để tự phát hiện container lỗi.

3. Dễ bảo trì theo miền nghiệp vụ:
   - User, Product, Order, Notification, Chat, Lost & Found có thư mục riêng.
   - Code common tái sử dụng middleware, exception, cache, metrics.

4. Hỗ trợ realtime và event-driven:
   - WebSocket/SockJS/STOMP cho chat và notification.
   - Kafka cho xử lý bất đồng bộ.

5. Phù hợp triển khai cloud:
   - Có Dockerfile riêng cho từng service.
   - Có `docker-compose.yml`.
   - Có manifest Kubernetes, HPA và PDB.

### Nhược điểm

1. Độ phức tạp vận hành cao:
   - Cần quản lý nhiều container, network, env, port, health check.
   - Debug khó hơn monolith vì request đi qua Nginx -> Gateway -> Service.

2. Chi phí cao hơn:
   - Nhiều service chạy song song tốn RAM/CPU hơn.
   - Cần Redis, Kafka, Elasticsearch, monitoring.

3. Dữ liệu phân tán:
   - Không join trực tiếp giữa các service.
   - Phải gọi API hoặc dùng event để đồng bộ.

4. Latency tăng:
   - Gọi qua gateway/proxy/network có overhead so với gọi hàm nội bộ trong monolith.

5. Cần kiểm soát version API:
   - Khi thay đổi contract giữa services, cần test kỹ.

File code minh chứng:

| Ý | File |
|---|---|
| Service tách riêng | `packages/*/src/index.js` |
| Gateway route đến từng service | `packages/api-gateway/src/config/routes.js` |
| Circuit breaker | `packages/api-gateway/src/middleware/circuit-breaker.js` |
| Health check Docker Compose | `docker-compose.yml` |
| Kubernetes replicas/probes | `k8s/base/deployments.yaml` |

## 4. Trade-off: hiệu năng, chi phí, độ phức tạp, mở rộng

| Trade-off | Lợi ích | Đánh đổi | Cách dự án xử lý |
|---|---|---|---|
| Hiệu năng vs độ phức tạp | Cache Redis, gateway, service riêng giúp tối ưu từng phần | Thêm network hop, tracing phức tạp | Dùng Redis cache, request id, metrics |
| Chi phí vs availability | Nhiều replica/container tăng khả dụng | Tốn tài nguyên hơn monolith | Docker Compose cho server nhỏ, Kubernetes/HPA cho mở rộng |
| Mở rộng vs consistency | Scale từng service độc lập | Dữ liệu phân tán, eventual consistency | Kafka event, saga cho order |
| Bảo mật vs UX | JWT, refresh token, rate limit bảo vệ hệ thống | Người dùng có thể bị 401/refresh chậm | Frontend tự refresh token và queue request |
| Fault tolerance vs latency | Retry/circuit breaker giúp chịu lỗi | Retry làm request lâu hơn | Retry có backoff 3-5s, circuit breaker cắt nhanh khi lỗi liên tục |

File code liên quan:

- Redis cache: `packages/common/src/utils/cache.js`, `packages/common/src/utils/redis.js`
- Request id/log: `packages/api-gateway/src/middleware/request-logger.js`
- Circuit breaker: `packages/api-gateway/src/middleware/circuit-breaker.js`
- Client refresh/retry cooldown: `frontend/src/services/api.ts`
- WebSocket reconnect 5s: `frontend/src/services/chatService.ts`
- Saga: `packages/order-service/src/services/saga.service.js`

## 5. Câu hỏi tình huống kiến trúc

### Nếu traffic tăng đột biến thì xử lý thế nào?

Trả lời:

Đầu tiên gateway và Nginx sẽ giới hạn request để tránh quá tải. Nếu traffic hợp lệ tăng cao, hệ thống scale horizontal các service chịu tải: `api-gateway`, `product-service`, `chat-service`, `ws-gateway`. Với Kubernetes, HPA scale theo CPU/memory. Redis cache giảm tải đọc lặp lại, Elasticsearch hỗ trợ tìm kiếm sản phẩm.

File:

- Nginx rate limit: `infra/nginx/nginx.conf`
- Gateway rate limiter: `packages/api-gateway/src/index.js`
- HPA: `k8s/base/hpa.yaml`
- Kubernetes deployment replicas: `k8s/base/deployments.yaml`
- Redis cache: `packages/common/src/utils/cache.js`

### Nếu một service bị downtime thì sao?

Trả lời:

Nếu một service lỗi, API Gateway dùng circuit breaker. Sau một số lỗi liên tiếp, circuit breaker chuyển sang OPEN và trả `503` nhanh thay vì tiếp tục gọi service lỗi. Docker Compose có `restart: unless-stopped` và healthcheck. Kubernetes có liveness/readiness probes để loại pod lỗi khỏi routing và restart pod.

File:

- Circuit breaker: `packages/api-gateway/src/middleware/circuit-breaker.js`
- Gateway sử dụng circuit breaker: `packages/api-gateway/src/index.js`
- Docker healthcheck: `docker-compose.yml`
- K8s liveness/readiness: `k8s/base/deployments.yaml`

### Nếu Redis bị lỗi thì hệ thống có sập không?

Trả lời:

Redis dùng cho cache/rate limiter. Với cache, code bắt lỗi và trả `null`, sau đó service có thể đọc từ database. Tuy nhiên rate limiter gateway phụ thuộc Redis; khi Redis lỗi có thể ảnh hưởng khả năng giới hạn request. Trong production nên chạy Redis managed hoặc Redis Sentinel/Cluster.

File:

- Redis connection/retry: `packages/common/src/utils/redis.js`
- Cache fallback khi lỗi: `packages/common/src/utils/cache.js`
- Gateway Redis-backed rate limiter: `packages/api-gateway/src/index.js`

### Nếu WebSocket mất kết nối thì sao?

Trả lời:

Frontend tự reconnect sau 5 giây, có queue frame gửi khi chưa kết nối. Nginx proxy `/ws` với timeout dài cho kết nối realtime. WebSocket Gateway và Chat Service có health check riêng.

File:

- Client reconnect 5s, pending frames: `frontend/src/services/chatService.ts`
- Nginx `/ws` proxy: `infra/nginx/nginx.conf`
- Chat socket service: `packages/chat-service/src/services/socket.service.js`
- WS Gateway: `packages/ws-gateway/src/services/socket.service.js`

### Nếu cần deploy không downtime thì làm sao?

Trả lời:

Hiện tại Docker Compose dùng restart container, có thể gây gián đoạn ngắn ở service được rebuild. Hướng production tốt hơn là Kubernetes rolling update với nhiều replicas, readiness probe và PDB. Khi pod mới ready thì mới nhận traffic, pod cũ vẫn phục vụ cho tới khi bị thay thế.

File:

- Docker Compose deploy hiện tại: `docker-compose.yml`
- Kubernetes replicas/probes: `k8s/base/deployments.yaml`
- PodDisruptionBudget: `k8s/base/pdb.yaml`
- CI/CD deploy Kubernetes: `.github/workflows/deploy.yml`

## 6. Architecture Characteristics

### 6.1 Availability 24/7

Trả lời:

Hệ thống hướng đến 24/7 bằng nhiều lớp:

- Nginx đứng trước, phục vụ frontend static và reverse proxy API/WebSocket.
- Docker Compose dùng `restart: unless-stopped`.
- Mỗi service có healthcheck.
- Kubernetes manifests có replicas tối thiểu 2 cho frontend, gateway và services.
- Liveness/readiness probes giúp restart pod lỗi và chỉ route traffic đến pod sẵn sàng.
- PDB giữ tối thiểu 1 pod còn chạy khi bảo trì.
- Prometheus/Grafana hỗ trợ quan sát sức khỏe hệ thống.

File:

- `infra/nginx/nginx.conf`
- `docker-compose.yml`
- `k8s/base/deployments.yaml`
- `k8s/base/pdb.yaml`
- `infra/monitoring/prometheus/prometheus.yml`
- `infra/monitoring/grafana/dashboards/iuh-exchange.json`

### 6.2 Performance - Redis cache cho CRUD một object

Trả lời:

Dự án dùng Redis theo cache-aside pattern. Khi đọc dữ liệu, service có thể lấy từ Redis trước; nếu cache miss thì đọc từ database rồi ghi lại cache với TTL. Khi update/delete thì xóa cache theo key hoặc pattern. Cách này giảm truy vấn database cho các object/danh sách đọc nhiều như sản phẩm, lost-found, profile.

File:

- Cache abstraction: `packages/common/src/utils/cache.js`
- Redis client: `packages/common/src/utils/redis.js`
- Test cache: `packages/common/src/__tests__/cache.test.js`
- Lost-found cache eviction: `packages/lost-found-service/src/controllers/lostfound.controller.js`

Điểm đáng nói:

- `getOrSet()` có lock Redis để tránh cache stampede.
- `delPattern()` dùng SCAN thay vì KEYS để tránh block Redis production.

### 6.3 Fault Tolerance - Rate Limiter phía client

Trả lời:

Frontend có client-side rate limiter để giảm spam từ UI trước khi request đến server. Cụ thể giới hạn tối đa 15 request trong 2 giây và chặn double-submit các request thay đổi dữ liệu trong 1.2 giây.

File:

- `frontend/src/services/api.ts`

Ý nghĩa:

- Giảm tình trạng người dùng bấm nút nhiều lần tạo nhiều đơn/bài đăng.
- Giảm tải gateway và service.
- Đây là lớp bảo vệ UX, không thay thế server rate limiter.

### 6.4 Fault Tolerance - Retry 3-5s khi API/service lỗi

Trả lời:

Hệ thống có retry/backoff ở nhiều lớp:

- Redis client retry với delay tăng dần, tối đa 5 giây.
- Frontend refresh token có cooldown 5 giây để tránh spam `/refresh-token` khi auth lỗi.
- WebSocket reconnect sau 5 giây khi mất kết nối.
- Gateway có timeout 30 giây và circuit breaker reset sau 30 giây.

File:

- Redis retry strategy: `packages/common/src/utils/redis.js`
- Frontend token refresh cooldown: `frontend/src/services/api.ts`
- WebSocket reconnect 5s: `frontend/src/services/chatService.ts`
- Gateway proxy timeout/circuit breaker: `packages/api-gateway/src/index.js`, `packages/api-gateway/src/middleware/circuit-breaker.js`

### 6.5 Fault Tolerance - Rate Limiter phía server/gateway

Trả lời:

Server có rate limiter ở hai lớp:

1. Nginx giới hạn `/api/` theo IP: `30r/s`, burst `50`.
2. API Gateway dùng `express-rate-limit` với Redis Store:
   - global limiter
   - auth limiter
   - sensitive limiter

File:

- Nginx: `infra/nginx/nginx.conf`
- Gateway rate limiter: `packages/api-gateway/src/index.js`
- Route nào dùng limiter nào: `packages/api-gateway/src/config/routes.js`
- OCR-specific rate limit: `packages/lost-found-service/src/middleware/ocr-rate-limit.js`

### 6.6 Security - JWT

Trả lời:

Hệ thống dùng JWT Bearer token để xác thực người dùng. API Gateway kiểm tra token và forward danh tính xuống service qua `X-User-*` headers. Service dùng middleware chung để authenticate/authorize theo role và permission. WebSocket cũng xác thực token trong query/header khi connect.

File:

- Common auth middleware: `packages/common/src/middleware/auth.js`
- Gateway auth filter: `packages/api-gateway/src/middleware/auth-filter.js`
- Gateway JWT/WebSocket proxy: `packages/api-gateway/src/index.js`
- Frontend gắn Authorization header: `frontend/src/services/api.ts`
- Auth controller login/register: `packages/user-service/src/controllers/auth.controller.js`
- Auth routes/schema: `packages/user-service/src/routes/auth.routes.js`, `packages/user-service/src/routes/auth.schema.js`

Điểm trình bày:

- JWT chứa `sub`, `email`, `role`, `permissions`.
- Admin/moderator/student phân quyền bằng role + permissions.
- Frontend tự refresh access token khi sắp hết hạn.

### 6.7 Scalability

Trả lời:

Hệ thống có thể scale theo hai hướng:

- Vertical scaling: tăng CPU/RAM cho EC2/container, phù hợp khi tải nhỏ hoặc deadline demo.
- Horizontal scaling: tăng replicas từng service, dùng Nginx/Kubernetes Service/Ingress để load balance.

Các service stateless như API Gateway, Product, User, Chat HTTP API, Lost Found có thể scale nhiều replica. WebSocket cần sticky session hoặc gateway riêng; hiện Nginx dùng `ip_hash` cho upstream `ws_gateway`.

File:

- Docker service tách riêng: `docker-compose.yml`
- Nginx upstream/load balancing: `infra/nginx/nginx.conf`
- Kubernetes replicas: `k8s/base/deployments.yaml`
- Kubernetes HPA: `k8s/base/hpa.yaml`
- Kubernetes service/ingress: `k8s/base/services.yaml`, `k8s/base/ingress.yaml`

## 7. DevOps

### 7.1 Maintainability

Trả lời:

Code dễ bảo trì vì chia theo service và trong mỗi service lại chia route/controller/service/model/test. Common package chứa middleware, exception, DTO, Redis, Kafka, logger, metrics để tránh lặp code.

File/thư mục:

| Nội dung | File/thư mục |
|---|---|
| Common middleware/auth/error/cache | `packages/common/src` |
| API Gateway | `packages/api-gateway/src` |
| User service | `packages/user-service/src` |
| Product service | `packages/product-service/src` |
| Order service | `packages/order-service/src` |
| Notification service | `packages/notification-service/src` |
| Chat service | `packages/chat-service/src` |
| Lost Found service | `packages/lost-found-service/src` |
| Frontend pages/components/services | `frontend/src/pages`, `frontend/src/components`, `frontend/src/services` |
| Tests | `packages/*/src/__tests__`, `tests/` |

Ví dụ clean separation:

- Product controller không xử lý auth trực tiếp mà dùng middleware chung.
- AI assistant ở `chat-service`, AI autopost/matching ở `lost-found-service`.
- Order saga ở `order-service`, không trộn vào product/user.

### 7.2 Docker Compose

Trả lời:

Dự án có `docker-compose.yml` chạy toàn bộ hệ thống: Nginx, API Gateway, các service Node.js, Redis, Kafka, Zookeeper, Elasticsearch, Prometheus, Grafana, Certbot. Mỗi service có Dockerfile riêng.

File:

- Compose chính: `docker-compose.yml`
- Compose dev: `docker-compose.dev.yml`
- Dockerfiles:
  - `Dockerfile.gateway`
  - `Dockerfile.user-service`
  - `Dockerfile.product-service`
  - `Dockerfile.order-service`
  - `Dockerfile.notification-service`
  - `Dockerfile.chat-service`
  - `Dockerfile.lost-found-service`
  - `Dockerfile.ws-gateway`
  - `frontend/Dockerfile`

Câu lệnh demo:

```bash
docker compose --profile lb up -d --build
docker compose ps
docker logs iuh-api-gateway-node
```

### 7.3 CI/CD

Trả lời:

Dự án dùng GitHub Actions tương đương CI/CD pipeline. CI chạy khi push/pull request: checkout, setup Node, `npm ci`, test backend, install frontend, build frontend. Deploy workflow build Docker image cho từng service và push lên GHCR, sau đó có bước apply Kubernetes manifests nếu có kubeconfig secret.

File:

- CI: `.github/workflows/ci.yml`
- Deploy: `.github/workflows/deploy.yml`
- Kubernetes manifests: `k8s/base/*`

Nếu rubric yêu cầu GitLab CI/Jenkins, có thể trả lời:

Hiện dự án dùng GitHub Actions, vai trò tương đương GitLab CI/Jenkins: tự động build/test/deploy. Nếu chuyển sang GitLab CI, các stage vẫn giống nhau: install -> test -> build image -> push registry -> deploy.

### 7.4 Deploy

Trả lời:

Dự án đã deploy lên AWS EC2 với domain `iuhexchange.site`, Nginx phục vụ HTTPS và proxy API/WebSocket. Docker Compose quản lý container. Frontend được build bằng Vite và mount vào Nginx.

File liên quan:

- Nginx domain/HTTPS: `infra/nginx/nginx.conf`
- Docker Compose production: `docker-compose.yml`
- Frontend build output phục vụ bởi Nginx: `frontend/dist`
- Environment mẫu: `.env.example`

Các lệnh triển khai đã dùng trong thực tế:

```bash
npm run build --prefix frontend
docker compose up -d --build <service-name>
docker exec iuh-nginx-lb nginx -s reload
```

## 8. AI

### 8.1 Apply AI vào bài toán thực tế

Trả lời:

Dự án áp dụng AI vào các bài toán thật của hệ thống:

1. AI Assistant trong chat:
   - Tư vấn đăng bán, định giá, an toàn giao dịch.
   - Tìm sản phẩm, tìm lost-found, xem đơn hàng bằng tool gọi service thật.

2. AI tự động tạo tin mất/nhặt đồ:
   - Người dùng nhắn trong chat và gửi ảnh.
   - Hệ thống tách tiêu đề/vị trí, upload ảnh, gọi `/lost-found/ai-post`.
   - Lost Found Service dùng Gemini để tạo mô tả, category, tags, câu hỏi xác minh.

3. Matching đồ thất lạc:
   - Tính điểm khớp giữa LOST và FOUND dựa trên keyword, category, inferred item type, tags, location.
   - Tự gợi ý vật phẩm có khả năng liên quan.

4. OCR/nhận diện hình ảnh:
   - Lost Found Service có image processor, Tesseract/Vision/Rekognition tùy cấu hình.

File:

- AI Assistant service: `packages/chat-service/src/services/ai-assistant.service.js`
- AI Assistant controller/route: `packages/chat-service/src/controllers/ai-assistant.controller.js`, `packages/chat-service/src/routes/ai-assistant.routes.js`
- UI AI chat: `frontend/src/pages/AiAssistant.tsx`
- Frontend lost-found service: `frontend/src/services/lostFoundService.ts`
- AI autopost: `packages/lost-found-service/src/services/ai-autopost.service.js`
- Lost-found AI endpoint: `packages/lost-found-service/src/controllers/lostfound.controller.js`, `packages/lost-found-service/src/routes/lostfound.routes.js`
- Matching: `packages/lost-found-service/src/services/matching.service.js`
- Image processing/OCR: `packages/lost-found-service/src/services/image-processor.service.js`

### 8.2 AI Agent / workflow tự động

Trả lời:

Dự án có AI Agent dạng tool-calling workflow. Chat Service khai báo các tool:

- `searchProductsTool`
- `searchLostFoundTool`
- `getMyOrdersTool`

Gemini quyết định khi nào gọi tool, hệ thống chạy tool bằng API/service nội bộ, đưa kết quả lại cho model rồi model trả lời người dùng. Đây là workflow tự động vì AI không chỉ trả lời text tĩnh mà có thể truy vấn dữ liệu thật của hệ thống.

File:

- Tool declarations và workflow nhiều vòng: `packages/chat-service/src/services/ai-assistant.service.js`
- Tests cho tool/agent: `packages/chat-service/src/__tests__/ai-assistant.service.test.js`
- Controller nhận request chat AI: `packages/chat-service/src/controllers/ai-assistant.controller.js`
- Frontend gọi AI: `frontend/src/pages/AiAssistant.tsx`, `frontend/src/services/chatService.ts`

Luồng agent:

1. User hỏi: "Tìm tai nghe dưới 1 triệu".
2. AI chọn `searchProductsTool`.
3. Tool gọi Product Service.
4. AI nhận kết quả và tóm tắt sản phẩm phù hợp.

Luồng autopost:

1. User gửi ảnh + nhắn "Mất trái bóng chuyền ở căn tin".
2. Frontend upload ảnh lên S3.
3. Frontend gọi `/lost-found/ai-post`.
4. Lost Found Service gọi Gemini để sinh description/category/tags.
5. Service tạo item và kích hoạt matching/notification.

## 9. Bảng đối chiếu rubric

| Tiêu chí | Cách trả lời | File minh chứng |
|---|---|---|
| Compare architecture | So sánh Microservices với Monolith/Layered, giải thích chọn vì nhiều miền nghiệp vụ và cần scale riêng | `docker-compose.yml`, `packages/*/src/index.js`, `packages/api-gateway/src/config/routes.js` |
| Trade-off | Nêu hiệu năng, chi phí, độ phức tạp, scalability | `packages/api-gateway/src/index.js`, `packages/common/src/utils/cache.js`, `k8s/base/hpa.yaml` |
| Contextual questions | Traffic tăng, downtime, scaling, fault tolerance | `infra/nginx/nginx.conf`, `k8s/base/deployments.yaml`, `packages/api-gateway/src/middleware/circuit-breaker.js` |
| Availability 24/7 | Nginx, healthcheck, restart, replicas, liveness/readiness, PDB | `docker-compose.yml`, `infra/nginx/nginx.conf`, `k8s/base/deployments.yaml`, `k8s/base/pdb.yaml` |
| Performance Redis | Cache-aside, get/set TTL, getOrSet, cache invalidation | `packages/common/src/utils/cache.js`, `packages/common/src/utils/redis.js` |
| Client rate limiter | Sliding window 15 requests/2s, double submit 1.2s | `frontend/src/services/api.ts` |
| Retry 3-5s | Redis retry max 5s, WebSocket reconnect 5s, refresh cooldown 5s | `packages/common/src/utils/redis.js`, `frontend/src/services/chatService.ts`, `frontend/src/services/api.ts` |
| Server rate limiter | Nginx limit_req, API Gateway Redis-backed rate limiter | `infra/nginx/nginx.conf`, `packages/api-gateway/src/index.js` |
| JWT | Bearer token, middleware authenticate/authorize, gateway auth filter, WS token | `packages/common/src/middleware/auth.js`, `packages/api-gateway/src/middleware/auth-filter.js`, `frontend/src/services/api.ts` |
| Scalability | Horizontal scaling replicas/HPA, Nginx upstream, service separation | `k8s/base/hpa.yaml`, `k8s/base/deployments.yaml`, `infra/nginx/nginx.conf` |
| Maintainability | Service-based folder, common package, tests | `packages/common/src`, `packages/*/src`, `frontend/src` |
| Docker Compose | Compose full stack + Dockerfiles | `docker-compose.yml`, `Dockerfile.*`, `frontend/Dockerfile` |
| CI/CD | GitHub Actions build/test/deploy images/K8s | `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` |
| Deploy | AWS EC2 + domain + HTTPS Nginx + Docker Compose | `infra/nginx/nginx.conf`, `docker-compose.yml` |
| AI Apply | Gemini assistant, autopost, OCR/matching | `packages/chat-service/src/services/ai-assistant.service.js`, `packages/lost-found-service/src/services/ai-autopost.service.js`, `packages/lost-found-service/src/services/matching.service.js` |
| AI Agent | Tool-calling workflow: search products/lost-found/orders | `packages/chat-service/src/services/ai-assistant.service.js`, `packages/chat-service/src/__tests__/ai-assistant.service.test.js` |

## 10. Câu trả lời mẫu ngắn khi giảng viên hỏi

### Vì sao không làm monolith cho đơn giản?

Nếu chỉ demo nhỏ thì monolith đơn giản hơn, nhưng hệ thống của em có nhiều miền nghiệp vụ độc lập và tải khác nhau: chat realtime, product search, order, notification, lost-found AI. Microservices giúp scale riêng từng phần, cô lập lỗi và dễ phát triển module. Đổi lại là tăng độ phức tạp triển khai, nên nhóm dùng API Gateway, Docker Compose, healthcheck, Redis, circuit breaker để kiểm soát.

### Nếu Product Service chết thì người dùng có dùng được phần khác không?

Có. Các route liên quan product sẽ lỗi hoặc bị gateway trả `503`, nhưng user/login/chat/lost-found/order vẫn có thể hoạt động nếu service của chúng vẫn healthy. Gateway có circuit breaker để không gọi liên tục vào service đang lỗi.

### Nếu lượng request tăng gấp 10 thì làm gì?

Trước mắt bật/tăng Nginx và Gateway rate limit để chặn spam. Sau đó scale horizontal các service chịu tải bằng Docker/Kubernetes. Product search có thể scale Product Service và Elasticsearch, chat scale WS Gateway/Chat Service, API scale API Gateway. Redis cache giúp giảm truy vấn database.

### Redis dùng để làm gì?

Redis dùng cho cache và rate limiter. Cache giúp đọc nhanh object/list, giảm tải MongoDB. Rate limiter dùng Redis Store để nhiều instance gateway vẫn chia sẻ cùng bộ đếm request.

### AI Agent nằm ở đâu?

AI Agent nằm trong Chat Service. File `packages/chat-service/src/services/ai-assistant.service.js` khai báo tool `searchProductsTool`, `searchLostFoundTool`, `getMyOrdersTool`. Gemini chọn tool, backend gọi dữ liệu thật, rồi AI tóm tắt trả lời người dùng.

### Hệ thống đã deploy chưa?

Đã deploy lên AWS EC2 với domain `iuhexchange.site`, Nginx cấu hình HTTPS và reverse proxy. Docker Compose chạy các container backend/frontend/infrastructure.

