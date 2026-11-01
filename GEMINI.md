# TypeLearn — Hướng dẫn Dự án & Quy tắc Phát triển (GEMINI.md)

Tài liệu này là nguồn sự thật (Source of Truth) dành cho các AI Agent làm việc trên dự án **TypeLearn** — ứng dụng web học tập và luyện gõ kiến thức từ Markdown, triển khai trên **Tencent EdgeOne Pages**.

---

## 1. Tổng quan Dự án & Nguyên tắc Cốt lõi

- **Mục tiêu**: Kho lưu trữ kiến thức cá nhân dạng Markdown. Người dùng học và ghi nhớ kiến thức bằng cách gõ lại từng đoạn văn (kiểu 10fastfingers), kết hợp 4 kỹ năng: **Đọc**, **Viết (Gõ)**, **Nghe (TTS)** và **Nói (SpeechRecognition)**.
- **Đối tượng sử dụng**: Một người dùng chính (chủ kho). Đọc và luyện tập mở công khai từ mọi thiết bị; thêm/sửa/xoá bài yêu cầu quyền Admin (`ADMIN_TOKEN`).
- **Nguyên tắc Lean**:
  - Không dùng database ngoài, không hệ thống đăng nhập phức tạp, không backend server riêng.
  - Toàn bộ hosting, API serverless và lưu trữ dùng **EdgeOne Pages (Static Hosting + V8 Edge Functions + KV Storage)**.
  - Parse Markdown ở phía Client. Server chỉ lưu trữ và trả dữ liệu JSON/Markdown.
  - Âm thanh sử dụng Web Speech API có sẵn của trình duyệt (`window.speechSynthesis` và `SpeechRecognition`).

---

## 2. Kiến trúc & Công nghệ (Tech Stack)

### 2.1 Cấu trúc Thư mục Chuẩn
```text
typelearn/
├─ src/
│  ├─ main.jsx             # Entrypoint ứng dụng
│  ├─ pages/               # Library, AddNote, Note, Typing, Summary
│  ├─ components/          # TypingBlock, CodeBlock, MermaidBlock, TagFilter
│  ├─ lib/
│  │  ├─ parseNote.js      # Parse md -> { meta, blocks[] } + chuẩn hoá text
│  │  ├─ typingEngine.js   # So khớp ký tự, xử lý IME, WPM, accuracy
│  │  ├─ speech.js         # Web Speech API: TTS + SpeechRecognition
│  │  └─ api.js            # Client gọi /api/notes + quản lý ADMIN_TOKEN
│  └─ styles/              # CSS thuần với biến màu (Design Tokens)
├─ edge-functions/
│  └─ api/
│     ├─ notes/index.js    # GET /api/notes (công khai), POST /api/notes (Admin)
│     └─ notes/[id].js     # GET (công khai), PUT, DELETE /api/notes/:id (Admin)
├─ typing-learn-app-plan.md
├─ GEMINI.md
└─ package.json
```

### 2.2 Frontend Stack
- **Framework**: Vite + Preact (hoặc Vanilla JS nhẹ), tuyệt đối không dùng thư viện UI nặng.
- **Styling**: CSS thuần sử dụng CSS Variables theo đúng hệ thống Design Tokens của `typelearn-design`.
- **Markdown & Hiển thị**:
  - `marked` hoặc `markdown-it` để phân tích cú pháp Markdown.
  - `DOMPurify` (hoặc khoá HTML thô trong parser) để làm sạch HTML, **bắt buộc chống XSS**.
  - `mermaid`: Nạp lười (`lazy load` / dynamic `import()`) chỉ khi bài học có khối sơ đồ `flow`.
  - `highlight.js`: Chỉ nạp các ngôn ngữ cần thiết để tô màu khối `code`.

---

## 3. Quy tắc Sống còn cho EdgeOne Pages (Edge Functions & KV)

> [!CAUTION]
> Edge Functions chạy trên **V8 Runtime** mỏng của EdgeOne (tương tự Cloudflare Workers), **KHÔNG PHẢI Node.js**. Vi phạm các quy tắc dưới đây sẽ gây lỗi runtime ngay lập tức:

1. **KHÔNG có `Response.json()`**:
   - Tuyệt đối không gọi `Response.json(data)`.
   - Luôn dùng:
     ```javascript
     new Response(JSON.stringify(data), {
       status: 200,
       headers: { 'Content-Type': 'application/json' }
     });
     ```
2. **KV Storage là Biến Toàn cục (Global Variable)**:
   - Namespace KV được bind trong console (ví dụ `my_kv` hoặc `TYPELEARN_KV`) được truy cập **trực tiếp dưới dạng biến toàn cục**, **KHÔNG nằm trong `context.env`**.
   - Sai: `context.env.my_kv.get(...)` ❌
   - Đúng: `await my_kv.get('index', 'json')` ✅
3. **Biến Môi trường (Environment Variables)**:
   - Truy cập qua `context.env.ADMIN_TOKEN`, **không dùng** `process.env`.
4. **Không dùng Module Node.js**:
   - Không `require()`, không `fs`, `path`, `http`, `crypto` của Node. Chỉ dùng Web Standard APIs (`fetch`, `Request`, `Response`, `URL`, `crypto.subtle`, `TextEncoder`).
5. **Eventual Consistency của KV (Đồng bộ ~60 giây)**:
   - KV mất tới 60s để đồng bộ toàn cầu. Sau khi `POST` / `PUT` / `DELETE`, **Frontend phải cập nhật UI ngay bằng dữ liệu trả về từ response** (Optimistic / Response-driven UI update), không gọi `GET` đọc lại ngay lập tức.
6. **Mô hình Dữ liệu KV**:
   - Key `index`: Mảng metadata `[{ id, title, category, tags, lang, blocks, updatedAt }]` giúp tải toàn bộ danh sách bài trong 1 lần đọc.
   - Key `note:{id}`: Chi tiết bài `{ id, title, category, tags, lang, md, updatedAt }`. `id` tạo từ slug tiêu đề + hậu tố ngắn ngẫu nhiên.
   - Khi thêm/sửa/xoá: Ghi `note:{id}` trước, sau đó cập nhật lại key `index`.
7. **Bảo mật API**:
   - Các thao tác ghi (`POST`, `PUT`, `DELETE`) bắt buộc kiểm tra header `Authorization: Bearer <ADMIN_TOKEN>` khớp với `context.env.ADMIN_TOKEN`.

---

## 4. Quy tắc Nghiệp vụ: Markdown Parser & Typing Engine

### 4.1 Định dạng Markdown & Phân loại Khối (`parseNote.js`)
- **Front matter YAML** ở đầu file: `title` (bắt buộc), `category` (1 giá trị), `tags` (mảng, tuỳ chọn), `lang` (mặc định `en-US`, hoặc `vi-VN`).
- **Quy tắc bóc tách `blocks[]`**:
  - `heading` (`#`, `##`, ...): Dùng làm mục lục & phân đoạn, **không gõ**.
  - `text` (Đoạn văn thường & từng mục danh sách `-` hoặc `1.`): **Khối luyện gõ** (`type: 'text'`).
  - `flow` (Khối ```` ```mermaid ````): Chỉ hiển thị sơ đồ minh hoạ, **không gõ**.
  - `code` (Khối ```` ```java ````, ```` ```sql ````, ...): Chỉ hiển thị code highlight, **không gõ**.
  - `note` (Blockquote `>`): Ghi chú phụ hiển thị mờ, **không gõ** (dùng khi muốn bỏ qua một đoạn văn khỏi chế độ luyện gõ).

### 4.2 Chuẩn hoá Văn bản & Typing Engine (`typingEngine.js`)
- **Chuẩn hoá trước khi so khớp**:
  - Gỡ bỏ cú pháp inline markdown (`**bold**`, `*italic*`, `` `code` ``, `[text](url)`) chỉ giữ lại thuần văn bản hiển thị.
  - Chuẩn hoá khoảng trắng liên tiếp thành 1 dấu cách; chuyển dấu nháy thông minh (`’`, `‘` → `'`; `“`, `”` → `"`).
  - Hỗ trợ tuỳ chọn trong phiên luyện: bỏ qua phân biệt hoa/thường, bỏ qua dấu câu.
- **Xử lý Bộ gõ Tiếng Việt (IME - Telex / VNI) — BẮT BUỘC**:
  - Phải lắng nghe sự kiện `compositionstart`, `compositionupdate`, `compositionend`.
  - Khi `isComposing === true`, **tuyệt đối không chấm đúng/sai tức thì** và không dịch chuyển con trỏ làm gãy âm tiết đang gõ dấu.
  - Chỉ chốt ký tự và tính toán WPM / Accuracy sau khi `compositionend` hoàn tất hoặc khi nhận ký tự thường ngoài phiên composition.
- **Hiệu năng gõ**: Input latency phải **< 16ms** (đảm bảo mượt ở tốc độ > 100 WPM).

---

## 5. Quy tắc Thiết kế Giao diện & Trải nghiệm (UI/UX & A11y)

Tuân thủ nghiêm ngặt các chuẩn trong skill `typelearn-design`, `web-design-guidelines`, `frontend-design` và `ui-ux-pro-max`:

1. **Triết lý Zen & Single-Focus Viewport**:
   - Mỗi màn hình chỉ làm 1 việc: **Kho** (tìm kiếm/lọc), **Thêm bài** (paste & preview), **Đọc** (nội dung + TOC), **Gõ** (chỉ hiện khối đang gõ ở tâm màn hình + WPM/Accuracy), **Tổng kết** (kết quả & từ hay sai).
2. **Design Tokens & Typography**:
   - Ưu tiên **Dark Mode** mặc định (`--bg-app: #0f141c`, `--bg-surface: #18202c`, `--text-primary: #f1f5f9`, `--text-untyped: #627284`, `--text-correct: #e2e8f0`/`#4ade80`, `--text-error: #f87171`, `--accent: #38bdf8`) và hỗ trợ Light Mode tương ứng.
   - Font vùng gõ dùng Monospace (`"JetBrains Mono"`, `"Fira Code"`, ` monospace`), cỡ chữ `1.25rem–1.375rem` trên Desktop (`line-height: 1.85`) và `1.125rem` trên Mobile (`line-height: 1.75`).
   - Mọi bộ đếm số liệu (WPM, %, thời gian `mm:ss`) **bắt buộc** dùng `font-variant-numeric: tabular-nums` để chống giật khung hình (CLS).
3. **Hiển thị Lỗi Đa kênh (Colorblind-safe)**:
   - Ký tự gõ sai không chỉ đổi màu `--text-error` mà phải kèm nền `--bg-error` và gạch chân (`underline wavy`). Nếu gõ sai ở vị trí dấu cách (`space`), hiển thị ký hiệu `␣` màu đỏ.
4. **Zero-Mouse Navigation (100% Bàn phím)**:
   - `Enter`: Sang khối gõ tiếp theo (khi đã hoàn thành khối).
   - `Tab` hoặc `Ctrl + R`: Gõ lại khối hiện tại.
   - `Esc`: Thoát màn hình Gõ về màn hình Đọc / Kho.
   - `Ctrl/Cmd + J`: Phát âm thanh TTS khối hiện tại.
   - `Ctrl/Cmd + K`: Focus nhanh vào ô tìm kiếm ở màn hình Kho.
5. **Tối ưu Mobile & Bàn phím Ảo**:
   - Thẻ `<input>` bắt phím phải có `font-size >= 16px` (tránh iOS Safari tự động zoom), kèm `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="text"`.
   - Lắng nghe `window.visualViewport` để giữ khối đang gõ luôn nằm phía trên bàn phím ảo.
   - Kích thước nút chạm tối thiểu `44×44px`, khoảng cách `>= 8px`, có `touch-action: manipulation`.
6. **Accessibility & Motion**:
   - Độ tương phản đạt chuẩn WCAG AA (`>= 4.5:1` cho chữ chưa gõ, `>= 7:1` cho chữ chính).
   - Không dùng `outline: none` nếu không có `:focus-visible` thay thế.
   - Không dùng `<div onClick>` cho hành động; dùng `<button>` hoặc `<a>` đúng ngữ nghĩa.
   - Tôn trọng `@media (prefers-reduced-motion: reduce)` và không dùng `transition: all`.

---

## 6. Hệ thống Skills & Agents trong Dự án

Khi thực hiện tác vụ liên quan, Agent **bắt buộc đọc `SKILL.md` tương ứng** trong `.agents/skills/`:

| Skill | Đường dẫn | Khi nào cần đọc & áp dụng |
|---|---|---|
| `typelearn-design` | `.agents/skills/typelearn-design/SKILL.md` | Thiết kế/xây dựng mọi màn hình của TypeLearn, xử lý IME tiếng Việt, token màu, phím tắt, mobile input. |
| `edgeone-pages-skills` | `.agents/skills/edgeone-pages-skills/SKILL.md` | Viết code `edge-functions/`, thao tác KV storage, chạy preview `edgeone makers dev` hoặc deploy. |
| `frontend-design` | `.agents/skills/frontend-design/SKILL.md` | Định hình bố cục thẩm mỹ, nhịp điệu typography, microcopy tiếng Việt tự nhiên, tránh giao diện rập khuôn. |
| `ui-ux-pro-max` | `.agents/skills/ui-ux-pro-max/SKILL.md` | Tra cứu quy tắc UX chuyên sâu, bảng màu, độ tương phản dark/light mode, animation và responsive layout. |
| `web-design-guidelines` | `.agents/skills/web-design-guidelines/SKILL.md` | Kiểm toán (audit) code giao diện về Accessibility (a11y), focus state, semantic HTML, form và touch. |

### Các Chuyên gia Subagent (`.agents/agents/`)
- **`typelearn-dev`** (`.agents/agents/typelearn-dev.md`): Agent chuyên trách phát triển tính năng Full-stack (Frontend Vite/Preact, Markdown Parser, Typing Engine hỗ trợ IME Tiếng Việt, Web Speech API và EdgeOne V8 Functions + KV).
  - **Model**: `gemini-argon` (Fallback 1: `claude-sonnet`, Fallback cuối: `gemini-3.8-flash`).
- **`typelearn-browser-tester`** (`.agents/agents/typelearn-browser-tester.md`): Agent chuyên trách kiểm thử tự động và rà soát chất lượng trên trình duyệt (E2E flows, kiểm thử gõ phím & bộ gõ tiếng Việt IME, responsive mobile viewport, dark/light mode, keyboard shortcuts và audit WCAG/a11y).
  - **Model**: `gemini-3.8-flash`.
