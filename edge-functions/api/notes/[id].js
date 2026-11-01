import {
  getKV,
  jsonResponse,
  verifyAdmin,
  getSeedNoteById,
  ensureIndexWithSeed
} from '../_shared.js';

export async function onRequestGet(context) {
  try {
    const id = context.params && context.params.id ? String(context.params.id) : '';
    if (!id) {
      return jsonResponse({ error: 'Thiếu ID bài học.' }, 400);
    }

    const kv = getKV();
    if (kv) {
      const note = await kv.get(`note:${id}`, 'json');
      if (note) {
        return jsonResponse(note, 200);
      }
    }

    const seedNote = getSeedNoteById(id);
    if (seedNote) {
      const detail = {
        id: seedNote.id,
        title: seedNote.title,
        category: seedNote.category,
        tags: seedNote.tags,
        lang: seedNote.lang,
        blocks: seedNote.blocksCount,
        md: seedNote.md,
        updatedAt: seedNote.updatedAt
      };
      if (kv) {
        try {
          await kv.put(`note:${id}`, JSON.stringify(detail));
        } catch (_) {}
      }
      return jsonResponse(detail, 200);
    }

    return jsonResponse({ error: 'Không tìm thấy bài học.' }, 404);
  } catch (err) {
    return jsonResponse({ error: 'Lỗi khi tải bài học.', detail: String(err.message || err) }, 500);
  }
}

export async function onRequestPut(context) {
  const auth = verifyAdmin(context);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  try {
    const id = context.params && context.params.id ? String(context.params.id) : '';
    if (!id) {
      return jsonResponse({ error: 'Thiếu ID bài học.' }, 400);
    }

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
    let nextIndex = [indexItem];
    if (kv) {
      const currentIndex = await ensureIndexWithSeed(kv);
      await kv.put(`note:${id}`, JSON.stringify(noteData));
      const exists = currentIndex.some((item) => item.id === id);
      if (exists) {
        nextIndex = currentIndex.map((item) => (item.id === id ? indexItem : item));
      } else {
        nextIndex = [indexItem, ...currentIndex];
      }
      await kv.put('index', JSON.stringify(nextIndex));
    }

    return jsonResponse({
      ...noteData,
      index: nextIndex
    }, 200);
  } catch (err) {
    return jsonResponse({ error: 'Không thể cập nhật bài học.', detail: String(err.message || err) }, 500);
  }
}

export async function onRequestDelete(context) {
  const auth = verifyAdmin(context);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  try {
    const id = context.params && context.params.id ? String(context.params.id) : '';
    if (!id) {
      return jsonResponse({ error: 'Thiếu ID bài học.' }, 400);
    }

    const kv = getKV();
    let nextIndex = [];
    if (kv) {
      const currentIndex = await ensureIndexWithSeed(kv);
      await kv.delete(`note:${id}`);
      nextIndex = currentIndex.filter((item) => item.id !== id);
      await kv.put('index', JSON.stringify(nextIndex));
    }

    return jsonResponse({
      success: true,
      id,
      index: nextIndex
    }, 200);
  } catch (err) {
    return jsonResponse({ error: 'Không thể xoá bài học.', detail: String(err.message || err) }, 500);
  }
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  if (method === 'GET') return onRequestGet(context);
  if (method === 'PUT') return onRequestPut(context);
  if (method === 'DELETE') return onRequestDelete(context);
  return jsonResponse({ error: 'Method not allowed' }, 405);
}
