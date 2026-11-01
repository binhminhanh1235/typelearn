import { describe, it, expect, beforeEach } from 'vitest';
import * as notesIndex from '../../../edge-functions/api/notes/index.js';
import * as notesById from '../../../edge-functions/api/notes/[id].js';
import * as statsByCode from '../../../edge-functions/api/stats/[syncCode].js';

function createMockKV() {
  const map = new Map();
  return {
    async get(k, type = 'text') {
      if (!map.has(k)) return null;
      const v = map.get(k);
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(k, v) {
      map.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    },
    async delete(k) {
      map.delete(k);
    }
  };
}

describe('Edge Functions (/api/notes & /api/stats)', () => {
  beforeEach(() => {
    globalThis.my_kv = createMockKV();
  });

  it('GET /api/notes khởi tạo và trả về 2 bài Seed Data khi KV trống', async () => {
    const res = await notesIndex.onRequestGet();
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(2);
    expect(list[0].title).toContain('Saga pattern');
  });

  it('POST /api/notes kiểm tra ADMIN_TOKEN, lưu bài mới vào KV và cập nhật index', async () => {
    const badReq = new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', md: 'Hello' })
    });
    const badRes = await notesIndex.onRequestPost({
      request: badReq,
      env: { ADMIN_TOKEN: 'secret123' }
    });
    expect(badRes.status).toBe(401);

    const goodReq = new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret123', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Bài học Redis Caching',
        category: 'Database',
        tags: ['redis', 'cache'],
        lang: 'vi-VN',
        blocks: { text: 2, flow: 0, code: 0, note: 0, heading: 1 },
        md: '## Redis\n\nRedis là bộ nhớ đệm tốc độ cao.'
      })
    });
    const goodRes = await notesIndex.onRequestPost({
      request: goodReq,
      env: { ADMIN_TOKEN: 'secret123' }
    });
    expect(goodRes.status).toBe(201);
    const created = await goodRes.json();
    expect(created.id).toContain('bai-hoc-redis-caching');
    expect(created.index.length).toBe(3);

    // Kiểm tra GET /api/notes/:id
    const detailRes = await notesById.onRequestGet({
      params: { id: created.id }
    });
    expect(detailRes.status).toBe(200);
    const detail = await detailRes.json();
    expect(detail.title).toBe('Bài học Redis Caching');
  });

  it('PUT & GET /api/stats/:syncCode đồng bộ tiến độ học tập qua KV', async () => {
    const putReq = new Request('http://localhost/api/stats/thando2026', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stats: {
          'note-1': { bestWpm: 78, lastAccuracy: 98, completedSessions: 2 }
        }
      })
    });

    const putRes = await statsByCode.onRequestPut({
      request: putReq,
      params: { syncCode: 'thando2026' }
    });
    expect(putRes.status).toBe(200);

    const getRes = await statsByCode.onRequestGet({
      params: { syncCode: 'thando2026' }
    });
    expect(getRes.status).toBe(200);
    const data = await getRes.json();
    expect(data.stats['note-1'].bestWpm).toBe(78);
  });
});
