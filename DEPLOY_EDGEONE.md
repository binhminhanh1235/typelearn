# Hướng Dẫn Deploy TypeLearn Lên Tencent EdgeOne Pages

Tài liệu này hướng dẫn chi tiết cách triển khai ứng dụng **TypeLearn** lên nền tảng **Tencent EdgeOne Pages (EdgeOne Makers)**, bao gồm cả Frontend tĩnh và Serverless Edge Functions + KV Storage.

---

## 1. Tổng quan Kiến trúc khi Triển khai

Ứng dụng TypeLearn gồm 3 thành phần chính:
1. **Frontend (SPA)**: Viết bằng Preact + Vite, được build thành các tệp tĩnh tối ưu đặt trong thư mục `dist/`.
2. **Edge Functions (APIs)**: Đặt trong thư mục `edge-functions/api/`, chạy trên môi trường **V8 Runtime** phân tán toàn cầu tại các PoP của Tencent EdgeOne (không phải Node.js server).
3. **KV Storage**: Cơ sở dữ liệu phân tán Key-Value của EdgeOne, được truy cập dưới dạng **biến toàn cục** (`TYPELEARN_KV` hoặc `my_kv`) để lưu:
   - `index`: Danh mục tóm tắt toàn bộ bài học.
   - `note:{id}`: Chi tiết nội dung Markdown của từng bài học.
   - `stats:{syncCode}`: Lịch sử, WPM, độ chính xác gõ theo mã đồng bộ cá nhân.
4. **Environment Variables**:
   - `ADMIN_TOKEN`: Khóa bí mật dùng để xác thực quyền thêm/sửa/xóa bài học qua API.

---

## 2. Cách 1: Deploy qua Web Console (Khuyên dùng — Tự động CI/CD qua Git)

Đây là phương thức khuyến nghị giúp bạn tự động build và deploy mỗi khi push code lên GitHub hoặc GitLab.

### Bước 1: Đẩy mã nguồn lên Git
Đảm bảo mã nguồn dự án đã được commit và push lên repository (GitHub / GitLab).

### Bước 2: Tạo dự án trên EdgeOne Pages Console
1. Truy cập bảng điều khiển [Tencent EdgeOne Pages Console](https://console.cloud.tencent.com/edgeone/pages) (hoặc trang Global nếu dùng tài khoản quốc tế).
2. Chọn **Pages (Makers)** -> Bấm **Create Project** (Tạo dự án mới).
3. Chọn Git Provider (GitHub/GitLab) và chọn repository của dự án.

### Bước 3: Cấu hình Build & Deploy Settings
Điền thông tin cấu hình như sau:
- **Framework Preset**: `Vite` (hoặc `Custom`)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Node.js Version**: Chọn `18.x` hoặc `20.x`
- **Functions Directory**: `edge-functions` (EdgeOne sẽ tự động nhận diện nếu đúng quy chuẩn thư mục).

### Bước 4: Tạo và Gán (Bind) KV Storage
Edge Functions của TypeLearn cần KV Storage để lưu trữ bài học và lịch sử luyện tập:
1. Tại menu bên trái của Console, vào mục **KV Storage**.
2. Bấm **Create Namespace** -> Đặt tên namespace (ví dụ: `typelearn-kv`).
3. Quay lại trang cài đặt dự án vừa tạo: **Project Settings** -> **Bindings** (hoặc **Storage**).
4. Thêm binding mới:
   - **Type**: `KV Storage`
   - **Namespace**: Chọn `typelearn-kv` vừa tạo.
   - **Variable Identifier (Tên biến toàn cục)**: Nhập `TYPELEARN_KV` (hoặc `my_kv`).
   > ⚠️ **Lưu ý**: Mã nguồn `edge-functions/api/_shared.js` đã hỗ trợ tự động cả 2 tên biến `TYPELEARN_KV` và `my_kv`.

### Bước 5: Cấu hình Biến môi trường (Environment Variables)
1. Trong mục **Project Settings** -> **Environment Variables**.
2. Thêm biến:
   - **Key**: `ADMIN_TOKEN`
   - **Value**: `<mã_bảo_mật_tự_chọn>` (ví dụ: `my_super_secret_token_2026`)
   - **Target**: Chọn Production (và Preview nếu muốn).
3. Lưu cấu hình.

### Bước 6: Kích hoạt Deploy
Bấm nút **Deploy**. EdgeOne Pages sẽ kéo code, chạy `npm run build` tạo thư mục `dist/`, đóng gói các file trong `edge-functions/` và gán KV binding.

---

## 3. Cách 2: Deploy trực tiếp bằng EdgeOne CLI (Dành cho Terminal / CI)

Nếu muốn deploy trực tiếp từ máy cá nhân hoặc script CI/CD mà không qua giao diện web:

### Bước 1: Cài đặt EdgeOne CLI
```bash
npm install -g edgeone@latest
```
Kiểm tra phiên bản (yêu cầu `>= 1.6.0`):
```bash
edgeone -v
```

### Bước 2: Thiết lập biến môi trường bắt buộc
Trước khi chạy lệnh CLI của EdgeOne, thiết lập biến phiên làm việc:
```bash
export PAGES_SOURCE=skills
```

### Bước 3: Đăng nhập tài khoản EdgeOne
Chạy lệnh đăng nhập qua trình duyệt:
```bash
edgeone login
```
*(Hệ thống sẽ hỏi bạn chọn **Global Site** hay **China Site**, sau đó mở trình duyệt để xác thực).*

Nếu môi trường không có trình duyệt (CI/CD server), sử dụng API Token:
```bash
edgeone login --token <YOUR_ACCOUNT_API_TOKEN>
```

### Bước 4: Build ứng dụng Frontend
```bash
npm run build
```
Lệnh này sẽ kiểm tra TypeScript/JSX và tạo gói tĩnh hoàn chỉnh trong thư mục `dist/`.

### Bước 5: Thực hiện Deploy
Chạy lệnh deploy thư mục `dist`:
```bash
PAGES_SOURCE=skills edgeone makers deploy ./dist
```
CLI sẽ tải lên tài nguyên tĩnh và liên kết thư mục `edge-functions/`.

> 💡 **Lưu ý sau lần deploy đầu tiên qua CLI**:
> Bạn vẫn cần truy cập Console của dự án đó 1 lần để:
> 1. Bind KV Storage namespace vào biến `TYPELEARN_KV`.
> 2. Khai báo biến môi trường `ADMIN_TOKEN`.

---

## 4. Tự động hóa Triển khai với GitHub Actions (CI/CD)

Dự án đã tích hợp sẵn workflow tự động tại `.github/workflows/ci-cd.yml`. Mỗi khi bạn push commit lên nhánh `master` hoặc `main`:
1. **Kiểm thử tự động (Unit Test)**: Chạy 11 test suites kiểm tra markdown parser, typing engine xử lý IME tiếng Việt và V8 handlers.
2. **Đóng gói (Build)**: Tối ưu hóa bundle Vite + Preact.
3. **Triển khai lên EdgeOne Pages**: Tự động gọi EdgeOne CLI để deploy lên môi trường Production.

### Các bước kích hoạt CI/CD Deploy:
1. Lấy API Token từ EdgeOne Console:
   - Truy cập: [EdgeOne Pages Settings (China)](https://console.cloud.tencent.com/edgeone/pages?tab=settings) hoặc [EdgeOne Pages Settings (Global)](https://console.intl.cloud.tencent.com/edgeone/pages?tab=settings).
   - Vào mục **API Token** -> Bấm **Create Token** và sao chép mã token.
2. Cấu hình GitHub Secret:
   - Mở repository trên GitHub: `https://github.com/binhminhanh1235/typelearn`
   - Vào **Settings** -> **Secrets and variables** -> **Actions**.
   - Bấm **New repository secret**:
     - **Name**: `EDGEONE_TOKEN`
     - **Secret**: Dán API Token bạn vừa sao chép.
3. *(Tùy chọn)* Cấu hình tên dự án nếu muốn khác `typelearn`:
   - Trong **Settings** -> **Secrets and variables** -> **Actions** -> tab **Variables**.
   - Thêm Variable `EDGEONE_PROJECT_NAME` với giá trị tên dự án của bạn trên EdgeOne.

Sau khi thiết lập, mọi commit đẩy lên `master` sẽ tự động kích hoạt workflow, chạy kiểm thử và cập nhật ngay lên EdgeOne Pages.

---

## 5. Nghiệm thu & Kiểm tra Sau khi Triển khai

Sau khi deploy thành công, bạn sẽ nhận được URL truy cập (mặc định dạng `https://<project-id>.edgeone.cool?eo_token=...` hoặc custom domain đã gán):

1. **Khởi tạo dữ liệu mẫu (Seed Data)**:
   - Khi truy cập web lần đầu, gọi API `GET /api/notes`.
   - Nếu KV đang rỗng, hệ thống sẽ tự động nạp 2 bài học mẫu (Saga Pattern & V8 Edge Functions) vào KV.
2. **Kiểm tra chức năng Luyện gõ & Âm thanh**:
   - Chọn một bài học, thử gõ với bộ gõ tiếng Việt (Telex / VNI) để kiểm tra độ trễ dưới 16ms.
   - Thử bật Text-to-Speech (`Ctrl + J`) và gõ hết khối để xác nhận WPM / Accuracy.
3. **Kiểm tra Đồng bộ Tiến độ (Sync Code)**:
   - Vào mục Cài đặt / Tiến độ, nhập một mã đồng bộ cá nhân bất kỳ (ví dụ: `my-passkey-888`).
   - Luyện tập 1 bài, kiểm tra xem dữ liệu có lưu thành công vào KV (`stats:my-passkey-888`) không.
4. **Kiểm tra Thêm / Chỉnh sửa bài viết (Admin)**:
   - Vào trang Thêm bài học mới (`/add`).
   - Nhập Markdown và nhập `ADMIN_TOKEN` đã cấu hình ở Bước 5.
   - Bấm Lưu. Nếu lưu thành công và xuất hiện trong Kho bài viết, Edge Functions và KV đã hoạt động hoàn hảo.

---

## 6. Các Lỗi Thường Gặp & Cách Khắc Phục (Troubleshooting)

| Hiện tượng | Nguyên nhân | Cách khắc phục |
|---|---|---|
| Mở link `.edgeone.cool` bị lỗi **401 Unauthorized** | Truy cập thiếu tham số query bảo mật | Phải copy **toàn bộ URL** bao gồm cả phần `?eo_token=...&eo_time=...`. Sau khi gán Custom Domain, link sẽ không còn cần token này. |
| Thêm/sửa bài báo lỗi `"Chưa cấu hình ADMIN_TOKEN trên môi trường Edge"` (500) | Chưa tạo biến môi trường trong Console | Vào **Project Settings** -> **Environment Variables** -> Thêm `ADMIN_TOKEN`. |
| Bài viết thêm thành công nhưng không thấy cập nhật ngay ở thiết bị khác | KV có độ trễ đồng bộ toàn cầu (Eventual Consistency) | KV EdgeOne mất tối đa ~60 giây để đồng bộ giữa các cụm Edge toàn cầu. Frontend TypeLearn đã hỗ trợ cập nhật UI tức thì (Optimistic UI) trên máy của người thực hiện. |
| Báo lỗi `TYPELEARN_KV is not defined` hoặc không lưu được dữ liệu | Chưa bind KV Namespace vào project | Vào **Project Settings** -> **Bindings** -> Tạo binding tới KV namespace với biến `TYPELEARN_KV`. |
| API trả về lỗi cú pháp JSON | Sử dụng sai cú pháp `Response.json()` trong V8 runtime | V8 Edge Functions không có `Response.json()`. Luôn dùng `new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })` (đã được bọc chuẩn trong `_shared.js`). |
