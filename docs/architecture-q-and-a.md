# Câu hỏi và trả lời về kiến trúc IUH Exchange

Tài liệu này dùng để luyện trả lời vấn đáp kiến trúc. Mỗi câu trả lời được viết theo hướng ngắn gọn, dễ nói, có thể mở rộng thêm nếu giảng viên hỏi sâu.

## 1. Tổng quan kiến trúc

### Câu 1: Hệ thống của em đang dùng kiến trúc gì?

Hệ thống dùng kiến trúc Microservices. Các chức năng lớn được tách thành nhiều service độc lập như User Service, Product Service, Order Service, Notification Service, Chat Service, Lost Found Service. Bên ngoài có Nginx và API Gateway làm điểm vào duy nhất cho client. Frontend là React SPA.

File liên quan: `docker-compose.yml`, `packages/api-gateway/src/index.js`, `packages/api-gateway/src/config/routes.js`.

### Câu 2: Vì sao em chọn Microservices?

Vì hệ thống có nhiều miền nghiệp vụ khác nhau và có tải khác nhau. Ví dụ chat realtime, tìm kiếm sản phẩm, đơn hàng, thông báo và đồ thất lạc không nên nằm chung một khối lớn. Microservices giúp tách trách nhiệm, dễ scale riêng từng phần và cô lập lỗi tốt hơn.

### Câu 3: Nếu làm Monolith thì có được không?

Có thể làm được nếu hệ thống nhỏ hoặc chỉ cần MVP. Monolith dễ triển khai, dễ debug và chi phí thấp hơn. Nhưng khi hệ thống có nhiều chức năng realtime, AI, tìm kiếm, đơn hàng và thông báo, Monolith sẽ khó scale riêng từng phần và một lỗi có thể ảnh hưởng toàn bộ ứng dụng.

### Câu 4: Điểm yếu lớn nhất của Microservices trong dự án là gì?

Điểm yếu lớn nhất là độ phức tạp vận hành. Phải quản lý nhiều container, nhiều service, network nội bộ, gateway, logging, health check và CI/CD. Debug cũng khó hơn vì một request có thể đi qua Nginx, Gateway rồi mới đến service.

### Câu 5: API Gateway có vai trò gì?

API Gateway là điểm vào chính của backend. Nó nhận request từ client, kiểm tra JWT, áp dụng rate limiter, ghi log, gắn request id, kiểm tra circuit breaker rồi chuyển request đến service phù hợp.

File liên quan: `packages/api-gateway/src/index.js`, `packages/api-gateway/src/config/routes.js`.

### Câu 6: Vì sao cần Nginx nếu đã có API Gateway?

Nginx đứng ở lớp ngoài cùng để xử lý HTTPS, redirect HTTP sang HTTPS, phục vụ frontend static, reverse proxy `/api` đến API Gateway và `/ws` đến WebSocket Gateway. API Gateway tập trung vào routing nghiệp vụ và bảo vệ API.

File liên quan: `infra/nginx/nginx.conf`.

### Câu 7: Kiến trúc này có phải event-driven không?

Hệ thống là Microservices có kết hợp event-driven. Một số luồng như notification, karma hoặc saga đơn hàng dùng Kafka để xử lý bất đồng bộ. Tuy nhiên không phải toàn bộ hệ thống đều event-driven, vì nhiều API vẫn gọi đồng bộ qua HTTP.

File liên quan: `packages/common/src/utils/kafka.js`, `packages/order-service/src/services/saga.service.js`, `packages/notification-service/src/services/kafka-consumer.service.js`.

## 2. So sánh kiến trúc

### Câu 8: So sánh Microservices và Monolith trong dự án này?

Monolith đơn giản hơn, deploy dễ hơn, chi phí thấp hơn. Nhưng Monolith khó scale riêng từng phần và lỗi một module có thể ảnh hưởng cả hệ thống. Microservices phức tạp hơn nhưng phù hợp hơn vì hệ thống có nhiều chức năng độc lập như chat, product, order, notification và lost-found AI.

### Câu 9: Khi nào nên chọn Monolith thay vì Microservices?

Khi hệ thống còn nhỏ, team ít người, nghiệp vụ chưa ổn định và chưa có nhu cầu scale riêng từng module. Với giai đoạn rất đầu, Monolith giúp phát triển nhanh và giảm chi phí vận hành.

### Câu 10: Khi nào Microservices trở nên đáng giá?

Khi hệ thống có nhiều module độc lập, nhiều nhóm cùng phát triển, tải giữa các module khác nhau, cần deploy riêng từng phần và cần fault isolation. Trong IUH Exchange, chat realtime và lost-found AI có đặc thù khác product/order nên tách service là hợp lý.

### Câu 11: Dự án có dùng layered architecture không?

Có, nhưng layered architecture nằm bên trong từng service. Ví dụ mỗi service vẫn có route, controller, service, model và test. Ở cấp hệ thống thì kiến trúc chính là Microservices.

File liên quan: `packages/product-service/src/controllers`, `packages/product-service/src/services`, `packages/product-service/src/models`.

## 3. Trade-off

### Câu 12: Trade-off lớn nhất của kiến trúc này là gì?

Trade-off lớn nhất là đổi độ đơn giản lấy khả năng mở rộng và cô lập lỗi. Microservices giúp scale và bảo trì theo module tốt hơn, nhưng chi phí triển khai, monitoring, debug và network communication cao hơn.

### Câu 13: Kiến trúc này ảnh hưởng hiệu năng thế nào?

So với Monolith, Microservices có thêm network hop nên có thể tăng latency. Nhưng hệ thống bù lại bằng Redis cache, Elasticsearch cho tìm kiếm, Nginx static caching và khả năng scale riêng service chịu tải.

File liên quan: `packages/common/src/utils/cache.js`, `infra/nginx/nginx.conf`.

### Câu 14: Kiến trúc này ảnh hưởng chi phí thế nào?

Chi phí cao hơn Monolith vì chạy nhiều container và nhiều hạ tầng phụ như Redis, Kafka, Elasticsearch, Prometheus, Grafana. Tuy nhiên đổi lại hệ thống dễ mở rộng và dễ cô lập lỗi hơn.

### Câu 15: Vì sao không dùng serverless?

Serverless phù hợp các tác vụ ngắn, ít trạng thái. Dự án có WebSocket realtime, Kafka, nhiều service nội bộ và một số luồng cần chạy liên tục, nên container-based deployment phù hợp hơn. Tuy nhiên một số tác vụ nền như xử lý ảnh hoặc gửi email có thể tách sang serverless trong tương lai.

## 4. Availability và downtime

### Câu 16: Hệ thống đảm bảo 24/7 như thế nào?

Hệ thống dùng Nginx làm reverse proxy, Docker Compose có `restart: unless-stopped`, mỗi service có healthcheck. Với Kubernetes, mỗi service có nhiều replicas, liveness/readiness probes và PodDisruptionBudget để giảm downtime khi update hoặc bảo trì.

File liên quan: `docker-compose.yml`, `k8s/base/deployments.yaml`, `k8s/base/pdb.yaml`.

### Câu 17: Nếu một service bị chết thì hệ thống có chết hết không?

Không nhất thiết. Nếu Product Service chết thì các chức năng product bị ảnh hưởng, nhưng user, chat, notification hoặc lost-found vẫn có thể hoạt động nếu service của chúng còn sống. Gateway có circuit breaker để không gọi liên tục vào service đang lỗi.

File liên quan: `packages/api-gateway/src/middleware/circuit-breaker.js`.

### Câu 18: Circuit breaker hoạt động thế nào?

Khi một service lỗi nhiều lần liên tiếp, circuit breaker chuyển sang OPEN và Gateway trả lỗi nhanh thay vì tiếp tục gọi service lỗi. Sau một khoảng reset timeout, nó chuyển sang HALF_OPEN để thử lại. Nếu thử thành công thì quay về CLOSED.

File liên quan: `packages/api-gateway/src/middleware/circuit-breaker.js`.

### Câu 19: Nếu API Gateway chết thì sao?

API Gateway là điểm vào chính nên nếu chỉ có một instance thì sẽ ảnh hưởng lớn. Vì vậy hướng production là chạy nhiều replicas sau Nginx/Kubernetes Service. Trong manifest Kubernetes, API Gateway có replicas và HPA.

File liên quan: `k8s/base/deployments.yaml`, `k8s/base/hpa.yaml`.

### Câu 20: Nếu Nginx chết thì sao?

Nginx là entrypoint ngoài cùng, nếu chỉ có một Nginx thì đây là single point of failure. Trong production thật nên chạy Nginx/Ingress nhiều replica hoặc dùng cloud load balancer như AWS ALB. Với đồ án hiện tại, Nginx chạy Docker Compose trên EC2 để demo triển khai.

## 5. Scaling

### Câu 21: Khi traffic tăng thì scale như thế nào?

Scale theo service chịu tải. Nếu nhiều người xem sản phẩm thì scale Product Service và Elasticsearch. Nếu chat đông thì scale Chat Service và WebSocket Gateway. Nếu nhiều request vào hệ thống thì scale API Gateway. Kubernetes HPA có thể scale theo CPU/memory.

File liên quan: `k8s/base/hpa.yaml`.

### Câu 22: Horizontal scaling và vertical scaling khác nhau thế nào?

Vertical scaling là tăng tài nguyên máy/container như CPU/RAM. Horizontal scaling là tăng số lượng instance/pod. Dự án hỗ trợ cả hai, nhưng Microservices phù hợp horizontal scaling hơn vì có thể nhân bản riêng service cần thiết.

### Câu 23: Service nào dễ scale nhất?

Các service stateless dễ scale nhất như API Gateway, Product Service, User Service, Lost Found Service. Chat/WebSocket khó hơn vì có kết nối realtime, cần sticky session hoặc shared broker/Redis để đồng bộ kết nối.

### Câu 24: Vì sao WebSocket cần xử lý khác HTTP?

HTTP request thường ngắn và stateless, load balancer có thể chuyển request đến bất kỳ instance nào. WebSocket là kết nối dài, cần giữ kết nối ổn định. Nginx hiện dùng `ip_hash` cho upstream WebSocket để tăng tính ổn định.

File liên quan: `infra/nginx/nginx.conf`.

### Câu 25: Database có scale không?

Hiện hệ thống dùng MongoDB/Atlas hoặc MongoDB container tùy môi trường. Có thể scale database bằng managed MongoDB Atlas, replica set, index tối ưu và tách database theo service. Redis cache cũng giúp giảm tải database.

## 6. Performance

### Câu 26: Redis được dùng để làm gì?

Redis dùng cho cache và rate limiter. Cache giúp đọc nhanh dữ liệu thường truy cập, giảm tải MongoDB. Rate limiter dùng Redis Store để nhiều instance gateway có thể dùng chung bộ đếm request.

File liên quan: `packages/common/src/utils/cache.js`, `packages/common/src/utils/redis.js`, `packages/api-gateway/src/index.js`.

### Câu 27: Cache-aside pattern là gì?

Cache-aside là khi đọc dữ liệu, service kiểm tra cache trước. Nếu có cache thì trả luôn. Nếu không có thì đọc database, sau đó lưu kết quả vào cache với TTL. Khi dữ liệu thay đổi thì xóa cache liên quan.

File liên quan: `packages/common/src/utils/cache.js`.

### Câu 28: Làm sao tránh cache stampede?

Trong `cache.getOrSet()`, dự án dùng Redis lock. Khi cache miss, một request lấy lock để tính dữ liệu, các request khác chờ cache được set. Cách này tránh nhiều request cùng đánh vào database.

File liên quan: `packages/common/src/utils/cache.js`.

### Câu 29: Tìm kiếm sản phẩm tối ưu bằng gì?

Product Service có Elasticsearch để hỗ trợ tìm kiếm tốt hơn so với query MongoDB thông thường. Ngoài ra frontend/gateway có rate limit và backend có pagination để không trả quá nhiều dữ liệu.

File liên quan: `packages/product-service/src/services/elasticsearch.service.js`.

## 7. Fault tolerance

### Câu 30: Rate limiter phía client để làm gì?

Nó giảm spam từ UI, ví dụ người dùng bấm gửi liên tục. Frontend giới hạn số request trong cửa sổ thời gian và chặn double-submit cho POST/PUT/PATCH/DELETE.

File liên quan: `frontend/src/services/api.ts`.

### Câu 31: Rate limiter phía server để làm gì?

Server rate limiter bảo vệ hệ thống khỏi spam hoặc quá tải từ client, kể cả khi client bị sửa code hoặc gọi API bằng tool. Dự án có rate limit ở Nginx và API Gateway.

File liên quan: `infra/nginx/nginx.conf`, `packages/api-gateway/src/index.js`.

### Câu 32: Retry trong hệ thống nằm ở đâu?

Redis client có retry strategy với delay tối đa 5 giây. Frontend refresh token có cooldown 5 giây. WebSocket reconnect sau 5 giây nếu mất kết nối.

File liên quan: `packages/common/src/utils/redis.js`, `frontend/src/services/api.ts`, `frontend/src/services/chatService.ts`.

### Câu 33: Vì sao retry không nên retry liên tục?

Retry liên tục có thể làm service đang lỗi bị quá tải hơn. Vì vậy cần delay/backoff và circuit breaker. Retry xử lý lỗi tạm thời, circuit breaker cắt request khi lỗi kéo dài.

### Câu 34: Nếu Kafka lỗi thì sao?

Các luồng đồng bộ như login, xem sản phẩm vẫn có thể hoạt động. Nhưng các tác vụ bất đồng bộ như notification, karma hoặc saga có thể chậm/trễ. Hướng xử lý là retry consumer, DLQ và monitoring.

File liên quan: `packages/notification-service/src/models/DlqEvent.js`, `packages/notification-service/src/routes/dlq.routes.js`.

## 8. Security

### Câu 35: Hệ thống xác thực bằng gì?

Hệ thống dùng JWT. Sau khi login, client lưu access token và gửi trong header `Authorization: Bearer <token>`. Gateway/service kiểm tra token để xác định người dùng, role và permissions.

File liên quan: `packages/common/src/middleware/auth.js`, `frontend/src/services/api.ts`.

### Câu 36: Authorization khác authentication như thế nào?

Authentication trả lời câu hỏi "người dùng là ai". Authorization trả lời "người dùng được phép làm gì". Ví dụ student đăng bài cần `CAN_POST`, moderator cần quyền duyệt/xử lý, admin có quyền cao nhất.

File liên quan: `packages/common/src/middleware/auth.js`.

### Câu 37: Vì sao cần Gateway signature?

Gateway signature giúp service nội bộ tin rằng `X-User-*` headers thật sự do Gateway set, không phải client giả mạo. Nếu cấu hình `GATEWAY_SECRET`, service sẽ kiểm tra HMAC signature.

File liên quan: `packages/common/src/middleware/auth.js`.

### Câu 38: WebSocket xác thực thế nào?

Client gửi token khi kết nối WebSocket/SockJS. Gateway đọc token, verify JWT và chuyển user info xuống WS/Chat service. STOMP connection sau đó gắn với user.

File liên quan: `packages/api-gateway/src/index.js`, `frontend/src/services/chatService.ts`.

### Câu 39: Hệ thống có chống spam auth không?

Có. Route `/api/v1/auth` dùng auth rate limiter ở API Gateway. Ngoài ra frontend cũng có client-side limiter để giảm request quá nhanh.

File liên quan: `packages/api-gateway/src/config/routes.js`, `packages/api-gateway/src/index.js`.

## 9. DevOps

### Câu 40: Docker Compose dùng để làm gì?

Docker Compose dùng để chạy toàn bộ hệ thống bằng container: Nginx, Gateway, các backend services, Redis, Kafka, Elasticsearch, monitoring. Nó giúp triển khai nhất quán giữa máy dev và server.

File liên quan: `docker-compose.yml`.

### Câu 41: Mỗi service có Dockerfile riêng để làm gì?

Mỗi service có Dockerfile riêng để build image riêng, deploy riêng và scale riêng. Điều này phù hợp với Microservices vì mỗi service là một đơn vị triển khai độc lập.

File liên quan: `Dockerfile.gateway`, `Dockerfile.user-service`, `Dockerfile.product-service`, `Dockerfile.order-service`, `Dockerfile.notification-service`, `Dockerfile.chat-service`, `Dockerfile.lost-found-service`.

### Câu 42: CI/CD của dự án làm gì?

CI chạy test backend và build frontend khi push hoặc pull request. Deploy workflow build Docker image cho từng service, push lên GHCR và có thể apply Kubernetes manifests nếu có kubeconfig.

File liên quan: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`.

### Câu 43: Nếu giảng viên hỏi GitLab CI/Jenkins mà dự án dùng GitHub Actions thì trả lời sao?

Trả lời rằng dự án dùng GitHub Actions, chức năng tương đương GitLab CI/Jenkins: tự động install, test, build và deploy. Nếu chuyển sang GitLab/Jenkins thì pipeline vẫn gồm các stage tương tự.

### Câu 44: Hệ thống deploy ở đâu?

Hệ thống đã deploy trên AWS EC2, dùng domain `iuhexchange.site`, Nginx cấu hình HTTPS và reverse proxy đến các container backend chạy bằng Docker Compose.

File liên quan: `infra/nginx/nginx.conf`, `docker-compose.yml`.

## 10. AI

### Câu 45: AI được ứng dụng vào đâu trong hệ thống?

AI được dùng cho trợ lý chat, tìm kiếm bằng tool, hỗ trợ định giá/tư vấn, tự tạo tin mất/nhặt đồ từ chat và ảnh, matching đồ thất lạc, OCR/nhận diện hình ảnh.

File liên quan: `packages/chat-service/src/services/ai-assistant.service.js`, `packages/lost-found-service/src/services/ai-autopost.service.js`, `packages/lost-found-service/src/services/matching.service.js`.

### Câu 46: AI Agent trong dự án là gì?

AI Agent là workflow trong Chat Service, nơi Gemini có thể chọn tool để gọi dữ liệu thật. Các tool gồm `searchProductsTool`, `searchLostFoundTool`, `getMyOrdersTool`. AI không chỉ trả lời text mà có thể dùng tool để lấy thông tin hệ thống.

File liên quan: `packages/chat-service/src/services/ai-assistant.service.js`.

### Câu 47: Vì sao gọi đây là Agent chứ không chỉ chatbot?

Vì nó có khả năng quyết định gọi công cụ nào, lấy dữ liệu từ service thật, rồi tổng hợp câu trả lời. Chatbot thường chỉ trả lời dựa trên prompt, còn agent có tool/action để thao tác với hệ thống.

### Câu 48: AI tự động đăng tin mất đồ hoạt động thế nào?

Người dùng gửi ảnh và mô tả trong trang AI. Frontend tách title/location, upload ảnh, gọi endpoint `/lost-found/ai-post`. Lost Found Service dùng Gemini để tạo mô tả, category, tags và câu hỏi xác minh, sau đó lưu bài đăng.

File liên quan: `frontend/src/pages/AiAssistant.tsx`, `frontend/src/services/lostFoundService.ts`, `packages/lost-found-service/src/services/ai-autopost.service.js`.

### Câu 49: Nếu Gemini lỗi thì hệ thống có hoạt động không?

Có fallback. Trong Lost Found AI autopost, nếu Gemini lỗi thì service dùng logic local fallback để tạo draft cơ bản từ input. Như vậy tính năng không chết hoàn toàn.

File liên quan: `packages/lost-found-service/src/services/ai-autopost.service.js`.

### Câu 50: Matching lost-found có phải hoàn toàn AI không?

Không hoàn toàn. Matching dùng thuật toán keyword/category/location/inferred type scoring. AI/OCR hỗ trợ nhận diện nội dung ảnh, nhưng matching vẫn có rule-based scoring để kiểm soát và tránh match quá rộng.

File liên quan: `packages/lost-found-service/src/services/matching.service.js`.

## 11. Data và consistency

### Câu 51: Mỗi service có database riêng không?

Theo hướng Microservices, mỗi service sở hữu dữ liệu riêng. Trong cấu hình, mỗi service có biến `MONGODB_URI` riêng như `USER_SERVICE_MONGO_URI`, `PRODUCT_SERVICE_MONGO_URI`, `ORDER_SERVICE_MONGO_URI`.

File liên quan: `docker-compose.yml`.

### Câu 52: Vì sao không dùng một database chung?

Một database chung dễ join và đơn giản hơn, nhưng làm các service phụ thuộc chặt vào nhau. Tách database giúp service độc lập hơn, nhưng phải xử lý consistency bằng API hoặc event.

### Câu 53: Saga trong Order Service dùng để làm gì?

Saga dùng để quản lý giao dịch phân tán giữa order, product, notification hoặc các bước liên quan. Khi một bước lỗi, saga có thể xử lý bù trừ hoặc cập nhật trạng thái phù hợp.

File liên quan: `packages/order-service/src/services/saga.service.js`.

### Câu 54: Eventual consistency là gì?

Eventual consistency nghĩa là dữ liệu giữa các service không nhất thiết đồng bộ ngay lập tức, nhưng sau khi event được xử lý thì sẽ nhất quán. Ví dụ tạo đơn hàng xong có thể phát event để notification service gửi thông báo sau.

## 12. Monitoring và logging

### Câu 55: Làm sao biết service nào đang lỗi?

Gateway có `/health` kiểm tra downstream services. Mỗi service có healthcheck riêng. Ngoài ra Prometheus/Grafana thu metrics, request logger có request id để trace request.

File liên quan: `packages/api-gateway/src/index.js`, `packages/api-gateway/src/middleware/request-logger.js`, `infra/monitoring/prometheus/prometheus.yml`.

### Câu 56: Correlation ID dùng để làm gì?

Correlation ID giúp theo dõi một request xuyên suốt nhiều service. Gateway tạo/gắn `X-Request-ID`, sau đó log ở các service có thể dùng id này để debug.

File liên quan: `packages/api-gateway/src/middleware/request-logger.js`.

### Câu 57: Prometheus/Grafana dùng để làm gì?

Prometheus thu thập metrics từ các service, Grafana hiển thị dashboard. Nó giúp quan sát latency, số request, lỗi, tài nguyên và sức khỏe hệ thống.

File liên quan: `packages/common/src/utils/metrics.js`, `infra/monitoring/prometheus/prometheus.yml`, `infra/monitoring/grafana/dashboards/iuh-exchange.json`.

## 13. Câu hỏi phản biện khó

### Câu 58: Với quy mô sinh viên nhỏ, Microservices có overkill không?

Có thể xem là overkill nếu chỉ xét nhu cầu chạy thật hiện tại. Nhưng với mục tiêu môn kiến trúc phần mềm, Microservices giúp thể hiện rõ các đặc tính như scalability, fault tolerance, deployability, maintainability và AI workflow. Nhóm cũng giảm chi phí bằng Docker Compose trên một EC2 thay vì triển khai cloud phức tạp ngay từ đầu.

### Câu 59: Điểm single point of failure hiện tại là gì?

Nếu triển khai Docker Compose trên một EC2 thì EC2 và Nginx là single point of failure. Hướng khắc phục là dùng Load Balancer, nhiều EC2 hoặc Kubernetes cluster nhiều node, database managed, Redis managed.

### Câu 60: Nếu phải đơn giản hóa hệ thống, em sẽ làm gì?

Em sẽ gom các service ít tải vào một modular monolith hoặc giảm Kafka/Elasticsearch nếu chưa cần. Tuy nhiên vẫn giữ API Gateway, JWT, Redis cache và tách Chat/LostFound AI nếu chúng có tải khác biệt.

### Câu 61: Nếu phải nâng cấp production thật, em sẽ làm gì?

Em sẽ chuyển sang Kubernetes hoặc ECS, dùng AWS ALB, MongoDB Atlas, Redis managed, Kafka managed hoặc SQS/SNS, bật autoscaling, centralized logging, backup tự động và blue-green/rolling deployment.

### Câu 62: Nếu người dùng báo chậm, em kiểm tra đâu trước?

Kiểm tra Nginx/Gateway logs, metrics latency theo endpoint, health của service, Redis hit/miss, database query, Elasticsearch, rồi kiểm tra frontend network. Correlation ID giúp trace request.

### Câu 63: Nếu spam API thì hệ thống chống thế nào?

Có client limiter để giảm thao tác spam từ UI. Có Nginx `limit_req` theo IP. Có API Gateway rate limiter dùng Redis cho global/auth/sensitive route. Các endpoint OCR cũng có rate limit riêng.

### Câu 64: Nếu token hết hạn thì sao?

Frontend phát hiện token sắp hết hạn và gọi refresh token. Nếu nhiều request cùng bị 401, frontend queue lại để tránh gọi refresh nhiều lần. Nếu refresh thất bại 400/401/403 thì logout.

File liên quan: `frontend/src/services/api.ts`.

### Câu 65: Vì sao cần readiness và liveness probe?

Liveness kiểm tra container còn sống không để restart khi treo. Readiness kiểm tra container đã sẵn sàng nhận traffic chưa. Khi deploy rolling update, readiness giúp tránh route traffic vào pod chưa sẵn sàng.

File liên quan: `k8s/base/deployments.yaml`.

### Câu 66: Vì sao cần PDB?

PDB đảm bảo khi bảo trì hoặc rolling update, Kubernetes không làm tất cả pod của một service ngừng cùng lúc. Nó giúp giảm downtime.

File liên quan: `k8s/base/pdb.yaml`.

### Câu 67: Vì sao dùng Kafka thay vì gọi HTTP trực tiếp cho mọi thứ?

HTTP trực tiếp phù hợp khi cần kết quả ngay. Kafka phù hợp cho tác vụ bất đồng bộ như gửi thông báo, cập nhật karma, xử lý saga. Kafka giúp giảm coupling và tránh request chính bị chậm vì tác vụ phụ.

### Câu 68: Vì sao dùng Redis cache mà không chỉ index MongoDB?

Index MongoDB giúp truy vấn database nhanh hơn, nhưng vẫn phải hit database. Redis cache lưu kết quả hot data trong memory nên nhanh hơn và giảm tải database. Hai cách này bổ sung nhau.

### Câu 69: Vì sao gateway timeout 30 giây?

Timeout tránh request treo quá lâu khi upstream lỗi. Nếu không có timeout, connection có thể giữ tài nguyên lâu và làm gateway quá tải. Với tác vụ lâu hơn, nên chuyển sang queue/background job.

File liên quan: `packages/api-gateway/src/index.js`.

### Câu 70: Nếu AI trả lời sai thì kiểm soát thế nào?

AI chỉ hỗ trợ, không thay thế hoàn toàn rule nghiệp vụ. Với lost-found, backend vẫn validate schema, giới hạn category/type, lọc dữ liệu, có fallback local và user/admin vẫn có thể xem/sửa/gỡ bài. Matching cũng dùng rule scoring thay vì tin hoàn toàn vào AI.

File liên quan: `packages/lost-found-service/src/controllers/lostfound.controller.js`, `packages/lost-found-service/src/services/ai-autopost.service.js`.

