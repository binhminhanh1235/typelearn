import { getSeedIndex, getSeedNoteById } from './seedData.js';
import { getAdminToken, getSyncCode, getAllNoteStats, mergeRemoteStats } from './storage.js';

let cachedIndex = null;
const cachedNotesById = new Map();

/**
 * Lấy danh sách bài học từ /api/notes (ưu tiên dữ liệu vừa cập nhật lạc quan trong phiên)
 */
export async function fetchNotesIndex({ forceRefresh = false } = {}) {
  if (cachedIndex && !forceRefresh) {
    return cachedIndex;
  }

  try {
    const res = await fetch('/api/notes', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : (Array.isArray(data.notes) ? data.notes : []);
    cachedIndex = list;
    return list;
  } catch (_) {
    if (!cachedIndex) {
      cachedIndex = getSeedIndex();
    }
    return cachedIndex;
  }
}

/**
 * Lấy chi tiết 1 bài học theo id
 */
export async function fetchNoteById(id) {
  if (!id) throw new Error('Thiếu ID bài học');
  if (cachedNotesById.has(id)) {
    return cachedNotesById.get(id);
  }

  try {
    const res = await fetch(`/api/notes/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const note = await res.json();
    cachedNotesById.set(id, note);
    return note;
  } catch (err) {
    const seed = getSeedNoteById(id);
    if (seed) {
      const detail = {
        id: seed.id,
        title: seed.title,
        category: seed.category,
        tags: seed.tags,
        lang: seed.lang,
        blocks: seed.blocksCount,
        md: seed.md,
        updatedAt: seed.updatedAt
      };
      cachedNotesById.set(id, detail);
      return detail;
    }
    throw err;
  }
}

/**
 * Tạo bài học mới (Admin) — cập nhật cache ngay từ response để tránh trễ KV 60s
 */
export async function createNote(payload, tokenOverride) {
  const token = (tokenOverride !== undefined ? tokenOverride : getAdminToken()).trim();
  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Không thể tạo bài học (HTTP ${res.status})`);
  }

  const noteDetail = {
    id: data.id,
    title: data.title,
    category: data.category,
    tags: data.tags,
    lang: data.lang,
    blocks: data.blocks,
    md: data.md,
    updatedAt: data.updatedAt
  };

  cachedNotesById.set(noteDetail.id, noteDetail);
  if (Array.isArray(data.index)) {
    cachedIndex = data.index;
  } else if (cachedIndex) {
    cachedIndex = [
      {
        id: noteDetail.id,
        title: noteDetail.title,
        category: noteDetail.category,
        tags: noteDetail.tags,
        lang: noteDetail.lang,
        blocks: noteDetail.blocks,
        updatedAt: noteDetail.updatedAt
      },
      ...cachedIndex.filter((item) => item.id !== noteDetail.id)
    ];
  }

  return noteDetail;
}

/**
 * Cập nhật bài học (Admin) — cập nhật cache ngay từ response
 */
export async function updateNote(id, payload, tokenOverride) {
  const token = (tokenOverride !== undefined ? tokenOverride : getAdminToken()).trim();
  const res = await fetch(`/api/notes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Không thể cập nhật bài học (HTTP ${res.status})`);
  }

  const noteDetail = {
    id: data.id || id,
    title: data.title,
    category: data.category,
    tags: data.tags,
    lang: data.lang,
    blocks: data.blocks,
    md: data.md,
    updatedAt: data.updatedAt
  };

  cachedNotesById.set(noteDetail.id, noteDetail);
  if (Array.isArray(data.index)) {
    cachedIndex = data.index;
  } else if (cachedIndex) {
    cachedIndex = cachedIndex.map((item) =>
      item.id === noteDetail.id
        ? {
            id: noteDetail.id,
            title: noteDetail.title,
            category: noteDetail.category,
            tags: noteDetail.tags,
            lang: noteDetail.lang,
            blocks: noteDetail.blocks,
            updatedAt: noteDetail.updatedAt
          }
        : item
    );
  }

  return noteDetail;
}

/**
 * Xoá bài học (Admin) — cập nhật cache ngay từ response
 */
export async function deleteNote(id, tokenOverride) {
  const token = (tokenOverride !== undefined ? tokenOverride : getAdminToken()).trim();
  const res = await fetch(`/api/notes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Không thể xoá bài học (HTTP ${res.status})`);
  }

  cachedNotesById.delete(id);
  if (Array.isArray(data.index)) {
    cachedIndex = data.index;
  } else if (cachedIndex) {
    cachedIndex = cachedIndex.filter((item) => item.id !== id);
  }

  return data;
}

/**
 * Đồng bộ tiến độ từ KV về máy theo Personal Sync Code
 */
export async function pullStatsFromKV(codeOverride) {
  const syncCode = (codeOverride !== undefined ? codeOverride : getSyncCode()).trim();
  if (!syncCode) return { synced: false, stats: getAllNoteStats() };

  try {
    const res = await fetch(`/api/stats/${encodeURIComponent(syncCode)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const merged = mergeRemoteStats(data.stats || {});
    return { synced: true, syncCode, stats: merged, updatedAt: data.updatedAt };
  } catch (err) {
    return { synced: false, syncCode, stats: getAllNoteStats(), error: err.message };
  }
}

/**
 * Đẩy tiến độ hiện tại lên KV theo Personal Sync Code
 */
export async function pushStatsToKV(codeOverride) {
  const syncCode = (codeOverride !== undefined ? codeOverride : getSyncCode()).trim();
  const localStats = getAllNoteStats();
  if (!syncCode) return { synced: false, stats: localStats };

  try {
    const res = await fetch(`/api/stats/${encodeURIComponent(syncCode)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats: localStats })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const merged = mergeRemoteStats(data.stats || {});
    return { synced: true, syncCode, stats: merged, updatedAt: data.updatedAt };
  } catch (err) {
    return { synced: false, syncCode, stats: localStats, error: err.message };
  }
}
