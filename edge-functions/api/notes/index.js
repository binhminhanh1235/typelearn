import {
  getKV,
  jsonResponse,
  verifyAdmin,
  createNoteId,
  ensureIndexWithSeed
} from '../_shared.js';

export async function onRequestGet() {
  try {
    const kv = getKV();
    const index = await ensureIndexWithSeed(kv);
    return jsonResponse(index, 200);
  } catch (err) {
    return jsonResponse({ error: 'Không thể tải danh sách bài học', detail: String(err.message || err) }, 500);
  }
}

export async function onRequestPost(context) {
  const auth = verifyAdmin(context);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  try {
    const body = await context.request.json();
    const md = typeof body.md === 'string' ? body.md.trim() : '';
    if (!md) {
      return jsonResponse({ error: 'Nội dung Markdown (md) không được để trống.' }, 400);
    }

    const title = String(body.title || 'Bài học chưa đặt tên').trim();
    const category = String(body.category || 'General').trim();
    const tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter(Boolean)
      : [];
    const lang = String(body.lang || 'en-US').trim();
    const blocks = body.blocks || { text: 0, flow: 0, code: 0, note: 0, heading: 0 };
    const updatedAt = new Date().toISOString();
    const id = body.id ? String(body.id).trim() : createNoteId(title);

    const noteData = {
      id,
      title,
      category,
      tags,
      lang,
      blocks,
      md,
      updatedAt
    };

    const indexItem = {
      id,
      title,
      category,
      tags,
      lang,
      blocks,
      updatedAt
    };

    const kv = getKV();
    let currentIndex = [];
    if (kv) {
      currentIndex = await ensureIndexWithSeed(kv);
      await kv.put(`note:${id}`, JSON.stringify(noteData));
      const filtered = currentIndex.filter((item) => item.id !== id);
      const nextIndex = [indexItem, ...filtered];
      await kv.put('index', JSON.stringify(nextIndex));
      currentIndex = nextIndex;
    } else {
      currentIndex = [indexItem];
    }

    return jsonResponse({
      ...noteData,
      index: currentIndex
    }, 201);
  } catch (err) {
    return jsonResponse({ error: 'Không thể lưu bài học mới.', detail: String(err.message || err) }, 500);
  }
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  if (method === 'GET') return onRequestGet(context);
  if (method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method not allowed' }, 405);
}
