# Q&A theo chủ đề: AI, DevOps, giao diện, registry, WS Gateway, API Gateway

Tài liệu này tập trung vào các câu hỏi giảng viên hay hỏi sâu về từng mảng trong dự án IUH Exchange.

## 1. AI tích hợp

### Câu 1: Dự án tích hợp AI ở những đâu?

Dự án tích hợp AI ở 4 điểm chính: AI Assistant để tư vấn và tìm kiếm, AI Agent có tool-calling, AI tự tạo tin mất/nhặt đồ từ chat và ảnh, và AI/OCR hỗ trợ phân tích ảnh lost-found.

File liên quan:

- `frontend/src/pages/AiAssistant.tsx`
- `packages/chat-service/src/services/ai-assistant.service.js`
- `packages/lost-found-service/src/services/ai-autopost.service.js`
- `packages/lost-found-service/src/services/image-processor.service.js`
- `packages/lost-found-service/src/services/matching.service.js`

### Câu 2: AI Assistant khác chatbot thường ở điểm nào?

Chatbot thường chỉ nhận text rồi trả lời text. AI Assistant trong dự án có thể dùng tool để truy vấn dữ liệu thật của hệ thống như sản phẩm, tin lost-found và đơn hàng của user. Vì vậy nó gần với AI Agent hơn chatbot tĩnh.

File liên quan: `packages/chat-service/src/services/ai-assistant.service.js`.

### Câu 3: AI Agent trong dự án có những tool nào?

AI Agent có 3 tool chính:

- `searchProductsTool`: tìm sản phẩm.
- `searchLostFoundTool`: tìm tin mất/nhặt đồ.
- `getMyOrdersTool`: xem đơn hàng của người dùng đang đăng nhập.

File liên quan: `packages/chat-service/src/services/ai-assistant.service.js`.

### Câu 4: Luồng AI Agent hoạt động như thế nào?

Người dùng gửi câu hỏi cho AI. Gemini phân tích câu hỏi và nếu cần dữ liệu thật thì yêu cầu gọi tool. Backend chạy tool tương ứng, đưa kết quả lại cho Gemini. Sau đó Gemini tổng hợp câu trả lời cuối cùng cho người dùng.

File liên quan:

- `packages/chat-service/src/controllers/ai-assistant.controller.js`
- `packages/chat-service/src/services/ai-assistant.service.js`
- `frontend/src/services/chatService.ts`

### Câu 5: Vì sao cần tool-calling thay vì để AI tự trả lời?

Nếu AI tự trả lời thì dễ bịa dữ liệu. Tool-calling giúp AI lấy dữ liệu thật từ Product Service, Lost Found Service hoặc Order Service. Nhờ đó câu trả lời có căn cứ hơn và phù hợp trạng thái hiện tại của hệ thống.

### Câu 6: AI tự tạo tin mất/nhặt đồ hoạt động ra sao?

Người dùng gửi ảnh và mô tả trong trang AI. Frontend tách loại tin, tiêu đề và vị trí, upload ảnh, rồi gọi endpoint `/lost-found/ai-post`. Lost Found Service dùng Gemini để sinh mô tả, category, tags và câu hỏi xác minh, sau đó lưu bài đăng.

File liên quan:

- `frontend/src/pages/AiAssistant.tsx`
- `frontend/src/services/lostFoundService.ts`
- `packages/lost-found-service/src/controllers/lostfound.controller.js`
- `packages/lost-found-service/src/services/ai-autopost.service.js`

### Câu 7: Nếu Gemini bị lỗi thì tính năng AI autopost có chết không?

Không chết hoàn toàn. Lost Found Service có fallback local. Nếu Gemini lỗi hoặc không trả kết quả, service vẫn tạo draft cơ bản dựa trên input của người dùng.

File liên quan: `packages/lost-found-service/src/services/ai-autopost.service.js`.

### Câu 8: Dự án có kiểm soát AI hallucination không?

Có. Với AI Assistant, dữ liệu quan trọng được lấy bằng tool từ service thật. Với AI autopost, backend vẫn validate schema, giới hạn category/type, ưu tiên title/location đã tách từ frontend và có fallback local. AI không được tự ý bypass rule nghiệp vụ.

File liên quan:

- `packages/chat-service/src/services/ai-assistant.service.js`
- `packages/lost-found-service/src/controllers/lostfound.controller.js`
- `packages/lost-found-service/src/services/ai-autopost.service.js`

### Câu 9: AI có đọc ảnh trực tiếp không?

Trong luồng lost-found, ảnh được upload lên storage và gửi URL cho service. Image Processor có thể dùng OCR/Tesseract hoặc provider khác tùy cấu hình để trích xuất thông tin. AI autopost cũng nhận `imageUrls` để tạo nội dung phù hợp.

File liên quan:

- `packages/lost-found-service/src/services/image-processor.service.js`
- `packages/lost-found-service/src/services/ai-autopost.service.js`
- `frontend/src/pages/AiAssistant.tsx`

### Câu 10: Matching đồ thất lạc có phải AI không?

Không hoàn toàn. Matching dùng scoring có kiểm soát dựa trên keyword, category, inferred item type, tags và location. AI/OCR chỉ hỗ trợ nhận diện nội dung ảnh hoặc tạo metadata. Cách này giúp tránh match quá rộng và dễ giải thích hơn.

File liên quan: `packages/lost-found-service/src/services/matching.service.js`.

### Câu 11: Vì sao không để AI quyết định luôn item nào match item nào?

Vì AI có thể trả lời không ổn định và khó kiểm soát. Matching lost-found cần tính nhất quán, dễ giải thích và tránh gợi ý sai quá nhiều. Vì vậy dự án dùng rule/scoring làm lõi, AI chỉ hỗ trợ metadata.

### Câu 12: AI Assistant có giới hạn gì?

AI phụ thuộc API key, latency của Gemini và chất lượng prompt/tool. Nếu service đích chậm hoặc Gemini lỗi thì phản hồi chậm/lỗi. Ngoài ra AI chỉ hỗ trợ người dùng, không thay thế quyết định admin hoặc rule nghiệp vụ.

### Câu 13: Làm sao test AI Agent?

Dự án có test cho AI Assistant service và controller. Test mock Gemini/tool response để kiểm tra tool-calling workflow, không phụ thuộc hoàn toàn vào API thật.

File liên quan:

- `packages/chat-service/src/__tests__/ai-assistant.service.test.js`
- `packages/chat-service/src/__tests__/ai-assistant.controller.test.js`

### Câu 14: AI có liên quan tới quyền người dùng không?

Có. Endpoint AI chat cần đăng nhập. Tool `getMyOrdersTool` cần auth header để lấy đơn hàng của chính người dùng. Lost-found autopost cũng cần quyền đăng/tạo tin theo JWT/permission.

File liên quan:

- `packages/chat-service/src/controllers/ai-assistant.controller.js`
- `packages/chat-service/src/services/ai-assistant.service.js`
- `packages/lost-found-service/src/routes/lostfound.routes.js`

### Câu 15: Vì sao AI autopost nằm ở Lost Found Service chứ không nằm hết ở Chat Service?

Chat Service phụ trách hội thoại và AI Agent chung. Lost Found Service sở hữu nghiệp vụ đồ thất lạc, schema, validation, matching và tạo bài đăng. Đưa autopost vào Lost Found Service giúp logic tạo bài và validate dữ liệu nằm đúng bounded context.

## 2. DevOps

### Câu 16: DevOps trong dự án gồm những gì?

DevOps gồm Docker Compose để chạy toàn bộ hệ thống, Dockerfile riêng cho từng service, GitHub Actions CI/CD, deploy lên AWS EC2, Nginx HTTPS/reverse proxy, healthcheck, monitoring bằng Prometheus/Grafana và Kubernetes manifests cho hướng scale production.

File liên quan:

- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `infra/nginx/nginx.conf`
- `k8s/base/*`
- `infra/monitoring/*`

### Câu 17: Docker Compose dùng để làm gì?

Docker Compose giúp chạy toàn bộ hệ thống bằng container trên một máy: Nginx, API Gateway, các service Node.js, Redis, Kafka, Elasticsearch, Prometheus, Grafana. Nó giúp môi trường chạy nhất quán và dễ deploy demo.

File liên quan: `docker-compose.yml`.

### Câu 18: Vì sao mỗi service có Dockerfile riêng?

Mỗi service là một đơn vị triển khai độc lập. Dockerfile riêng giúp build image riêng, deploy riêng và scale riêng. Điều này phù hợp Microservices.

File liên quan:

- `Dockerfile.gateway`
- `Dockerfile.user-service`
- `Dockerfile.product-service`
- `Dockerfile.order-service`
- `Dockerfile.notification-service`
- `Dockerfile.chat-service`
- `Dockerfile.lost-found-service`
- `Dockerfile.ws-gateway`
- `frontend/Dockerfile`

### Câu 19: CI của dự án làm gì?

CI chạy khi push/pull request. Nó checkout code, setup Node.js, chạy `npm ci`, chạy backend test, cài frontend dependencies và build frontend. Mục tiêu là phát hiện lỗi trước khi merge/deploy.

File liên quan: `.github/workflows/ci.yml`.

### Câu 20: CD/deploy workflow làm gì?

Deploy workflow build Docker image cho từng service, push image lên GitHub Container Registry, rồi apply Kubernetes manifests nếu có `KUBE_CONFIG` secret.

File liên quan: `.github/workflows/deploy.yml`.

### Câu 21: Nếu rubric yêu cầu GitLab CI/Jenkins thì trả lời thế nào?

Dự án dùng GitHub Actions, vai trò tương đương GitLab CI/Jenkins. Các stage vẫn giống nhau: install, test, build image, push registry, deploy. Nếu cần chuyển sang GitLab/Jenkins thì chỉ đổi syntax pipeline, logic không đổi.

### Câu 22: Deploy thật đang ở đâu?

Hệ thống đã deploy lên AWS EC2 với domain `iuhexchange.site`. Nginx xử lý HTTPS, frontend static, `/api` proxy về API Gateway và `/ws` proxy về WebSocket Gateway. Backend chạy bằng Docker Compose.

File liên quan:

- `infra/nginx/nginx.conf`
- `docker-compose.yml`

### Câu 23: Healthcheck dùng để làm gì?

Healthcheck giúp Docker/Kubernetes biết service còn hoạt động không. Nếu service lỗi, container/pod có thể được restart hoặc không nhận traffic. Gateway cũng có endpoint `/health` để kiểm tra downstream services.

File liên quan:

- `docker-compose.yml`
- `packages/api-gateway/src/index.js`
- `k8s/base/deployments.yaml`

### Câu 24: Monitoring có những gì?

Dự án có Prometheus để thu metrics và Grafana để xem dashboard. Common package có metrics middleware để service expose metrics.

File liên quan:

- `packages/common/src/utils/metrics.js`
- `infra/monitoring/prometheus/prometheus.yml`
- `infra/monitoring/grafana/dashboards/iuh-exchange.json`

### Câu 25: Khi deploy service mới, làm sao giảm downtime?

Với Docker Compose, rebuild container có thể gây gián đoạn ngắn. Hướng production tốt hơn là dùng Kubernetes rolling update, nhiều replicas, readiness probe và PDB. Pod mới ready thì mới nhận traffic.

File liên quan:

- `k8s/base/deployments.yaml`
- `k8s/base/pdb.yaml`

### Câu 26: Vì sao dùng `.env.example`?

`.env.example` giúp mô tả các biến môi trường cần có mà không commit secret thật. Người deploy copy thành `.env` rồi điền credential riêng.

File liên quan: `.env.example`.

### Câu 27: Những secret nào không nên commit?

JWT secret, MongoDB URI, Redis password, AWS/S3 key, SMTP credential, Firebase service account, Gemini API key. README cũng nhắc không commit credential.

File liên quan: `.gitignore`, `README.md`, `.env.example`.

## 3. Giao diện frontend

### Câu 28: Frontend dùng công nghệ gì?

Frontend dùng React, TypeScript, Vite, Tailwind CSS, Zustand/store và các component UI tự xây dựng. Giao diện gồm trang người dùng, admin dashboard, moderation dashboard, chat, AI assistant, product/lost-found/order.

File liên quan:

- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/index.css`
- `frontend/src/pages/*`
- `frontend/src/components/*`

### Câu 29: Frontend gọi API như thế nào?

Frontend dùng Axios instance trong `frontend/src/services/api.ts`. Base URL tự suy luận theo domain hiện tại: `${window.location.origin}/api/v1`, hoặc dùng `VITE_API_URL` nếu cấu hình riêng.

File liên quan: `frontend/src/services/api.ts`.

### Câu 30: Frontend xử lý JWT thế nào?

Frontend lấy access token từ localStorage, gắn vào header `Authorization`. Nếu token sắp hết hạn hoặc request bị 401, interceptor gọi refresh token. Nếu refresh thất bại thì logout.

File liên quan: `frontend/src/services/api.ts`.

### Câu 31: Frontend có chống spam request không?

Có. Axios interceptor có sliding window rate limiter: tối đa 15 request trong 2 giây. Với mutation như POST/PUT/PATCH/DELETE, frontend chặn double submit trong 1.2 giây.

File liên quan: `frontend/src/services/api.ts`.

### Câu 32: Giao diện admin nằm ở đâu?

Admin Dashboard nằm ở `frontend/src/pages/AdminDashboard.tsx`, layout workspace ở `frontend/src/pages/AdminWorkspace.tsx`, login admin ở `frontend/src/pages/AdminLogin.tsx`.

### Câu 33: Giao diện moderation nằm ở đâu?

Moderation Dashboard nằm ở `frontend/src/pages/ModerationDashboard.tsx`. Trang này dành cho moderator/admin xử lý bài duyệt, bài đã duyệt, lost-found, report, khóa người dùng.

### Câu 34: Giao diện AI Assistant nằm ở đâu?

AI Assistant nằm ở `frontend/src/pages/AiAssistant.tsx`. Trang này cho phép chat với AI, gửi ảnh, tự tạo tin lost-found và gọi AI tools.

### Câu 35: Chat popup frontend nằm ở đâu?

Chat UI gồm ChatManager, ChatWindow và ChatList. ChatManager quản lý mở/đóng popup, ChatWindow hiển thị hội thoại, ChatList hiển thị danh sách cuộc trò chuyện.

File liên quan:

- `frontend/src/components/ChatManager.tsx`
- `frontend/src/components/ChatWindow.tsx`
- `frontend/src/components/ChatList.tsx`
- `frontend/src/services/chatService.ts`

### Câu 36: Frontend route được khai báo ở đâu?

Route chính được khai báo trong `frontend/src/App.tsx`. Layout chung nằm trong `frontend/src/components/Layout.tsx`.

### Câu 37: Giao diện có responsive không?

Có. Frontend dùng Tailwind responsive classes như `sm:`, `md:`, `lg:`, grid/flex responsive. Các trang admin/moderation/product/lost-found đều được chỉnh để hiển thị tốt hơn trên nhiều kích thước màn hình.

### Câu 38: Giao diện có liên quan đến PWA không?

Có manifest và service worker public. Điều này hỗ trợ cache static/PWA cơ bản.

File liên quan:

- `frontend/public/manifest.json`
- `frontend/public/sw.js`

### Câu 39: Giao diện thông báo realtime lấy dữ liệu từ đâu?

Thông báo realtime nhận qua WebSocket/STOMP `/user/queue/notifications` và API notification service. Layout/ChatManager cập nhật UI khi nhận event.

File liên quan:

- `frontend/src/components/Layout.tsx`
- `frontend/src/services/chatService.ts`
- `frontend/src/services/notificationService.ts`

## 4. Registry và container image

### Câu 40: Registry trong dự án là gì?

Registry là nơi lưu Docker images sau khi build. Dự án dùng GitHub Container Registry, viết tắt GHCR, với image tag dạng `ghcr.io/<owner>/iuh-exchange-<service>:latest` và tag theo commit SHA.

File liên quan: `.github/workflows/deploy.yml`.

### Câu 41: Vì sao cần registry?

Registry giúp lưu trữ image build sẵn để server/Kubernetes pull về deploy. Nhờ đó môi trường deploy không cần build lại từ source và có thể rollback theo tag/commit.

### Câu 42: Deploy workflow push những image nào?

Workflow build và push image cho:

- `api-gateway`
- `ws-gateway`
- `user-service`
- `product-service`
- `order-service`
- `notification-service`
- `chat-service`
- `lost-found-service`
- `frontend`

File liên quan: `.github/workflows/deploy.yml`.

### Câu 43: Image tag theo SHA có lợi gì?

Tag theo SHA giúp truy vết chính xác version code nào tạo ra image nào. Nếu release lỗi, có thể rollback về image của commit trước đó.

### Câu 44: Image `latest` có nhược điểm gì?

`latest` dễ dùng nhưng không rõ chính xác version. Trong production nên dùng tag SHA hoặc version tag để rollback và audit tốt hơn.

### Câu 45: Kubernetes manifests dùng registry thế nào?

Deployment YAML khai báo image dạng `ghcr.io/your-org/iuh-exchange-...:latest`. Deploy workflow có bước thay `your-org` bằng GitHub repository owner hiện tại.

File liên quan:

- `k8s/base/deployments.yaml`
- `.github/workflows/deploy.yml`

### Câu 46: Nếu registry bị private thì server pull image thế nào?

Cần cấu hình image pull secret hoặc login registry trên server/cluster. Với GHCR, có thể dùng GitHub token/package read permission để pull private images.

### Câu 47: Docker Compose hiện tại dùng registry hay build local?

Docker Compose hiện tại chủ yếu build local từ Dockerfile trong repo. Deploy workflow thì build/push lên GHCR cho hướng Kubernetes/production image registry.

File liên quan: `docker-compose.yml`, `.github/workflows/deploy.yml`.

## 5. WS Gateway

### Câu 48: WS Gateway là gì?

WS Gateway là service trung gian xử lý WebSocket/SockJS traffic. Nó tách realtime connection khỏi API Gateway HTTP thông thường, giúp quản lý chat/notification realtime rõ ràng hơn.

File liên quan:

- `packages/ws-gateway/src/index.js`
- `packages/ws-gateway/src/services/socket.service.js`
- `Dockerfile.ws-gateway`

### Câu 49: Vì sao cần WS Gateway riêng?

WebSocket là kết nối dài và có đặc thù khác HTTP request. Tách WS Gateway giúp tránh làm API Gateway phức tạp, dễ scale realtime riêng và dễ cấu hình sticky/session/proxy riêng.

### Câu 50: Nginx route WebSocket thế nào?

Nginx route `/ws/` về upstream `ws_gateway`, bật `proxy_http_version 1.1`, set `Upgrade` và `Connection upgrade`, đồng thời đặt timeout dài cho kết nối realtime.

File liên quan: `infra/nginx/nginx.conf`.

### Câu 51: Gateway route `/ws` thế nào?

API Gateway cũng có SockJS proxy `/ws` đến WS Gateway. Nó hỗ trợ cả HTTP-based SockJS transports và WebSocket upgrade, đồng thời verify JWT khi upgrade.

File liên quan: `packages/api-gateway/src/index.js`.

### Câu 52: Frontend kết nối WebSocket ra sao?

Frontend dùng SockJS và STOMP. URL được suy luận từ `window.location.origin + /ws`, hoặc dùng `VITE_WS_URL`. Token được gắn vào query string và STOMP connect header.

File liên quan: `frontend/src/services/chatService.ts`.

### Câu 53: WebSocket có reconnect không?

Có. Khi mất kết nối, frontend reconnect sau 5 giây. Nếu user gửi message khi chưa connect, frame được đưa vào pending queue và flush khi kết nối lại.

File liên quan: `frontend/src/services/chatService.ts`.

### Câu 54: WebSocket dùng heartbeat để làm gì?

Heartbeat giữ kết nối sống và giúp phát hiện kết nối chết. Frontend cấu hình heartbeat outgoing/incoming 25 giây để phù hợp server.

File liên quan: `frontend/src/services/chatService.ts`.

### Câu 55: Chat realtime nhận message ở channel nào?

Frontend subscribe `/user/queue/messages` để nhận tin nhắn riêng và `/user/queue/notifications` để nhận thông báo. Ngoài ra có `/topic/chat/{conversationId}` cho hội thoại cụ thể.

File liên quan: `frontend/src/services/chatService.ts`.

### Câu 56: Vì sao Nginx dùng `ip_hash` cho WebSocket upstream?

`ip_hash` giúp cùng một client có xu hướng vào cùng một upstream WS instance. Điều này hữu ích cho kết nối realtime/sticky session khi chưa có state sharing phức tạp.

File liên quan: `infra/nginx/nginx.conf`.

### Câu 57: Nếu WS Gateway chết thì chuyện gì xảy ra?

Kết nối realtime bị mất, nhưng frontend sẽ reconnect. Các API HTTP khác vẫn hoạt động qua API Gateway nếu services còn healthy. Trong production nên chạy nhiều WS Gateway replicas.

File liên quan: `k8s/base/deployments.yaml`, `k8s/base/hpa.yaml`.

## 6. API Gateway

### Câu 58: API Gateway trong dự án làm những việc gì?

API Gateway xử lý routing, JWT auth, optional auth, rate limiting, circuit breaker, request logging, correlation id, metrics, CORS, security headers, health check và proxy WebSocket/SockJS.

File liên quan: `packages/api-gateway/src/index.js`.

### Câu 59: Route table của API Gateway nằm ở đâu?

Route table nằm ở `packages/api-gateway/src/config/routes.js`. File này định nghĩa path nào đi service nào, route public hay protected, dùng limiter nào và method nào được public.

### Câu 60: API Gateway biết request đi service nào bằng cách nào?

Gateway duyệt route table. Ví dụ `/api/v1/products` đi Product Service, `/api/v1/orders` đi Order Service, `/api/v1/chat` đi Chat Service, `/api/v1/lost-found` đi Lost Found Service.

File liên quan: `packages/api-gateway/src/config/routes.js`.

### Câu 61: Public route và protected route khác nhau thế nào?

Public route có thể truy cập không cần JWT, thường là GET sản phẩm/lost-found hoặc auth login/register. Protected route cần JWT hợp lệ, ví dụ tạo sản phẩm, đặt hàng, chat, notification, admin.

File liên quan: `packages/api-gateway/src/config/routes.js`, `packages/api-gateway/src/middleware/auth-filter.js`.

### Câu 62: API Gateway xác thực JWT thế nào?

Gateway dùng `authFilter` để verify Bearer token. Nếu token hợp lệ, gateway gắn user info vào request header để downstream service biết user.

File liên quan: `packages/api-gateway/src/middleware/auth-filter.js`.

### Câu 63: Vì sao Gateway cần optional auth?

Một số endpoint public vẫn có thể cần biết user nếu đã đăng nhập, ví dụ xem sản phẩm nhưng muốn biết sản phẩm đã lưu chưa. Optional auth không bắt buộc token nhưng nếu có token hợp lệ thì gắn user vào request.

File liên quan: `packages/api-gateway/src/middleware/auth-filter.js`.

### Câu 64: API Gateway rate limit thế nào?

Gateway dùng `express-rate-limit` với Redis Store. Có 3 nhóm limiter: global, auth và sensitive. Route nào dùng limiter nào được khai báo trong route table.

File liên quan:

- `packages/api-gateway/src/index.js`
- `packages/api-gateway/src/config/routes.js`

### Câu 65: Vì sao dùng Redis Store cho rate limiter?

Redis Store giúp nhiều instance API Gateway dùng chung bộ đếm request. Nếu dùng memory local, mỗi instance có bộ đếm riêng và rate limit không chính xác khi scale horizontal.

### Câu 66: Circuit breaker của Gateway dùng để làm gì?

Circuit breaker giúp bảo vệ Gateway và service lỗi. Khi upstream service lỗi nhiều lần, Gateway không gọi tiếp mà trả `503` nhanh. Sau reset timeout, nó thử lại bằng trạng thái half-open.

File liên quan: `packages/api-gateway/src/middleware/circuit-breaker.js`.

### Câu 67: Gateway health check kiểm tra gì?

Endpoint `/health` của Gateway ping tất cả downstream services, trả trạng thái reachable và latency. `/health/live` kiểm tra gateway còn sống, `/health/ready` kiểm tra Redis connectivity.

File liên quan: `packages/api-gateway/src/index.js`.

### Câu 68: Correlation ID trong Gateway là gì?

Correlation ID là request id gắn vào mỗi request. Gateway tạo hoặc nhận `X-Request-ID`, log request và forward id này xuống service để trace lỗi xuyên service.

File liên quan: `packages/api-gateway/src/middleware/request-logger.js`.

### Câu 69: Gateway có xử lý CORS và security headers không?

Có. Gateway dùng `helmet` để set security headers và `cors` để cấu hình origin, methods, allowed headers, credentials.

File liên quan: `packages/api-gateway/src/index.js`.

### Câu 70: Nếu downstream service timeout thì Gateway làm gì?

Proxy middleware có timeout/proxyTimeout 30 giây. Nếu upstream lỗi hoặc timeout, gateway ghi nhận failure cho circuit breaker và trả lỗi upstream unavailable.

File liên quan: `packages/api-gateway/src/index.js`.

### Câu 71: Gateway có parse body mọi request không?

Gateway tránh parse body cho `/api/v1` và `/ws` trước proxy để không làm hỏng stream/proxy body. Khi proxy request, `fixRequestBody` được dùng để đảm bảo body chuyển tiếp đúng.

File liên quan: `packages/api-gateway/src/index.js`.

### Câu 72: Nếu thêm service mới thì cần sửa đâu?

Cần thêm service URL vào `SERVICES`, thêm route vào `routes`, tạo Dockerfile/service trong `docker-compose.yml`, thêm deployment nếu dùng Kubernetes, và cập nhật frontend service nếu cần.

File liên quan:

- `packages/api-gateway/src/config/routes.js`
- `docker-compose.yml`
- `k8s/base/deployments.yaml`

### Câu 73: API Gateway có phải single point of failure không?

Nếu chỉ chạy một instance thì có. Vì vậy trong Kubernetes có thể chạy nhiều replicas API Gateway và HPA. Nginx/Kubernetes Service sẽ load balance đến các replicas.

File liên quan: `k8s/base/deployments.yaml`, `k8s/base/hpa.yaml`.

### Câu 74: Gateway khác Nginx như thế nào?

Nginx xử lý tầng edge: HTTPS, static files, reverse proxy và limit request cơ bản. API Gateway xử lý tầng application: JWT, route table, rate limiter theo loại route, circuit breaker, metrics, request id.

### Câu 75: Tại sao không để frontend gọi thẳng từng service?

Nếu frontend gọi thẳng từng service thì khó bảo mật, khó CORS, khó rate limit và lộ topology nội bộ. API Gateway tạo một endpoint thống nhất, che giấu service nội bộ và tập trung bảo vệ API.

## 7. Câu hỏi tổng hợp dễ bị hỏi

### Câu 76: AI Assistant gọi API qua Gateway hay gọi service trực tiếp?

Frontend gọi `/api/v1/chat/ai` qua API Gateway. Bên trong Chat Service, các tool có thể gọi service nội bộ hoặc API Gateway tùy tool. Ví dụ `getMyOrdersTool` dùng auth header để gọi gateway/order endpoint.

File liên quan: `frontend/src/services/chatService.ts`, `packages/chat-service/src/services/ai-assistant.service.js`.

### Câu 77: Nếu AI Agent gọi Product Service mà Product Service chết thì sao?

Tool sẽ lỗi và service trả error trong tool result. AI có thể trả lời người dùng rằng không lấy được dữ liệu hiện tại. Đồng thời Gateway/circuit breaker bảo vệ request public từ client. Hướng tốt hơn là thêm fallback/cache cho tool.

### Câu 78: Nếu frontend bị spam nút gửi chat thì chống ở đâu?

Frontend có client rate limiter trong Axios cho API call, chat websocket có queue/reconnect. Server vẫn cần rate limit ở Gateway cho HTTP và có thể bổ sung rate limit cho STOMP message nếu cần.

File liên quan: `frontend/src/services/api.ts`, `frontend/src/services/chatService.ts`, `packages/api-gateway/src/index.js`.

### Câu 79: Nếu deploy image lỗi thì rollback thế nào?

Nếu dùng GHCR tag theo SHA, có thể rollback deployment về image tag của commit trước. Nếu dùng Docker Compose build local, có thể checkout commit trước rồi rebuild/restart service.

File liên quan: `.github/workflows/deploy.yml`.

### Câu 80: Nếu giao diện gọi API bị 401 thì xử lý thế nào?

Axios response interceptor gọi refresh token. Nếu refresh thành công thì retry request ban đầu. Nếu refresh thất bại với 400/401/403 thì xóa access token và chuyển về login.

File liên quan: `frontend/src/services/api.ts`.

