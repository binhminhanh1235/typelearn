# TypeLearn

Ứng dụng web học và ghi nhớ kiến thức từ Markdown bằng cách **gõ lại từng đoạn văn** (kiểu 10fastfingers), kết hợp Đọc · Viết · Nghe (TTS) · Nói (SpeechRecognition). Triển khai trên Tencent EdgeOne Pages (Static + Edge Functions + KV).

- Đọc và luyện tập: công khai, mọi thiết bị.
- Thêm/sửa/xoá bài: cần `ADMIN_TOKEN`.
- Parse Markdown ở client; server chỉ lưu và trả dữ liệu.

## Chạy nhanh

```bash
npm install
npm run dev       # dev server (Vite)
npm run build     # build ra dist/
npm test          # vitest
```

Deploy và cấu hình KV / `ADMIN_TOKEN`: xem [DEPLOY_EDGEONE.md](DEPLOY_EDGEONE.md). Kế hoạch chi tiết: [typing-learn-app-plan.md](typing-learn-app-plan.md).

## Import nội dung

Một file `.md` = một bài học. Vào **Thêm bài**, dán nội dung, xem trước kết quả parse (số khối gõ / flow / code), rồi lưu (cần admin token).

### Template chuẩn

Sao chép file mẫu: [templates/note-template.md](templates/note-template.md).

Muốn AI sinh bài đúng format: dùng prompt trong [templates/prompt-generate-note.md](templates/prompt-generate-note.md).

### Front matter (đầu file)

| Trường | Bắt buộc | Mô tả |
|---|---|---|
| `title` | Có* | Tiêu đề bài. Nếu thiếu, lấy heading đầu tiên; nếu không có sẽ là "Bài học mới" |
| `category` | Không | Đúng 1 giá trị. Mặc định `General` |
| `tags` | Không | Mảng: `[a, b, c]` |
| `lang` | Không | `en-US` (mặc định), `vi-VN`... Dùng chọn giọng TTS và nhận dạng giọng nói |

### Quy tắc phân loại khối

| Thành phần Markdown | Vai trò | Gõ? |
|---|---|---|
| Đoạn văn thường | Khối luyện gõ | ✅ |
| Mỗi mục danh sách `-` hoặc `1.` | Một khối luyện gõ | ✅ |
| Heading `#`, `##`... | Mục lục / phân đoạn | ❌ |
| ```` ```mermaid ```` | Sơ đồ minh hoạ | ❌ |
| ```` ```java ````, ```` ```sql ````... | Code có tô màu | ❌ |
| Blockquote `>` | Ghi chú mờ (dùng để loại đoạn khỏi luyện gõ) | ❌ |
| Ảnh `![]()` | Minh hoạ | ❌ |

### Mẹo viết bài để gõ tốt

- Mỗi đoạn/mục nên ngắn (1–3 câu) để dễ luyện.
- Markdown inline (`**đậm**`, `` `code` ``, `[link](url)`) sẽ được gỡ, chỉ giữ chữ thuần khi chấm.
- Khoảng trắng thừa và dấu nháy thông minh (`’ “ ”`) được chuẩn hoá tự động.
- Đoạn không muốn gõ (ví dụ giải thích phụ): đặt trong blockquote `>`.
- HTML thô bị lọc để chống XSS.

## Phím tắt

| Phím | Tác dụng |
|---|---|
| `Enter` | Sang khối tiếp theo |
| `Tab` / `Ctrl+R` | Gõ lại khối hiện tại |
| `Esc` | Thoát về màn Đọc / Kho |
| `Ctrl/Cmd+J` | Nghe TTS khối hiện tại |
| `Ctrl/Cmd+K` | Focus ô tìm kiếm (Kho) |

## Cấu trúc thư mục

```text
src/            # pages, components, lib (parseNote, typingEngine, speech, api)
edge-functions/ # /api/notes (GET công khai; POST/PUT/DELETE cần Admin)
templates/      # file Markdown mẫu để import
tests/          # kiểm thử
```

## API

| Method | Endpoint | Quyền |
|---|---|---|
| GET | `/api/notes` | Công khai |
| POST | `/api/notes` | Admin |
| GET | `/api/notes/:id` | Công khai |
| PUT / DELETE | `/api/notes/:id` | Admin |

Ghi: header `Authorization: Bearer <ADMIN_TOKEN>`. KV đồng bộ chậm (~60s) nên UI cập nhật theo response, không đọc lại ngay.
