import { getKV, jsonResponse } from '../_shared.js';

function sanitizeSyncCode(raw) {
  return String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
}

export async function onRequestGet(context) {
  try {
    const rawCode = context.params && context.params.syncCode ? context.params.syncCode : '';
    const syncCode = sanitizeSyncCode(rawCode);
    if (!syncCode) {
      return jsonResponse({ error: 'Mã đồng bộ (syncCode) không hợp lệ.' }, 400);
    }

    const kv = getKV();
    if (!kv) {
      return jsonResponse({ syncCode, stats: {}, updatedAt: null }, 200);
    }

    const data = await kv.get(`stats:${syncCode}`, 'json');
    if (!data) {
      return jsonResponse({ syncCode, stats: {}, updatedAt: null }, 200);
    }

    return jsonResponse(data, 200);
  } catch (err) {
    return jsonResponse({ error: 'Không thể tải tiến độ đồng bộ.', detail: String(err.message || err) }, 500);
  }
}

export async function onRequestPut(context) {
  try {
    const rawCode = context.params && context.params.syncCode ? context.params.syncCode : '';
    const syncCode = sanitizeSyncCode(rawCode);
    if (!syncCode) {
      return jsonResponse({ error: 'Mã đồng bộ (syncCode) không hợp lệ.' }, 400);
    }

    const body = await context.request.json();
    const incomingStats = (body && typeof body.stats === 'object' && body.stats !== null)
      ? body.stats
      : (typeof body === 'object' && body !== null ? body : {});

    const kv = getKV();
    let mergedStats = { ...incomingStats };
    if (kv) {
      const existing = await kv.get(`stats:${syncCode}`, 'json');
      if (existing && existing.stats && typeof existing.stats === 'object') {
        mergedStats = { ...existing.stats, ...incomingStats };
      }
    }

    const payload = {
      syncCode,
      stats: mergedStats,
      updatedAt: new Date().toISOString()
    };

    if (kv) {
      await kv.put(`stats:${syncCode}`, JSON.stringify(payload));
    }

    return jsonResponse(payload, 200);
  } catch (err) {
    return jsonResponse({ error: 'Không thể lưu tiến độ đồng bộ.', detail: String(err.message || err) }, 500);
  }
}

export async function onRequestPost(context) {
  return onRequestPut(context);
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  if (method === 'GET') return onRequestGet(context);
  if (method === 'PUT' || method === 'POST') return onRequestPut(context);
  return jsonResponse({ error: 'Method not allowed' }, 405);
}
