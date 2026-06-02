# 🧪 Hướng Dẫn Kiểm Thử Toàn Diện (Testing Playbook)

Tài liệu này cung cấp các hướng dẫn chi tiết, câu lệnh thực thi và quy trình thực hiện kiểm thử phần mềm cho hệ thống **IUH Campus Exchange Platform Backend**, bao gồm: Kiểm thử đơn vị (Unit Test), Kiểm thử tích hợp (Integration Test) và Kiểm thử hiệu năng/tải (Load Test).

---

## 📐 1. Chiến Lược Kiểm Thử (Testing Strategy)

Hệ thống microservices đòi hỏi một chiến lược kiểm thử đa tầng để đảm bảo tính sẵn sàng, ổn định và hiệu năng cao dưới tải lớn:

```
          ┌─────────────────────────────────────────┐
          │               Load Test                 │  <-- Đảm bảo hệ thống chịu tải cao
          │           (JMeter / K6 / autocannon)    │      không bị nghẽn cổ chai
          └────────────────────┬────────────────────┘
          ┌────────────────────▼────────────────────┐
          │            Integration Test             │  <-- Xác thực luồng gọi API nội bộ,
          │          (Supertest + Mock Kafka)       │      HMAC signature và Saga flow
          └────────────────────┬────────────────────┘
          ┌────────────────────▼────────────────────┐
          │               Unit Test                 │  <-- Xác thực logic nghiệp vụ cốt lõi,
          │         (Vitest / Jest / Sinon mocks)   │      controller, service và models
          └─────────────────────────────────────────┘
```

---

## 🧩 2. Kiểm Thử Đơn Vị (Unit Test)

Kiểm thử đơn vị được thực hiện độc lập cho từng microservice. Chúng tôi sử dụng **Vitest** (hoặc **Jest**) kết hợp với các công cụ tạo bản sao giả lập (Mocking / Stubbing).

### Cách viết một Unit Test chuẩn bằng Vitest/Jest

Một file test nên tuân thủ quy tắc AAA (Arrange - Act - Assert) để đảm bảo tính mạch lạc, dễ đọc.

Dưới đây là một ví dụ mẫu kiểm thử nghiệp vụ cộng điểm Karma trong `user-service`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KarmaService } from '../services/karma.service.js';
import { User } from '../models/user.model.js';

// Mô phỏng (Mock) Model MongoDB
vi.mock('../models/user.model.js');

describe('KarmaService - addPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('nên cộng điểm Karma thành công cho người dùng hợp lệ', async () => {
    // 1. Arrange (Chuẩn bị dữ liệu và hành vi giả lập)
    const mockUserId = '65ab1c2d3e4f5a6b7c8d9e0f';
    const mockUser = {
      _id: mockUserId,
      fullName: 'Nguyễn Văn A',
      karma: 100,
      save: vi.fn().mockResolvedValue(true)
    };
    
    // Giả lập hàm tìm kiếm của Mongoose trả về mockUser
    User.findById = vi.fn().mockResolvedValue(mockUser);

    // 2. Act (Thực hiện hành động kiểm thử)
    const updatedUser = await KarmaService.addPoints(mockUserId, 5, 'Giao dịch hoàn tất uy tín');

    // 3. Assert (Xác minh kết quả đầu ra và hành vi gọi hàm)
    expect(User.findById).toHaveBeenCalledWith(mockUserId);
    expect(mockUser.karma).toBe(105);
    expect(mockUser.save).toHaveBeenCalledTimes(1);
    expect(updatedUser.karma).toBe(105);
  });

  it('nên ném ra lỗi nếu người dùng không tồn tại', async () => {
    // 1. Arrange
    const mockUserId = 'non-existent-id';
    User.findById = vi.fn().mockResolvedValue(null);

    // 2. Act & Assert
    await expect(
      KarmaService.addPoints(mockUserId, 5, 'Lỗi giả định')
    ).rejects.toThrow('Người dùng không tồn tại');
  });
});
```

### Các lệnh chạy Unit Test cục bộ

- **Chạy toàn bộ unit tests của toàn bộ dự án**:
  ```bash
  npm test
  ```
- **Chạy tests và xuất báo cáo độ bao phủ mã nguồn (Coverage Report)**:
  ```bash
  npm test -- --coverage
  ```
  *Báo cáo sẽ được xuất ra thư mục `coverage/` dưới dạng giao diện HTML trực quan.*

- **Chạy test riêng biệt cho một microservice cụ thể**:
  ```bash
  # Chạy test cho User Service
  npm test --workspace=packages/user-service
  
  # Chạy test cho Product Service
  npm test --workspace=packages/product-service
  
  # Chạy test cho Order Service
  npm test --workspace=packages/order-service
  ```

---

## 🔗 3. Kiểm Thử Tích Hợp (Integration Test)

Kiểm thử tích hợp tập trung vào việc xác minh khả năng phối hợp giữa các thành phần khác nhau (Router -> Middleware -> Controller -> Database).

### Các điểm cần lưu ý khi viết Integration Test
1. **Mock các kết nối mạng ngoại vi**: Không nên gọi tới S3 thật hay gửi Email thật trong quá trình chạy test. Sử dụng thư viện mock hoặc thiết lập môi trường sandbox local.
2. **Sử dụng cơ sở dữ liệu ảo trong bộ nhớ (In-memory Database)**: Sử dụng `mongodb-memory-server` để khởi tạo một DB ảo trống cho mỗi lượt test, giúp test chạy nhanh và không làm bẩn dữ liệu thực tế.

### Chạy các kịch bản Integration Test có sẵn

Trong thư mục `tests/` chứa các kịch bản kiểm thử API tích hợp tổng thể viết bằng NodeJS:

- **Chạy kiểm thử sức khỏe (Health Check) hệ thống dịch vụ**:
  ```bash
  node tests/test-services.js
  ```
  *Script này tự động gửi yêu cầu kiểm tra endpoint `/health` của từng microservice đang hoạt động cục bộ để báo cáo trạng thái.*

- **Chạy nhanh bộ kiểm thử khói (Smoke Test) qua Shell Script**:
  ```bash
  ./tests/quick-test.sh
  ```
  *(Dành cho môi trường Linux/Git Bash trên Windows. Tự động kiểm tra luồng API cơ bản).*

---

## 📊 4. Kiểm Thử Hiệu Năng & Tải (Load Testing với JMeter)

Hệ thống được thiết kế phục vụ cộng đồng sinh viên IUH với số lượng truy cập đồng thời lớn trong các khung giờ cao điểm (ví dụ: mùa rao bán sách cũ đầu kỳ học). Do đó, việc kiểm thử hiệu năng là cực kỳ quan trọng.

### Cấu trúc kịch bản kiểm thử tải
Tệp kịch bản kiểm thử tải bằng công cụ Apache JMeter đã được cấu hình sẵn tại đường dẫn [api-load-test.jmx](file:///d:/D%E1%BB%AF%20li%E1%BB%87u/HK2_Nam4/BTnhomKTTKHT/IUH-Exchange_BE/tests/load/api-load-test.jmx).

Kịch bản giả lập hành vi thực tế của **1000 người dùng đồng thời** thực hiện chuỗi hành động:
1. Đăng nhập hệ thống (`POST /auth/login`).
2. Lướt xem danh sách sản phẩm mới đăng (`GET /products`).
3. Tìm kiếm sản phẩm bằng từ khóa (`GET /products/search?keyword=...`).
4. Truy cập xem chi tiết một sản phẩm ngẫu nhiên (`GET /products/:id`).
5. Đặt mua sản phẩm (`POST /orders`).

### Hướng dẫn chạy Load Test bằng JMeter CLI (Khuyên dùng)

Để kết quả đo đạc chính xác và không làm tốn tài nguyên hiển thị GUI của máy tính kiểm thử, hãy luôn chạy JMeter ở chế độ dòng lệnh (Non-GUI / CLI Mode):

1. **Chuẩn bị môi trường**:
   - Cài đặt Java Runtime Environment (JRE) hoặc JDK >= 17.
   - Tải về và cài đặt Apache JMeter >= 5.6.
   - Thêm đường dẫn thư mục `bin` của JMeter vào biến môi trường `PATH` của hệ thống.

2. **Câu lệnh thực thi kiểm thử tải**:
   Di chuyển vào thư mục kiểm thử và chạy lệnh sau:
   ```bash
   cd tests/load
   jmeter -n -t api-load-test.jmx -l results.jtl -e -o ./report-dashboard
   ```
   *Giải thích các tham số:*
   - `-n`: Chạy ở chế độ không có giao diện (Non-GUI).
   - `-t`: Đường dẫn tới tệp kịch bản kiểm thử nguồn `.jmx`.
   - `-l`: Đường dẫn xuất kết quả đo thô sang tệp `.jtl`.
   - `-e`: Tự động tạo báo cáo HTML sau khi hoàn tất kiểm thử.
   - `-o`: Đường dẫn thư mục sẽ chứa báo cáo giao diện HTML sinh động.

3. **Phân tích báo cáo Dashboard (report-dashboard)**:
   Sau khi hoàn tất, mở tệp `index.html` trong thư mục `report-dashboard` bằng bất kỳ trình duyệt web nào để phân tích các chỉ số vàng:
   - **APDEX (Application Performance Index)**: Chỉ số mức độ hài lòng của người dùng đối với tốc độ phản hồi (mục tiêu > 0.9).
   - **Throughput (Transaction per Second - TPS)**: Số lượng request xử lý thành công mỗi giây (mục tiêu hệ thống đạt tối thiểu > 800 TPS).
   - **Error %**: Tỉ lệ lỗi phát sinh (mục tiêu < 0.1% dưới mức tải 1000 CCU).
   - **Response Time Percentiles**: Xem mốc thời gian phản hồi `95th Percentile` và `99th Percentile` để đảm bảo không có người dùng nào phải đợi quá 2 giây.
