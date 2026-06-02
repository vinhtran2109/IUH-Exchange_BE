# 📖 Hướng Dẫn Chi Tiết API (API Reference Guide)

Tài liệu này cung cấp chi tiết đầy đủ về các API endpoints, cấu trúc request/response, mã trạng thái và các ví dụ thực tế cho toàn bộ các Microservices trong hệ thống **IUH Campus Exchange Platform**.

---

## 🔒 Quy Định Chung (Global Specifications)

### 1. Base URL & Versioning
Tất cả các API được định tuyến qua **API Gateway** ở port `8080` (hoặc domain production) và được phân phiên bản (versioning):
- REST API: `http://localhost:8080/api/v1`
- WebSocket Gateway: `ws://localhost:3007/ws` hoặc `ws://localhost:8080/ws`

### 2. Định Dạng Dữ Liệu (Media Type)
- Tất cả request body phải sử dụng định dạng `application/json`.
- Tất cả response body trả về định dạng `application/json` chuẩn.

### 3. Headers Bắt Buộc
- **Authorization**: `Bearer <access_token>` (cho các endpoint yêu cầu xác thực).
- **Idempotency-Key**: Chuỗi UUIDv4 duy nhất (chỉ bắt buộc cho API tạo đơn hàng `/orders`).

### 4. Cấu Trúc Response Chuẩn (Standard Response Format)

#### Phản hồi thành công (Success Response)
```json
{
  "success": true,
  "message": "Thực hiện thao tác thành công",
  "data": {
    // Dữ liệu trả về ở đây
  }
}
```

#### Phản hồi phân trang (Paginated Response)
```json
{
  "success": true,
  "message": "Lấy danh sách thành công",
  "data": {
    "items": [],
    "pagination": {
      "totalItems": 120,
      "itemCount": 10,
      "itemsPerPage": 10,
      "totalPages": 12,
      "currentPage": 1
    }
  }
}
```

#### Phản hồi lỗi (Error Response)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu đầu vào không hợp lệ",
    "details": [
      {
        "field": "email",
        "issue": "Email không đúng định dạng sinh viên IUH (@student.iuh.edu.vn)"
      }
    ]
  },
  "timestamp": "2026-06-02T07:10:00.000Z"
}
```

---

## 👤 1. User & Authentication Service (`/api/v1/auth` & `/api/v1/users`)

Dịch vụ này quản lý định danh người dùng, đăng ký, đăng nhập, phân quyền, hệ thống tích điểm uy tín (Karma) và thao tác quản trị viên.

### Đăng ký tài khoản (`POST /auth/register`)
Đăng ký tài khoản sinh viên mới bằng email sinh viên trường IUH.

- **URL**: `/auth/register`
- **Method**: `POST`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "20012345@student.iuh.edu.vn",
    "password": "SecurePassword123!",
    "fullName": "Nguyễn Văn A",
    "studentId": "20012345",
    "phone": "0987654321",
    "classCode": "DHKHMT16A"
  }
}
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Đăng ký tài khoản thành công. Vui lòng kiểm tra email để nhận mã OTP xác thực.",
    "data": {
      "email": "20012345@student.iuh.edu.vn",
      "status": "PENDING_VERIFICATION"
    }
  }
  ```
- **Lỗi thường gặp**:
  - `400 Bad Request`: Email không hợp lệ hoặc không thuộc tên miền `@student.iuh.edu.vn`.
  - `409 Conflict`: Email hoặc Mã số sinh viên đã tồn tại trong hệ thống.

---

### Xác nhận mã OTP (`POST /auth/verify-otp`)
Xác thực tài khoản bằng mã OTP được gửi qua email.

- **URL**: `/auth/verify-otp`
- **Method**: `POST`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "20012345@student.iuh.edu.vn",
    "otp": "123456"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Xác thực tài khoản thành công. Hiện tại bạn có thể đăng nhập.",
    "data": {
      "email": "20012345@student.iuh.edu.vn",
      "status": "ACTIVE"
    }
  }
  ```

---

### Đăng nhập (`POST /auth/login`)
Đăng nhập vào hệ thống để lấy Access Token và Refresh Token.

- **URL**: `/auth/login`
- **Method**: `POST`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "20012345@student.iuh.edu.vn",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK)**:
  - Thiết lập Cookie: `refreshToken=<jwt_token>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
  - Response Body:
    ```json
    {
      "success": true,
      "message": "Đăng nhập thành công",
      "data": {
        "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
          "id": "65ab1c2d3e4f5a6b7c8d9e0f",
          "email": "20012345@student.iuh.edu.vn",
          "fullName": "Nguyễn Văn A",
          "role": "STUDENT",
          "karma": 100,
          "avatarUrl": "https://iuh-exchange-images.s3.ap-southeast-1.amazonaws.com/avatars/default.png"
        }
      }
    }
    ```

---

### Làm mới Access Token (`POST /auth/refresh-token`)
Lấy Access Token mới khi token cũ hết hạn thông qua Refresh Token đính kèm trong Cookie.

- **URL**: `/auth/refresh-token`
- **Method**: `POST`
- **Auth**: Public (Yêu cầu Cookie chứa `refreshToken`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Làm mới Access Token thành công",
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

---

### Đăng xuất (`POST /auth/logout`)
Đăng xuất tài khoản và vô hiệu hóa các token.

- **URL**: `/auth/logout`
- **Method**: `POST`
- **Auth**: Required
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đăng xuất thành công"
  }
  ```

---

### Lấy thông tin cá nhân (`GET /users/me`)
Lấy thông tin chi tiết của người dùng đang đăng nhập.

- **URL**: `/users/me`
- **Method**: `GET`
- **Auth**: Required
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Lấy profile thành công",
    "data": {
      "id": "65ab1c2d3e4f5a6b7c8d9e0f",
      "email": "20012345@student.iuh.edu.vn",
      "fullName": "Nguyễn Văn A",
      "studentId": "20012345",
      "phone": "0987654321",
      "classCode": "DHKHMT16A",
      "role": "STUDENT",
      "karma": 105,
      "avatarUrl": "https://iuh-exchange-images.s3.ap-southeast-1.amazonaws.com/avatars/default.png",
      "status": "ACTIVE",
      "createdAt": "2026-05-01T10:00:00.000Z"
    }
  }
  ```

---

## 📦 2. Product Service (`/api/v1/products`)

Dịch vụ quản lý các sản phẩm được đăng tin bán hoặc trao đổi trên hệ thống. Tích hợp bộ tìm kiếm ElasticSearch để tìm kiếm nâng cao.

### Lấy danh sách sản phẩm (`GET /products`)
Lấy danh sách các sản phẩm đang được rao bán (đã được admin duyệt).

- **URL**: `/products`
- **Method**: `GET`
- **Auth**: Optional
- **Query Parameters**:
  - `page`: Số trang (mặc định: `1`)
  - `limit`: Số phần tử mỗi trang (mặc định: `10`)
  - `category`: Thể loại sản phẩm (ví dụ: `ELECTRONICS`, `BOOKS`, `FURNITURE`, `CLOTHES`, `OTHERS`)
  - `minPrice`: Giá tối thiểu
  - `maxPrice`: Giá tối đa
  - `sortBy`: Trường sắp xếp (`createdAt`, `price`, `views`)
  - `order`: Hướng sắp xếp (`asc`, `desc`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Lấy danh sách sản phẩm thành công",
    "data": {
      "items": [
        {
          "id": "65cd9e8f7a6b5c4d3e2f1a0b",
          "title": "Giáo trình Kiến trúc Phần mềm IUH",
          "description": "Sách còn mới 95%, không bị rách hay tẩy xóa. Rất hữu ích cho sinh viên năm 4.",
          "price": 45000,
          "category": "BOOKS",
          "images": [
            "https://iuh-exchange-images.s3.ap-southeast-1.amazonaws.com/products/book1.jpg"
          ],
          "seller": {
            "id": "65ab1c2d3e4f5a6b7c8d9e0f",
            "fullName": "Nguyễn Văn A",
            "karma": 105
          },
          "status": "APPROVED",
          "views": 42,
          "createdAt": "2026-05-20T08:30:00.000Z"
        }
      ],
      "pagination": {
        "totalItems": 1,
        "itemCount": 1,
        "itemsPerPage": 10,
        "totalPages": 1,
        "currentPage": 1
      }
    }
  }
  ```

---

### Tìm kiếm sản phẩm nâng cao (`GET /products/search`)
Tìm kiếm sản phẩm sử dụng ElasticSearch toàn văn (Full-text search) kết hợp bộ lọc.

- **URL**: `/products/search`
- **Method**: `GET`
- **Auth**: Optional
- **Query Parameters**:
  - `keyword`: Từ khóa tìm kiếm (Ví dụ: `giáo trình`)
  - `category`: Bộ lọc theo danh mục
  - `page`: Số trang
  - `limit`: Số lượng mỗi trang
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Tìm kiếm sản phẩm thành công",
    "data": {
      "items": [
        {
          "id": "65cd9e8f7a6b5c4d3e2f1a0b",
          "title": "Giáo trình Kiến trúc Phần mềm IUH",
          "description": "Sách còn mới 95%...",
          "price": 45000,
          "category": "BOOKS",
          "images": [
            "https://iuh-exchange-images.s3.ap-southeast-1.amazonaws.com/products/book1.jpg"
          ],
          "score": 1.4853, // Điểm xếp hạng tìm kiếm tương đồng từ ElasticSearch
          "createdAt": "2026-05-20T08:30:00.000Z"
        }
      ],
      "pagination": {
        "totalItems": 1,
        "itemCount": 1,
        "itemsPerPage": 10,
        "totalPages": 1,
        "currentPage": 1
      }
    }
  }
  ```

---

### Đăng bán sản phẩm mới (`POST /products`)
Người dùng đăng bán một mặt hàng mới lên hệ thống. Sản phẩm mới sẽ ở trạng thái `PENDING` chờ kiểm duyệt từ quản trị viên.

- **URL**: `/products`
- **Method**: `POST`
- **Auth**: Required (Yêu cầu Karma >= 0)
- **Request Body**:
  ```json
  {
    "title": "Bàn học gấp gọn sinh viên",
    "description": "Bàn gỗ chân sắt gấp gọn tiện lợi, kích thước 40x60cm thích hợp cho phòng trọ diện tích nhỏ.",
    "price": 80000,
    "category": "FURNITURE",
    "images": [
      "https://iuh-exchange-images.s3.ap-southeast-1.amazonaws.com/products/65ab1c_table1.jpg"
    ]
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Đăng bán sản phẩm thành công. Tin của bạn đang chờ kiểm duyệt.",
    "data": {
      "id": "65df1a2b3c4d5e6f7a8b9c0d",
      "title": "Bàn học gấp gọn sinh viên",
      "price": 80000,
      "status": "PENDING",
      "createdAt": "2026-06-02T07:12:00.000Z"
    }
  }
  ```

---

### Lấy URL tải lên ảnh (Presigned URL) (`POST /products/upload-url`)
Tạo AWS S3 Presigned URL để client trực tiếp upload ảnh lên S3 một cách an toàn mà không cần truyền dữ liệu nhị phân qua Backend.

- **URL**: `/products/upload-url`
- **Method**: `POST`
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "fileName": "desk.jpg",
    "fileType": "image/jpeg"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Khởi tạo URL upload thành công",
    "data": {
      "uploadUrl": "https://iuh-exchange-images.s3.ap-southeast-1.amazonaws.com/products/65ab1c_desk.jpg?AWSAccessKeyId=AKIA...",
      "fileUrl": "https://iuh-exchange-images.s3.ap-southeast-1.amazonaws.com/products/65ab1c_desk.jpg"
    }
  }
  ```

---

## 🛒 3. Order Service (`/api/v1/orders`)

Dịch vụ xử lý giao dịch đặt mua sản phẩm. Đảm bảo tính toàn vẹn dữ liệu trong hệ thống phân tán bằng mô hình giao dịch phân tán **Saga (Choreography)** qua Apache Kafka.

### Tạo đơn hàng mới (`POST /orders`)
Người mua gửi yêu cầu mua một sản phẩm.

- **URL**: `/orders`
- **Method**: `POST`
- **Auth**: Required
- **Headers bắt buộc**:
  - `Idempotency-Key`: UUID duy nhất để chống trùng lặp đơn hàng khi gửi lại request.
- **Request Body**:
  ```json
  {
    "productId": "65cd9e8f7a6b5c4d3e2f1a0b",
    "shippingAddress": "Ký túc xá IUH, Phòng 502, Gò Vấp, TP.HCM",
    "notes": "Mình sẽ nhận hàng vào chiều thứ 5 nhé."
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Đơn hàng đã được tiếp nhận và đang xử lý giao dịch phân tán.",
    "data": {
      "orderId": "65fa8b9c0d1e2f3a4b5c6d7e",
      "productId": "65cd9e8f7a6b5c4d3e2f1a0b",
      "buyerId": "65ab1c2d3e4f5a6b7c8d9e0f",
      "price": 45000,
      "status": "PENDING", // Trạng thái ban đầu trước khi Saga chạy
      "createdAt": "2026-06-02T07:15:00.000Z"
    }
  }
  ```
- **Mô tả quy trình Saga diễn ra ngầm**:
  1. `Order Service` lưu đơn hàng với trạng thái `PENDING`.
  2. Gửi sự kiện `order.created` lên Apache Kafka.
  3. `Product Service` lắng nghe sự kiện `order.created`, thực hiện khóa sản phẩm (chuyển trạng thái sản phẩm sang `RESERVED`).
     - Nếu thành công: Phát sự kiện `product.reserved` lên Kafka.
       - `Order Service` lắng nghe và đổi trạng thái Order thành `AWAITING_SELLER` (Chờ người bán xác nhận).
     - Nếu thất bại (sản phẩm đã có người khác mua): Phát sự kiện `product.reserve.failed`.
       - `Order Service` lắng nghe và tự động chuyển trạng thái Order sang `CANCELLED` (Lỗi giao dịch).

---

### Xác nhận đơn hàng từ người bán (`PATCH /orders/:id/confirm`)
Người bán đồng ý giao dịch và xác nhận đơn hàng.

- **URL**: `/orders/65fa8b9c0d1e2f3a4b5c6d7e/confirm`
- **Method**: `PATCH`
- **Auth**: Required (Người gọi phải là Người bán của sản phẩm liên quan)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Xác nhận đơn hàng thành công. Đơn hàng chuyển sang trạng thái hoàn thành.",
    "data": {
      "id": "65fa8b9c0d1e2f3a4b5c6d7e",
      "status": "COMPLETED",
      "confirmedAt": "2026-06-02T07:20:00.000Z"
    }
  }
  ```
- **Sự kiện tiếp theo**:
  - `Order Service` phát sự kiện `order.completed`.
  - `Product Service` cập nhật sản phẩm sang `SOLD`.
  - `User Service` nhận thông tin để cập nhật điểm Karma cho người bán (+5 Karma khi hoàn tất giao dịch chất lượng).

---

### Từ chối đơn hàng từ người bán (`PATCH /orders/:id/reject`)
Người bán từ chối bán sản phẩm (Ví dụ: do bận học hoặc sản phẩm bị hỏng).

- **URL**: `/orders/65fa8b9c0d1e2f3a4b5c6d7e/reject`
- **Method**: `PATCH`
- **Auth**: Required
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đã từ chối đơn hàng. Sản phẩm đã được giải phóng trở lại.",
    "data": {
      "id": "65fa8b9c0d1e2f3a4b5c6d7e",
      "status": "CANCELLED"
    }
  }
  ```
- **Sự kiện tiếp theo**:
  - Phát sự kiện `order.cancelled`.
  - `Product Service` chuyển trạng thái sản phẩm trở lại `APPROVED` để người khác tiếp tục tìm kiếm và mua.

---

## 💬 4. Chat Service (`/api/v1/chat` & WebSockets)

Dịch vụ hỗ trợ người dùng nhắn tin trực tiếp và trao đổi chi tiết về sản phẩm theo thời gian thực (Real-time).

### Lấy danh sách hội thoại (`GET /chat/conversations`)
Lấy danh sách các cuộc trò chuyện của người dùng hiện tại.

- **URL**: `/chat/conversations`
- **Method**: `GET`
- **Auth**: Required
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Lấy danh sách hội thoại thành công",
    "data": [
      {
        "id": "65bc12ab34cd56ef789012ab",
        "participant": {
          "id": "65ab1c2d3e4f5a6b7c8d9e0f",
          "fullName": "Nguyễn Văn B",
          "avatarUrl": "https://..."
        },
        "lastMessage": {
          "content": "Sách này còn không bạn ơi?",
          "senderId": "65ab1c2d3e4f5a6b7c8d9e0f",
          "createdAt": "2026-06-02T07:05:00.000Z",
          "read": false
        },
        "unreadCount": 1
      }
    ]
  }
  ```

---

### Giao thức WebSocket STOMP

Kết nối WebSocket qua Gateway được bảo mật bằng JWT xác thực.

#### Kết nối đến WebSocket Gateway
- **Endpoint**: `ws://localhost:3007/ws`
- **Connection Headers**:
  - `Authorization`: `Bearer <access_token>`

#### 1. Đăng ký nhận tin nhắn trong phòng hội thoại (Subscribe)
Client đăng ký nhận thông điệp realtime từ một phòng trò chuyện cụ thể.
- **Destination**: `/topic/chat/{conversationId}`

#### 2. Gửi tin nhắn text (Send)
Client gửi tin nhắn văn bản vào phòng chat.
- **Destination**: `/app/chat`
- **Payload**:
  ```json
  {
    "conversationId": "65bc12ab34cd56ef789012ab",
    "content": "Sách này còn không bạn ơi?",
    "receiverId": "65de9f8e7d6c5b4a3f2e1d0c"
  }
  ```

#### 3. Báo đang nhập chữ (Typing Indicator)
Gửi trạng thái cho đối phương biết mình đang gõ chữ.
- **Destination**: `/app/typing`
- **Payload**:
  ```json
  {
    "conversationId": "65bc12ab34cd56ef789012ab",
    "isTyping": true
  }
  ```

---

## 🔔 5. Notification Service (`/api/v1/notifications`)

Dịch vụ tiếp nhận các sự kiện phân tán từ Kafka và phân phối thông báo đến client thông qua WebSocket, Push Notification (Firebase Cloud Messaging - FCM) và gửi OTP qua Email SMTP.

### Đăng ký token Firebase FCM (`POST /notifications/fcm/register`)
Đăng ký FCM Token từ trình duyệt/điện thoại di động để nhận thông báo đẩy.

- **URL**: `/notifications/fcm/register`
- **Method**: `POST`
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "token": "d8a1c93b7f...firebase_fcm_token_string..."
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đăng ký FCM Token thành công"
  }
  ```

---

### Lấy danh sách thông báo cá nhân (`GET /notifications`)
Xem các thông báo trong ứng dụng (in-app notifications).

- **URL**: `/notifications`
- **Method**: `GET`
- **Auth**: Required
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Lấy danh sách thông báo thành công",
    "data": [
      {
        "id": "65ea9b8c7d6e5f4a3b2c1d0e",
        "title": "Sản phẩm đã được duyệt",
        "body": "Sản phẩm 'Bàn học gấp gọn sinh viên' của bạn đã được ban quản trị phê duyệt và đăng bán thành công.",
        "type": "PRODUCT_APPROVED",
        "isRead": false,
        "createdAt": "2026-06-02T07:13:00.000Z"
      }
    ]
  }
  ```

---

## 🔍 6. Lost & Found Service (`/api/v1/lost-found`)

Dịch vụ hỗ trợ sinh viên đăng tin tìm kiếm đồ thất lạc hoặc trả lại đồ nhặt được trong khuôn viên trường IUH. Tích hợp AI để tự động phát hiện và gợi ý trùng khớp (Matching).

### Đăng tin đồ thất lạc/nhặt được (`POST /lost-found`)
Đăng tin báo mất hoặc báo nhặt được vật phẩm.

- **URL**: `/lost-found`
- **Method**: `POST`
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "title": "Nhặt được ví Da màu đen tại nhà D",
    "description": "Mình nhặt được chiếc ví da nam màu đen ở hành lang lầu 3 nhà D. Bên trong có thẻ sinh viên tên Nguyễn Văn B và một số giấy tờ.",
    "type": "FOUND", // Lựa chọn: "LOST" (Báo mất) hoặc "FOUND" (Nhặt được)
    "location": "Nhà D, lầu 3",
    "foundDate": "2026-06-02T09:30:00.000Z",
    "images": [
      "https://iuh-exchange-images.s3.ap-southeast-1.amazonaws.com/lostfound/wallet1.jpg"
    ]
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Đăng tin thành công. Hệ thống đang đối sánh AI để tìm kiếm đồ thất lạc tương đương.",
    "data": {
      "id": "651a2b3c4d5e6f7a8b9c0d1e",
      "title": "Nhặt được ví Da màu đen tại nhà D",
      "type": "FOUND",
      "status": "OPEN",
      "createdAt": "2026-06-02T07:18:00.000Z"
    }
  }
  ```
- **Mô tả tính năng AI Matching tự động**:
  Khi một tin đăng mới được tạo:
  1. `Lost & Found Service` sẽ phân tích dữ liệu văn bản và hình ảnh.
  2. Tìm kiếm trong cơ sở dữ liệu các tin đăng ngược loại (ví dụ: Tin `FOUND` sẽ tìm các tin `LOST` đối sánh).
  3. Nếu phát hiện tin khớp tiềm năng (ví dụ: có tin `LOST` là "Mất ví màu đen ở nhà D"), hệ thống sẽ phát tín hiệu để `Notification Service` gửi thông báo gợi ý kết nối đến cả 2 bên.

---

## 🛠️ Mã Trạng Thái Lỗi Hệ Thống (System Error Codes)

Bảng chi tiết các mã lỗi trả về trong payload khi có sự cố giúp lập trình viên Frontend dễ dàng bắt lỗi và hiển thị thông báo phù hợp cho sinh viên:

| Mã Lỗi (Code) | HTTP Status | Mô Tả Ý Nghĩa | Hướng Xử Lý Phía Client |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | Access Token không hợp lệ hoặc hết hạn. | Thực hiện gọi API `refresh-token` để lấy token mới. |
| `FORBIDDEN` | 403 | Không đủ quyền truy cập (Ví dụ: Thao tác admin nhưng tài khoản là sinh viên). | Hiển thị màn hình thông báo từ chối truy cập. |
| `BAD_REQUEST` | 400 | Dữ liệu đầu vào không hợp lệ hoặc thiếu trường bắt buộc. | Kiểm tra các trường đỏ cảnh báo và sửa dữ liệu. |
| `NOT_FOUND` | 404 | Tài nguyên (sản phẩm, đơn hàng, người dùng) không tồn tại. | Điều hướng người dùng về trang chủ hoặc trang 404. |
| `CONFLICT` | 409 | Xung đột dữ liệu (Ví dụ: Mã số sinh viên đã đăng ký trước đó). | Thông báo tài khoản đã tồn tại và gợi ý lấy lại mật khẩu. |
| `LOW_KARMA` | 403 | Điểm uy tín Karma của người dùng xuống mức âm (< 0). | Khóa chức năng đăng bài, hiển thị lý do vi phạm chính sách. |
| `RATE_LIMIT_EXCEEDED` | 429 | Gửi quá nhiều yêu cầu lên hệ thống trong thời gian ngắn. | Thiết lập bộ đếm giây khóa nút bấm và thử lại sau 1 phút. |
| `CIRCUIT_BREAKER_OPEN` | 503 | Một service nội bộ đang quá tải hoặc gặp lỗi nặng. | Hiển thị thông báo "Hệ thống đang bảo trì dịch vụ này". |
| `INTERNAL_SERVER_ERROR` | 500 | Lỗi không xác định xảy ra ở phía Backend. | Yêu cầu người dùng thử lại sau hoặc liên hệ ban quản trị. |
