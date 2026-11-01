import { SEED_NOTES, getSeedIndex, getSeedNoteById } from '../../src/lib/seedData.js';

export { SEED_NOTES, getSeedIndex, getSeedNoteById };

/**
 * Truy cập KV toàn cục chuẩn EdgeOne V8 Runtime (my_kv hoặc TYPELEARN_KV)
 */
export function getKV() {
  if (typeof my_kv !== 'undefined' && my_kv) return my_kv;
  if (typeof TYPELEARN_KV !== 'undefined' && TYPELEARN_KV) return TYPELEARN_KV;
  if (typeof globalThis !== 'undefined') {
    if (globalThis.my_kv) return globalThis.my_kv;
    if (globalThis.TYPELEARN_KV) return globalThis.TYPELEARN_KV;
  }
  return null;
}

/**
 * Trả về JSON Response chuẩn V8 Runtime (Tuyệt đối không dùng Response.json)
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

/**
 * Kiểm tra quyền Admin qua header Authorization: Bearer <ADMIN_TOKEN>
 */
export function verifyAdmin(context) {
  const req = context.request;
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const expectedToken = (context.env && context.env.ADMIN_TOKEN) ? String(context.env.ADMIN_TOKEN).trim() : '';

  if (!expectedToken) {
    return { ok: false, status: 500, error: 'Chưa cấu hình ADMIN_TOKEN trên môi trường Edge.' };
  }
  if (!token || token !== expectedToken) {
    return { ok: false, status: 401, error: 'Mã quản trị (ADMIN_TOKEN) không hợp lệ hoặc bị thiếu.' };
  }
  return { ok: true };
}

/**
 * Tạo slug ID từ tiêu đề + hậu tố ngắn ngẫu nhiên
 */
export function createNoteId(title = 'note') {
  const slug = String(title)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'note';
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${slug}-${suffix}`;
}

/**
 * Khởi tạo Seed Data vào KV nếu kho đang trống
 */
export async function ensureIndexWithSeed(kv) {
  if (!kv) {
    return getSeedIndex();
  }
  let index = await kv.get('index', 'json');
  if (!Array.isArray(index) || index.length === 0) {
    index = getSeedIndex();
    try {
      for (const note of SEED_NOTES) {
        const detail = {
          id: note.id,
          title: note.title,
          category: note.category,
          tags: note.tags,
          lang: note.lang,
          blocks: note.blocksCount,
          md: note.md,
          updatedAt: note.updatedAt
        };
        await kv.put(`note:${note.id}`, JSON.stringify(detail));
      }
      await kv.put('index', JSON.stringify(index));
    } catch (_) {
      // Nếu môi trường chỉ đọc hoặc lỗi ghi tạm thời vẫn trả về seed index
    }
  }
  return index;
}
