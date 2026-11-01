/**
 * Dữ liệu bài học khởi tạo mẫu (Seed Data) khi kho KV trống.
 * Không phụ thuộc thư viện ngoài để dùng chung cho cả Client và Edge Functions.
 */

export const SEED_NOTES = [
  {
    id: 'saga-pattern-in-microservices-seed01',
    title: 'Saga pattern trong Microservices',
    category: 'Backend',
    tags: ['microservices', 'distributed', 'saga'],
    lang: 'en-US',
    updatedAt: '2026-03-01T08:00:00.000Z',
    blocksCount: {
      text: 5,
      flow: 1,
      code: 1,
      note: 1,
      heading: 2,
    },
    md: `---
title: Saga pattern trong Microservices
category: Backend
tags: [microservices, distributed, saga]
lang: en-US
---

## Core Concept

A saga is a sequence of local transactions in a distributed system. Each local transaction updates the database and publishes a message or event to trigger the next local transaction in the saga.

If a local transaction fails because it violates a business rule then the saga executes a series of compensating transactions that undo the changes that were made by the preceding local transactions.

\`\`\`mermaid
sequenceDiagram
  participant Order as Order Service
  participant Payment as Payment Service
  participant Inventory as Inventory Service
  Order->>Payment: Reserve Credit
  Payment->>Inventory: Reserve Stock
  Inventory-->>Order: Order Confirmed
\`\`\`

## Coordination Approaches

- Choreography lets each service produce and listen to other services events and decide if an action should be taken.
- Orchestration uses a central coordinator object to tell the participants what local transactions to execute.
- Compensating transactions must be idempotent and retryable to guarantee eventual data consistency across services.

\`\`\`java
public class CreateOrderSaga {
  @SagaStep(compensate = "cancelOrder")
  public void createOrder(OrderCommand cmd) {
    orderRepository.savePending(cmd.getOrderId());
  }

  public void cancelOrder(OrderCommand cmd) {
    orderRepository.markCancelled(cmd.getOrderId());
  }
}
\`\`\`

> Note: Prefer orchestration for complex sagas with many steps, and choreography for simple workflows with few participants.
`
  },
  {
    id: 'kien-truc-v8-runtime-edgeone-pages-seed02',
    title: 'Kiến trúc V8 Runtime trên EdgeOne Pages',
    category: 'Cloud & Edge',
    tags: ['edgeone', 'v8', 'serverless', 'kv'],
    lang: 'vi-VN',
    updatedAt: '2026-03-01T09:00:00.000Z',
    blocksCount: {
      text: 6,
      flow: 1,
      code: 1,
      note: 1,
      heading: 2,
    },
    md: `---
title: Kiến trúc V8 Runtime trên EdgeOne Pages
category: Cloud & Edge
tags: [edgeone, v8, serverless, kv]
lang: vi-VN
---

## Nguyên lý V8 Isolates tại biên

Edge Functions chạy trên nhân V8 cô lập nhẹ thay vì khởi tạo máy ảo hay tiến trình Node nặng nề. Nhờ vậy thời gian khởi động lạnh gần như bằng không và phản hồi người dùng ngay tại trạm biên gần nhất.

Mỗi hàm xử lý yêu cầu thông qua chuẩn Web APIs hiện đại như Fetch, Request và Response giúp mã nguồn gọn nhẹ và an toàn bảo mật cao.

\`\`\`mermaid
flowchart LR
  User["Trình duyệt người dùng"] --> Edge["Trạm biên EdgeOne V8"]
  Edge --> Static["Tài nguyên tĩnh SPA"]
  Edge --> KV["Bộ nhớ KV phân tán"]
\`\`\`

## Quy tắc cốt lõi khi lập trình Edge

- Luôn khởi tạo đối tượng Response kèm chuỗi JSON thay vì gọi hàm tĩnh không tồn tại trên runtime.
- Truy cập kho lưu trữ KV trực tiếp qua biến toàn cục đã gắn kết vào dự án thay vì đọc từ biến môi trường.
1. Ghi dữ liệu chi tiết của bài học trước rồi mới cập nhật danh mục chỉ mục chung.
2. Tận dụng dữ liệu trả về từ phản hồi mạng để cập nhật giao diện tức thì mà không cần đọc lại ngay.

\`\`\`javascript
export async function onRequestGet(context) {
  const indexData = await my_kv.get('index', 'json');
  return new Response(JSON.stringify(indexData || []), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
\`\`\`

> Lưu ý: Bộ nhớ KV có tính nhất quán cuối cùng trong khoảng sáu mươi giây trên toàn cầu nên giao diện cần ưu tiên cập nhật lạc quan.
`
  }
];

export function getSeedIndex() {
  return SEED_NOTES.map((note) => ({
    id: note.id,
    title: note.title,
    category: note.category,
    tags: note.tags,
    lang: note.lang,
    blocks: note.blocksCount,
    updatedAt: note.updatedAt,
  }));
}

export function getSeedNoteById(id) {
  return SEED_NOTES.find((n) => n.id === id) || null;
}
