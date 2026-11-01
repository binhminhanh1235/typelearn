# Prompt: sinh bài học đúng format TypeLearn

Cách dùng: sao chép khối prompt bên dưới vào ChatGPT / Claude / Gemini, thay các phần `{{...}}`, rồi dán kết quả vào màn **Thêm bài**.

---

## Prompt

````text
Bạn là trợ lý biên soạn bài học cho ứng dụng luyện gõ TypeLearn. Hãy viết MỘT bài học về chủ đề bên dưới, xuất ra đúng định dạng Markdown theo quy tắc dưới đây.

## Đầu vào
- Chủ đề: {{CHỦ_ĐỀ}}
- Category (đúng 1 giá trị): {{CATEGORY}}
- Tags (3–5 tag, chữ thường, không dấu cách): {{TAGS}}
- Ngôn ngữ nội dung (lang): {{en-US hoặc vi-VN}}
- Độ dài: khoảng {{8–15}} khối luyện gõ
- Đối tượng/độ khó: {{người mới / trung cấp / nâng cao}}

## Định dạng đầu ra (BẮT BUỘC)
1. Xuất ra DUY NHẤT nội dung Markdown thô, đặt trong MỘT code block ```markdown để dễ sao chép. Không thêm lời dẫn hay giải thích ngoài code block.
2. Dòng đầu tiên của file là front matter YAML, đúng mẫu:

---
title: <tiêu đề ngắn gọn>
category: <1 giá trị>
tags: [tag1, tag2, tag3]
lang: <en-US hoặc vi-VN>
---

3. Sau front matter, chia bài thành các phần bằng heading `##` (không dùng nhiều hơn 2 cấp heading, không dùng `#` ở thân bài).

## Quy tắc từng thành phần
- Đoạn văn thường: là khối LUYỆN GÕ. Mỗi đoạn 1–3 câu, tối đa ~250 ký tự, một ý duy nhất, tự đứng được.
- Danh sách `-` hoặc `1.`: mỗi mục là một khối gõ riêng, mỗi mục là một câu hoàn chỉnh, không lồng danh sách con.
- Sơ đồ: dùng code block ```mermaid (chỉ hiển thị, không gõ). Tối đa 1–2 sơ đồ, cú pháp mermaid phải hợp lệ. Đặt nhãn có ký tự đặc biệt trong dấu ngoặc kép.
- Code: dùng code block có tên ngôn ngữ (```java, ```sql, ```js...) (chỉ hiển thị, không gõ). Ngắn gọn, chạy được, dưới 15 dòng.
- Ghi chú phụ / mẹo mở rộng / đoạn KHÔNG muốn bắt gõ: dùng blockquote `>` (hiển thị mờ, không gõ).
- Không dùng bảng, HTML thô, ảnh, hay emoji trong khối gõ.

## Quy tắc văn bản cho khối gõ (để gõ được)
- Chỉ dùng ký tự bàn phím thông dụng. Dùng dấu nháy thẳng ' và ", không dùng nháy cong.
- Không dùng viết tắt gây mơ hồ, không dùng ký tự đặc biệt lạ (→, …, —). Dùng dấu gạch ngang `-` thường.
- Hạn chế markdown inline (**đậm**, `code`) trong khối gõ; nếu có thì chỉ dùng ít, vì sẽ bị gỡ khi chấm điểm.
- Nếu lang là vi-VN: viết tiếng Việt có dấu đầy đủ, chuẩn Unicode dựng sẵn (NFC). Thuật ngữ kỹ thuật có thể giữ tiếng Anh.
- Không để dòng trống thừa; mỗi khối cách nhau đúng một dòng trống.

## Bố cục gợi ý
1. `## Khái niệm`: định nghĩa, vì sao cần (2–3 khối gõ).
2. `## Cách hoạt động`: các bước/nguyên lý (danh sách + 1 sơ đồ mermaid).
3. `## Ví dụ`: 1 code block + 1–2 khối gõ giải thích.
4. `## Lưu ý`: ưu/nhược, lỗi thường gặp (danh sách).
5. Kết thúc bằng 1 blockquote `>` tóm tắt hoặc tài liệu tham khảo.

## Kiểm tra trước khi trả lời
- Có front matter với đủ title, category, tags, lang.
- Không có khối gõ nào dài quá ~250 ký tự.
- Sơ đồ mermaid và code đều nằm trong code block có nhãn ngôn ngữ.
- Toàn bộ đầu ra nằm trong đúng một code block ```markdown.
````

---

## Ví dụ điền sẵn

```text
- Chủ đề: Saga pattern trong microservices
- Category: Backend
- Tags: microservices, distributed, saga
- Ngôn ngữ nội dung (lang): en-US
- Độ dài: khoảng 10 khối luyện gõ
- Đối tượng/độ khó: trung cấp
```

## Biến thể: chuyển ghi chú có sẵn thành bài

Thêm đoạn này vào cuối prompt và dán ghi chú thô của bạn:

````text
Thay vì tự nghĩ nội dung, hãy chuyển ghi chú dưới đây thành bài học theo đúng định dạng trên. Giữ nguyên ý, không bịa thêm thông tin; có thể rút gọn câu cho dễ gõ.

<ghi_chú>
{{DÁN GHI CHÚ Ở ĐÂY}}
</ghi_chú>
````

## Kiểm tra kết quả

Dán vào **Thêm bài** và xem phần xem trước: số khối gõ / flow / code phải khớp kỳ vọng. Mẫu chuẩn: [note-template.md](note-template.md).
