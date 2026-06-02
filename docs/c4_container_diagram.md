# C4 Container Diagram - IUH Campus Exchange Platform

Tài liệu này mô tả chi tiết sơ đồ **C4 Container Diagram** của hệ thống **IUH Campus Exchange Platform**. Sơ đồ này thể hiện ranh giới hệ thống, các container phần mềm chạy độc lập (Web App, API Gateway, Microservices, Databases, Message Brokers, Caches), cách thức chúng tương tác với nhau và giao tiếp với các hệ thống bên ngoài.

---

## 1. Sơ đồ C4 Container Diagram (Mermaid)

Dưới đây là sơ đồ Container được trực quan hóa bằng Mermaid. Sơ đồ phân chia hệ thống thành các phân lớp rõ ràng: **Actors (Người dùng)**, **Routing & Gateway (Điều phối & Định tuyến)**, **Backend Services (Các dịch vụ nghiệp vụ)**, **Persistence & Messaging (Cơ sở dữ liệu & Event Bus)**, và **External Systems (Hệ thống tích hợp bên ngoài)**.

```mermaid
flowchart TB
    %% Class Definitions for styling
    classDef actor fill:#08427b,stroke:#052e56,color:#ffffff,stroke-width:2px;
    classDef webapp fill:#1168bd,stroke:#0b4884,color:#ffffff,stroke-width:2px;
    classDef gateway fill:#1b802e,stroke:#12561e,color:#ffffff,stroke-width:2px;
    classDef microservice fill:#0277bd,stroke:#01579b,color:#ffffff,stroke-width:2px;
    classDef datastore fill:#eedc82,stroke:#b89000,color:#000000,stroke-width:2px;
    classDef monitoring fill:#795548,stroke:#4e342e,color:#ffffff,stroke-width:2px;
    classDef external fill:#4a148c,stroke:#311b92,color:#ffffff,stroke-width:2px;

    %% Actors
    subgraph Actors ["Tác nhân (Actors)"]
        Student["👤 Sinh viên / Người dùng\n(Student / Campus User)"]:::actor
        Admin["👤 Quản trị viên / Kiểm duyệt\n(Admin / Moderator)"]:::actor
    end

    %% Web Browser Container
    subgraph ClientLayer ["Trình duyệt Web (Web Browser)"]
        SPA["💻 Client Web Application\n[Container: ReactJS / Vite / TypeScript]\nCung cấp giao diện mua bán, chat, tìm đồ lạc."]:::webapp
    end

    %% Routing & Gateway
    subgraph GatewayLayer ["Lớp Định tuyến & Load Balancing"]
        Nginx["🌐 Nginx Load Balancer\n[Container: Nginx Proxy]\nSSL Termination, phục vụ file tĩnh SPA,\nphân phối HTTP & Websocket"]:::gateway
        APIGateway["🔌 API Gateway\n[Container: Node.js Express]\nRouting, JWT Auth Filter,\nRate Limiting (Redis), Logging"]:::gateway
        WSGateway["⚡ WebSocket Gateway\n[Container: Node.js Socket.io]\nQuản lý kết nối Real-time, duy trì\nphiên kết nối khách hàng"]:::gateway
    end

    %% Microservices
    subgraph BackendServices ["Lớp Dịch vụ Microservices (Node.js)"]
        UserService["⚙️ User Service\nQuản lý tài khoản, RBAC,\nKarma points, Authentication"]:::microservice
        ProductService["⚙️ Product Service\nQuản lý tin đăng bán, danh mục,\nkiểm duyệt bài đăng ban đầu"]:::microservice
        OrderService["⚙️ Order Service\nQuản lý đơn hàng, điều phối\ngiao dịch Saga, Idempotency"]:::microservice
        LostFoundService["⚙️ Lost & Found Service\nQuản lý tin tìm đồ, trả lại đồ,\ntương tác cộng đồng"]:::microservice
        ChatService["⚙️ Chat Service\nQuản lý lịch sử chat, hội thoại,\ntin nhắn riêng tư"]:::microservice
        NotificationService["⚙️ Notification Service\nTiêu thụ event từ Kafka, gửi push,\nemail, in-app alerts"]:::microservice
    end

    %% Persistence & Messaging
    subgraph PersistenceLayer ["Lớp Dữ liệu & Hàng đợi (Datastores & Messaging)"]
        MongoDB_Users[("💾 MongoDB (Users)\n[Database]")]:::datastore
        MongoDB_Products[("💾 MongoDB (Products)\n[Database]")]:::datastore
        MongoDB_LostFound[("💾 MongoDB (LostFound)\n[Database]")]:::datastore
        MongoDB_Chat[("💾 MongoDB (Chat)\n[Database]")]:::datastore
        MongoDB_Notifications[("💾 MongoDB (Notifications)\n[Database]")]:::datastore
        
        SupabaseDB[("🗄️ Supabase / PostgreSQL\n[Database]\nLưu trữ Users, KarmaHistory,\nOrders sau di trú")]:::datastore
        
        RedisCache[("⚡ Redis Cache & Pub/Sub\n[In-Memory Cache]\nLưu rate limit, active chat nodes,\nidempotency key, cache hot items")]:::datastore
        
        KafkaBroker[("🔀 Kafka Message Broker\n[Event Streaming]\nTruyền thông điệp bất đồng bộ,\nđiều phối Saga, sync ElasticSearch")]:::datastore
        
        ElasticSearch[("🔍 ElasticSearch\n[Search Engine]\nTìm kiếm sản phẩm fuzzy/full-text")]:::datastore
    end

    %% Observability
    subgraph MonitoringLayer ["Hệ thống Quan sát (Observability)"]
        Logstash["📊 Logstash\n[Pipeline]"]:::monitoring
        ES_Logs[("📂 Elasticsearch (Logs)\n[Log DB]")]:::monitoring
        Kibana["📈 Kibana\n[Dashboard]"]:::monitoring
        Prometheus["⏱️ Prometheus\n[Metrics scraper]"]:::monitoring
        Grafana["📊 Grafana\n[Visualizations]"]:::monitoring
    end

    %% External Systems
    subgraph ExternalServices ["Hệ thống tích hợp ngoài (External Systems)"]
        AWSS3["☁️ AWS S3 Buckets\nUpload và lưu trữ hình ảnh sản phẩm"]:::external
        Firebase["🔔 Firebase FCM\nGửi push notification đến thiết bị di động"]:::external
        Gemini["🤖 Google Gemini API\nAI Chat Assistant, Tự động kiểm duyệt bài"]:::external
        SMTPServer["📧 Gmail SMTP Server\nGửi email xác nhận, OTP, hóa đơn"]:::external
    end

    %% --- Connections & Protocols ---
    
    %% Actors to Client
    Student -->|"Sử dụng trình duyệt (HTTPS)"| SPA
    Admin -->|"Sử dụng trình duyệt (HTTPS)"| SPA

    %% SPA to Gateway / LB
    SPA -->|"1. Tải static assets & gọi REST API\n(HTTP/HTTPS/Port: 80, 443)"| Nginx
    SPA -->|"2. Đẩy file trực tiếp qua Presigned URL\n(HTTPS)"| AWSS3

    %% Nginx routing
    Nginx -->|"Phục vụ static files"| SPA
    Nginx -->|"Định tuyến REST API /api/*\n(HTTP/Port: 8080)"| APIGateway
    Nginx -->|"Định tuyến Websocket /socket.io/*\n(WS/WSS/Port: 3007)"| WSGateway

    %% Gateways to Services
    APIGateway -->|"Gọi HTTP REST (Port: 3001)"| UserService
    APIGateway -->|"Gọi HTTP REST (Port: 3002)"| ProductService
    APIGateway -->|"Gọi HTTP REST (Port: 3003)"| OrderService
    APIGateway -->|"Gọi HTTP REST (Port: 3006)"| LostFoundService
    APIGateway -->|"Gọi HTTP REST (Port: 3004)"| NotificationService
    
    WSGateway -->|"Đọc/ghi lịch sử, sync chat\n(HTTP REST/Port: 3005)"| ChatService
    WSGateway -->|"Quản lý trạng thái node, pub/sub"| RedisCache

    %% Service connections to databases & Cache
    UserService -->|MongoDB URI| MongoDB_Users
    UserService -->|Di trú dữ liệu| SupabaseDB
    UserService -->|Lưu session / Đọc cache| RedisCache

    ProductService -->|MongoDB URI| MongoDB_Products
    ProductService -->|Fuzzy search / Lọc dữ liệu| ElasticSearch
    ProductService -->|Cache danh sách sản phẩm hot| RedisCache
    ProductService -->|"Đăng ký sự kiện (ProductCreated...)\n(TCP/Port: 29092)"| KafkaBroker

    OrderService -->|MongoDB URI| MongoDB_Orders_Legacy[("💾 MongoDB (Orders)")]:::datastore
    OrderService -->|Di trú dữ liệu| SupabaseDB
    OrderService -->|Kiểm tra Idempotency-Key (24h)| RedisCache
    OrderService -->|"Xuất/Thu nhận các sự kiện Saga\n(TCP/Port: 29092)"| KafkaBroker

    LostFoundService -->|MongoDB URI| MongoDB_LostFound
    LostFoundService -->|"Đăng sự kiện đồ thất lạc\n(TCP/Port: 29092)"| KafkaBroker

    ChatService -->|MongoDB URI| MongoDB_Chat
    ChatService -->|Sync session, pub/sub liên instance| RedisCache

    NotificationService -->|MongoDB URI| MongoDB_Notifications
    NotificationService -->|"Lắng nghe sự kiện nghiệp vụ\n(TCP/Port: 29092)"| KafkaBroker

    %% Kafka to consumers & ElasticSearch sync
    KafkaBroker -.->|"Sync Index (Consumer)"| ElasticSearch
    KafkaBroker -.->|"Đẩy sự kiện để thông báo (Consumer)"| NotificationService

    %% Microservices integrations to External Systems
    ChatService -->|"AI Chat Assistant\n(REST HTTPS)"| Gemini
    ProductService -->|"Tự động kiểm duyệt tin đăng\n(REST HTTPS)"| Gemini
    NotificationService -->|"Gửi tin push mobile\n(HTTPS)"| Firebase
    NotificationService -->|"Gửi email OTP / hóa đơn\n(SMTP/Port: 587)"| SMTPServer

    %% Observability Connections
    UserService -.->|Gửi JSON Logs| Logstash
    ProductService -.->|Gửi JSON Logs| Logstash
    OrderService -.->|Gửi JSON Logs| Logstash
    LostFoundService -.->|Gửi JSON Logs| Logstash
    ChatService -.->|Gửi JSON Logs| Logstash
    NotificationService -.->|Gửi JSON Logs| Logstash
    APIGateway -.->|Gửi JSON Logs| Logstash

    Logstash -->|Pipeline Logs| ES_Logs
    Kibana -->|Truy vấn trực quan hóa| ES_Logs

    Prometheus -.->|"Scrape metrics\n(HTTP/Port: 9090)"| UserService
    Prometheus -.->|"Scrape metrics\n(HTTP/Port: 9090)"| ProductService
    Prometheus -.->|"Scrape metrics\n(HTTP/Port: 9090)"| OrderService
    Prometheus -.->|"Scrape metrics\n(HTTP/Port: 9090)"| APIGateway
    Grafana -->|Đọc metrics để vẽ biểu đồ| Prometheus
```

---

## 2. Mô tả chi tiết các Container (Container Specifications)

Dưới đây là thông số kỹ thuật chi tiết của từng Container được cấu hình và vận hành trong hệ thống:

### 2.1. Client UI & Routing Layers
| Tên Container | Công nghệ & Framework | Vai trò & Trách nhiệm | Liên kết & Tương tác |
| :--- | :--- | :--- | :--- |
| **Client Web Application** (SPA) | ReactJS, Vite, TypeScript, TailwindCSS, Zustand | Cung cấp giao diện người dùng SPA chạy trên trình duyệt. Xử lý logic hiển thị Marketplace, Lost & Found, Chatbox và trang quản trị Admin. | Gọi API REST qua Nginx / API Gateway; kết nối WebSocket đến WebSocket Gateway; Upload trực tiếp ảnh lên AWS S3. |
| **Nginx Load Balancer** | Nginx (Alpine) | Đóng vai trò Reverse Proxy và cổng biên. Thực hiện SSL Termination (bằng Certbot), phục vụ trực tiếp thư mục build static `/frontend/dist`, chuyển tiếp HTTP `/api/*` và WebSocket `/socket.io/*`. | Nhận yêu cầu từ Client; Điều tuyến sang `api-gateway` và `ws-gateway`. |
| **API Gateway** | Node.js, Express, HTTP-Proxy | Cánh cổng kiểm soát toàn bộ REST API. Thực hiện check JWT token hợp lệ, áp dụng Rate Limiting sử dụng Redis, ghi nhận log request tập trung. | Định tuyến request đến các microservices nội bộ (`user-service`, `product-service`, `order-service`, `lost-found-service`, `notification-service`). |
| **WebSocket Gateway** | Node.js, Socket.io, Redis Adapter | Container quản lý kết nối thời gian thực độc lập. Tách biệt WebSocket giúp chat không làm nghẽn HTTP API. Sử dụng Redis Pub/Sub để đồng bộ tin nhắn khi chạy multi-instances. | Client kết nối WSS trực tiếp; WS Gateway kết nối với `chat-service` để lưu trữ dữ liệu và dùng Redis để broadcast. |

### 2.2. Backend Core Microservices
| Tên Container | Công nghệ & Framework | Vai trò & Trách nhiệm | Liên kết & Tương tác |
| :--- | :--- | :--- | :--- |
| **User Service** | Node.js, Express, BCrypt | Đăng ký, đăng nhập, quản lý thông tin tài khoản sinh viên. Xử lý tính toán điểm Karma (mức độ uy tín) và phân quyền chi tiết (RBAC). | Lưu dữ liệu vào `MongoDB (Users)` hoặc `Supabase PostgreSQL`. Caching profile ở Redis. |
| **Product Service** | Node.js, Express | Đăng bài sản phẩm, duyệt tin, phân loại hàng hóa. Sử dụng Gemini API để kiểm duyệt văn bản/hình ảnh bài đăng tự động để phát hiện spam/từ ngữ cấm. | Lưu dữ liệu vào `MongoDB (Products)`. Sync dữ liệu tìm kiếm sang `ElasticSearch` qua Kafka. |
| **Order Service** | Node.js, Express | Quản lý quy trình mua bán. Điều phối các giao dịch phân tán sử dụng **Saga Pattern** thông qua Kafka. Sử dụng Redis để kiểm tra `Idempotency-Key` (chống trùng lặp đơn hàng). | Lưu dữ liệu vào `MongoDB (Orders)` hoặc `Supabase PostgreSQL`. Giao tiếp qua Kafka với Product Service và Notification Service. |
| **Lost & Found Service** | Node.js, Express | Đăng bài viết tìm đồ lạc hoặc trả lại đồ tìm thấy. Đóng góp vào điểm uy tín Karma cho sinh viên khi trả lại đồ thành công. | Lưu dữ liệu vào `MongoDB (LostFound)`. Bắn sự kiện lên Kafka để thông báo in-app. |
| **Chat Service** | Node.js, Express | Quản lý phòng chat riêng tư giữa người mua và người bán. Tích hợp Google Gemini AI Assistant làm chatbot trả lời tự động hỗ trợ sinh viên. | Lưu dữ liệu tin nhắn vào `MongoDB (Chat)`. Sử dụng Redis để đồng bộ trạng thái online/offline. |
| **Notification Service** | Node.js, Express | Lắng nghe tất cả các event trên Kafka Broker. Tự động xử lý và gửi thông báo đa kênh tùy theo loại sự kiện. | Đọc các message từ Kafka. Gửi email qua SMTP, gửi push qua Firebase FCM, lưu thông báo in-app vào `MongoDB (Notifications)`. |

### 2.3. Data Persistence & Communication Middleware
| Tên Container | Công nghệ sử dụng | Vai trò & Trách nhiệm | Phương thức lưu trữ / Giao tiếp |
| :--- | :--- | :--- | :--- |
| **MongoDB Cluster** | MongoDB 7.0 | Cơ sở dữ liệu chính dạng NoSQL. Mỗi microservice sở hữu một database collection hoàn toàn độc lập để đảm bảo tính phân rã lỏng (loose coupling). | Lưu trữ JSON Documents cho Users, Products, Chat, Notifications, LostFound. |
| **Supabase / PostgreSQL** | PostgreSQL (Supabase Cloud) | Cơ sở dữ liệu quan hệ được tích hợp để lưu trữ thông tin nhạy cảm cần tính toàn vẹn cao gồm: thông tin `Users`, lịch sử Karma (`KarmaHistory`), và hóa đơn đặt hàng (`Orders`). | Thực hiện các transaction SQL nghiêm ngặt. |
| **Redis Cache** | Redis 7.2 (Alpine) | Bộ lưu trữ in-memory dùng chung. Quản lý rate-limiting, phân phối tin nhắn Pub/Sub giữa các instance WebSocket, lưu trữ Idempotency Key trong 24h và cache các sản phẩm hot. | In-memory key-value store, sử dụng chính sách `allkeys-lru` để thu hồi bộ nhớ khi đầy. |
| **Kafka Broker** | Confluent cp-kafka + zookeeper | Hệ thống Event Bus trung tâm. Điều phối các luồng sự kiện bất đồng bộ, thực hiện Saga, đồng bộ dữ liệu tìm kiếm, hỗ trợ Dead Letter Queue (DLQ) & Exponential Backoff Retry. | Giao thức TCP trên cổng `29092` (nội bộ) và `9092` (ngoại vi). |
| **ElasticSearch** | Elasticsearch 8.13 | Search engine lưu trữ các index sản phẩm để phục vụ tìm kiếm mờ (fuzzy search), tìm kiếm toàn văn (full-text search) nhanh chóng. | Cung cấp cổng RESTful truy vấn trên port `9200`. Dữ liệu được đồng bộ bất đồng bộ từ Kafka. |

---

## 3. Bản vẽ thiết kế C4 Container (PlantUML)

Đối với các công cụ trực quan hóa chuyên dụng hỗ trợ PlantUML (như PlantText, Kroki), bạn có thể sử dụng mã nguồn chuẩn C4-PlantUML dưới đây để kết xuất sơ đồ:

```plantuml
@startuml "c4_container_diagram"
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

LAYOUT_WITH_LEGEND()

title C4 Container Diagram - IUH Campus Exchange Platform

Person(student, "Sinh viên / Người dùng", "Mua bán sản phẩm, đăng tin đồ thất lạc, chat thời gian thực")
Person(admin, "Quản trị viên / Kiểm duyệt", "Quản lý hệ thống, kiểm duyệt tin báo cáo, ban tài khoản vi phạm")

System_Boundary(iuh_exchange, "IUH Campus Exchange Platform") {
    
    Container(spa, "Web SPA Application", "ReactJS, Vite, Zustand", "Cung cấp giao diện responsive cho người dùng đầu cuối")
    
    ContainerDb(redis, "Redis Cache & Pub/Sub", "Redis 7.2", "Lưu rate limit, idempotency keys, WebSocket session distribution")
    ContainerDb(kafka, "Kafka Message Broker", "Kafka 7.6 (Zookeeper)", "Hệ thống event-driven, điều phối Saga, truyền sự kiện bất đồng bộ")
    ContainerDb(elasticsearch, "ElasticSearch Engine", "Elasticsearch 8.13", "Tìm kiếm mờ (fuzzy) và full-text search sản phẩm")

    Container(nginx, "Nginx Load Balancer", "Nginx Alpine", "Định tuyến Reverse Proxy, SSL Termination, phục vụ static assets")
    Container(gateway, "API Gateway", "Node.js Express", "Định tuyến REST API, kiểm tra JWT Authentication, Rate limit check")
    Container(ws_gateway, "WebSocket Gateway", "Node.js Socket.io", "Quản lý kết nối WebSocket thời gian thực của các clients")

    Container(user_service, "User Service", "Node.js Express", "Đăng ký, đăng nhập, phân quyền RBAC, tính điểm uy tín Karma")
    Container(product_service, "Product Service", "Node.js Express", "Quản lý bài đăng bán sản phẩm, phân mục hàng hóa")
    Container(order_service, "Order Service", "Node.js Express", "Quản lý đơn hàng, điều phối giao dịch Saga chống lặp đơn")
    Container(lostfound_service, "Lost & Found Service", "Node.js Express", "Đăng tin thất lạc đồ, hỗ trợ tìm kiếm đồ lạc")
    Container(chat_service, "Chat Service", "Node.js Express", "Quản lý hội thoại chat riêng tư, tích hợp AI Assistant")
    Container(notification_service, "Notification Service", "Node.js Express", "Tiêu thụ Kafka events, điều phối thông báo đa kênh")

    ContainerDb(mongo_users, "MongoDB (Users)", "MongoDB", "Lưu trữ thông tin profile và auth user")
    ContainerDb(mongo_products, "MongoDB (Products)", "MongoDB", "Lưu trữ tin đăng sản phẩm")
    ContainerDb(mongo_orders, "MongoDB (Orders)", "MongoDB", "Lưu trữ chi tiết đơn hàng (Legacy)")
    ContainerDb(mongo_lostfound, "MongoDB (LostFound)", "MongoDB", "Lưu trữ tin tìm đồ/nhận đồ")
    ContainerDb(mongo_chat, "MongoDB (Chat)", "MongoDB", "Lưu trữ lịch sử chat giữa các user")
    ContainerDb(mongo_notif, "MongoDB (Notifications)", "MongoDB", "Lưu trữ lịch sử thông báo in-app")
    
    ContainerDb(supabase, "Supabase / PostgreSQL", "PostgreSQL Cloud", "Lưu trữ Users, Karma History và Orders (Đã di trú)")
}

System_Ext(s3, "AWS S3 Cloud Storage", "Lưu trữ hình ảnh sản phẩm được tải trực tiếp lên từ client")
System_Ext(fcm, "Firebase Cloud Messaging", "Gửi Push Notifications trực tiếp đến điện thoại người dùng")
System_Ext(gemini, "Google Gemini AI API", "Tự động kiểm duyệt bài đăng, trợ lý ảo AI Chat")
System_Ext(smtp, "Gmail SMTP Server", "Gửi Email OTP xác thực và hóa đơn giao dịch")

' Relationships
Rel(student, spa, "Sử dụng ứng dụng qua trình duyệt", "HTTPS")
Rel(admin, spa, "Truy cập giao diện quản trị", "HTTPS")

Rel_D(spa, nginx, "Tải file tĩnh và gửi yêu cầu REST/WS", "HTTP/WSS")
Rel_D(spa, s3, "Tải hình ảnh trực tiếp qua Presigned URL", "HTTPS")

Rel_D(nginx, gateway, "Định tuyến REST API (/api/*)", "HTTP/Port 8080")
Rel_D(nginx, ws_gateway, "Định tuyến kết nối Websocket (/socket.io/*)", "WSS/Port 3007")

Rel_D(ws_gateway, redis, "Đồng bộ session giữa các instances", "Redis Protocol")
Rel_D(ws_gateway, chat_service, "Gửi/Nhận tin nhắn thô để lưu trữ", "HTTP/Port 3005")

Rel_D(gateway, user_service, "Định tuyến", "HTTP/Port 3001")
Rel_D(gateway, product_service, "Định tuyến", "HTTP/Port 3002")
Rel_D(gateway, order_service, "Định tuyến", "HTTP/Port 3003")
Rel_D(gateway, lostfound_service, "Định tuyến", "HTTP/Port 3006")
Rel_D(gateway, notification_service, "Định tuyến", "HTTP/Port 3004")

Rel(user_service, mongo_users, "Đọc/Ghi dữ liệu", "MongoDB Wire")
Rel(user_service, supabase, "Đồng bộ/Đọc dữ liệu di trú", "Postgres Protocol")
Rel(user_service, redis, "Đọc/Ghi session user", "Redis Protocol")

Rel(product_service, mongo_products, "Đọc/Ghi dữ liệu", "MongoDB Wire")
Rel(product_service, elasticsearch, "Đọc dữ liệu tìm kiếm mờ", "HTTP REST")
Rel(product_service, kafka, "Publish sự kiện sản phẩm (ProductCreated...)", "TCP/Port 29092")
Rel(product_service, gemini, "Yêu cầu kiểm duyệt tin đăng tự động", "HTTPS")

Rel(order_service, mongo_orders, "Đọc/Ghi dữ liệu", "MongoDB Wire")
Rel(order_service, supabase, "Ghi đơn hàng giao dịch chính xác", "Postgres Protocol")
Rel(order_service, redis, "Check Idempotency-Key", "Redis Protocol")
Rel(order_service, kafka, "Publish sự kiện Saga (OrderCreated...)", "TCP/Port 29092")

Rel(lostfound_service, mongo_lostfound, "Đọc/Ghi dữ liệu", "MongoDB Wire")
Rel(lostfound_service, kafka, "Publish sự kiện đồ thất lạc", "TCP/Port 29092")

Rel(chat_service, mongo_chat, "Đọc/Ghi lịch sử chat", "MongoDB Wire")
Rel(chat_service, redis, "Quản lý trạng thái online/offline", "Redis Protocol")
Rel(chat_service, gemini, "Yêu cầu phản hồi từ AI Assistant", "HTTPS")

Rel(notification_service, mongo_notif, "Đọc/Ghi lịch sử thông báo", "MongoDB Wire")
Rel(notification_service, kafka, "Subscribe & lắng nghe sự kiện nghiệp vụ", "TCP/Port 29092")
Rel(notification_service, fcm, "Gửi push alerts", "HTTPS")
Rel(notification_service, smtp, "Gửi email transactional", "SMTP/Port 587")

Rel_D(kafka, elasticsearch, "Đồng bộ dữ liệu index sản phẩm mới", "TCP/Consumer")
Rel_D(kafka, notification_service, "Thông báo sự kiện", "TCP/Consumer")

@enduml
```

---

## 4. Các Luồng Nghiệp Vụ Chính Trong Hệ Thống (Key Container Interactions)

### 4.1. Luồng Tìm Kiếm và Xem Sản Phẩm (Search & Query Flow)
1. **Client** gửi từ khóa tìm kiếm tiếng Việt không dấu đến **Nginx**.
2. **Nginx** chuyển tiếp đến **API Gateway** -> chuyển đến **Product Service**.
3. **Product Service** thay vì quét cơ sở dữ liệu `MongoDB (Products)` (gây chậm), nó thực hiện truy vấn trực tiếp đến **ElasticSearch**.
4. **ElasticSearch** trả về danh sách kết quả phù hợp nhất bằng thuật toán tìm kiếm mờ (Fuzzy Search) theo thời gian thực.
5. **Product Service** lấy thêm thông tin người bán từ **Redis Cache** (nếu có) và trả về kết quả cho client.

### 4.2. Luồng Tạo Đơn Hàng Phân Tán (Saga Order Flow)
1. **Client** gửi lệnh mua kèm `Idempotency-Key` trên header qua **API Gateway** đến **Order Service**.
2. **Order Service** dùng `Idempotency-Key` truy vấn vào **Redis** để đảm bảo request chưa từng được thực hiện trước đó trong 24h.
3. Nếu hợp lệ, **Order Service** khởi tạo đơn hàng trạng thái `PENDING` trong **Supabase DB** và publish sự kiện `OrderCreatedEvent` lên **Kafka**.
4. **Product Service** subscribe sự kiện `OrderCreatedEvent`, tiến hành kiểm tra kho và khóa sản phẩm tạm thời (chuyển sang trạng thái `PENDING` trong MongoDB/Redis). Sau đó bắn sự kiện phản hồi lên **Kafka**.
5. **Notification Service** bắt được sự kiện, gửi email hóa đơn giao dịch qua **Gmail SMTP** và bắn push qua **Firebase FCM** cho người bán.
6. Trường hợp có lỗi xảy ra ở bất kỳ bước nào, các compensating transaction (sự kiện bù) sẽ được bắn lên **Kafka** để rollback đơn hàng về `CANCELLED` và giải phóng trạng thái sản phẩm về `AVAILABLE`.

### 4.3. Luồng Tin Nhắn Thời Gian Thực (Real-time Messaging Flow)
1. **Client A** (Người mua) và **Client B** (Người bán) duy trì kết nối WebSocket liên tục qua cổng biên **Nginx** vào **WebSocket Gateway**.
2. **Client A** gửi tin nhắn thô dạng JSON lên WebSocket.
3. **WS Gateway** tiếp nhận tin nhắn, chuyển tiếp bất đồng bộ qua REST đến **Chat Service** để lưu vào **MongoDB (Chat)**.
4. **WS Gateway** truy vấn **Redis Cache** xem **Client B** đang kết nối đến node WebSocket nào. 
5. Nếu **Client B** đang nằm trên một instance WS Gateway khác trong cluster, tin nhắn được đẩy vào **Redis Pub/Sub Channel** của instance đó để chuyển tiếp trực tiếp xuống trình duyệt của **Client B** ngay lập tức.
