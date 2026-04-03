# 📋 IUH Campus Exchange Platform - Development Checklist

Checklist này chia lộ trình phát triển hệ thống thành các Phase (giai đoạn) từ dưới lên trên. Nó giúp bạn và team không bị "ngợp" trước một hệ thống Microservices phức tạp.

## Phase 1: Setup Infrastructure Core (Khung Sườn) ✅
Trọng tâm: Xây dựng môi trường local vững chắc trước khi code tính năng.
- [x] Khởi tạo File `docker-compose.yml` chứa các nền tảng lõi:
  - [x] MongoDB (Data Storage)
  - [x] Redis (Caching, Rate Limiting)
  - [x] Kafka & Zookeeper (Message Broker)
  - [x] ElasticSearch (Search Engine)
- [x] Khởi tạo bộ Source Code gốc Spring Boot Microservices (các module rỗng).
- [x] Setup Config Server & Service Registry (Eureka/Consul) - *Tùy chọn, nếu dùng Spring Cloud*.
- [x] Setup API Gateway (Spring Cloud Gateway) và config rules định tuyến cơ bản.
- [x] Cấu hình **Centralized Exception Handler** (Xử lý lỗi format chung cho toàn bộ APIs).

## Phase 2: Auth Service & User Management (Tuần 1 - 2) ✅
Trọng tâm: Xác thực và phân quyền sinh viên bằng JWT.
- [x] Thiết kế MongoDB Collection cho User.
- [x] Viết API Đăng ký (`POST /api/v1/auth/register`) + Validate đuôi `@student.iuh.edu.vn`.
- [x] Tích hợp gửi OTP xác nhận Email (SendGrid/SMTP).
- [x] Viết API Login, cấp và cấu hình vòng đời của Access Token & Refresh Token (Lưu Refresh Token ở cookie HttpOnly).
- [x] Hiện thực API Gateway Filter để Validate JWT Token.
- [x] Setup `permissions` array, định lượng cơ chế Role-Based Access Control (RBAC).
- [x] Thêm Rate Limiting Login vào API Gateway sử dụng Redis.

## Phase 3: Product Service & Search Sync (Tuần 2 - 3)
Trọng tâm: Đăng tải đồ dùng cũ, xử lý Upload ảnh.
- [x] Thêm thiết kế Object `Product` trong MongoDB.
- [x] Viết API lấy **Pre-signed URL AWS S3** để Frontend tự đẩy ảnh trực tiếp.
- [x] Viết API CRUD cho Product (thêm Pagination: `?page=1&size=20`).
- [x] Xây dựng **ElasticSearch Indexer**: Lắng nghe Message Kafka mỗi khi Product tạo mới/update để cập nhật ElasticSearch Index.
- [x] Viết API Searching / Filtering Query bằng ElasticSearch (Xử lý chữ FuzzySearch).
- [x] Setup module tự động loại bỏ (Blacklist) từ ngữ tục tĩu qua bộ lọc.

## Phase 4: Order Service & Distributed Transaction (Tuần 4)
Trọng tâm: Logic trao đổi hàng cực kỳ khắt khe + Saga.
- [x] Thiết kế Mongo Order Collection.
- [x] Viết API Create Order yêu cầu check **Idempotency-Key** lưu Redis để tránh Duplicate Order do Spam.
- [x] Implement Saga Choreography Pattern:
  - [x] Gửi Event `OrderCreatedEvent` qua Kafka (topic: `order.created`).
  - [x] ProductService nghe sự kiện và khóa món hàng (Cập nhật `Status=PENDING`) → Phát `product.reserved`.
  - [x] Nếu Product không còn available → Phát `product.reserve.failed` → OrderService tự hủy đơn.
- [x] Setup tính năng trừ phạt / tặng **KarmaPoint** sau khi hoàn tất mua bán.

## Phase 5: Giao tiếp Realtime - Chat & Notification (Tuần 5)
Trọng tâm: Tương tác người với người.
- [x] Khởi tạo **Chat Service** và **Notification Service**.
- [x] Thiết lập WebSocket với Spring STOMP cho Chat Service.
- [x] Áp dụng *Redis Pub/Sub* để router WebSocket tin nhắn nếu Chat Service được sinh ra thành nhiều Instance (Scale Out).
- [x] Push Event `New Notification` từ hệ thống Kafka sang Notification Service -> Ghi DB và Push Notification ra WebSocket cho Frontend.

## Phase 6: Phụ trợ - Lost & Found + Moderation (Tuần 6)
Trọng tâm: Hoàn thiện tính năng cộng đồng sinh viên.
- [x] Xây dựng APIs cho Đồ thất lạc (Lost & Found).
- [x] API Tố cáo sản phẩm/người dùng (Report Module) dành lưu tạm nội dung Admin kiểm duyệt.
- [x] Tự động khóa tính năng "Đăng bài" khi User bị gạch cờ rớt trừ KarmaPoint dưới ngưỡng 0.

## Phase 7: Frontend React Application (Song song Tuần 3 - 6)
- [ ] Khởi tạo dự án Vite (React + TypeScript).
- [ ] Setup TailwindCSS và Shadcn/UI (Hoặc NextUI/AntD) với định dạng màu sắc Theme của IUH (Đỏ / Xám).
- [ ] Setup **Zustand** Storage, tích hợp API config Axios Interceptors nối Refresh Token tự động. 
- [ ] Xây dựng Page: Authentication, Homepage, User Profile.
- [ ] Lắp đặt Component Card sản phẩm + Page Detail (Lấy URL Ảnh thẳng từ S3).
- [ ] Ghép WebSockets STOMP hiển thị Real-time Chat Panel và Notification Bell.

## Phase 8: Logging, Monitoring & Deployment (Tuần 7)
Trọng tâm: Đóng gói và mang lên Cloud thả rông.
- [ ] Code Elasticsearch Pipeline (ELK) để bắt log phân tán các Server.
- [ ] Tích hợp Prometheus metrics cho JVM và thiết lập Grafana Dashboard.
- [ ] Viết `Dockerfile` cho từng Service và Frontend Nginx.
- [ ] Tạo GitHub Actions tự build Docker Image trên Main Branch và Push về Hub.
- [ ] Chạy Cụm Cloud Cluster (Deploying Kubernetes cơ bản hoặc dùng Cụm Amazon EC2 LoadBalancer + MongoDB Atlas / ElastiCache).
- [ ] Chạy Test Load/Stress bằng JMeter đánh dấu chịu tải API.
