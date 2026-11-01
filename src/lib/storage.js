const KEYS = {
  THEME: 'typelearn_theme',
  ADMIN_TOKEN: 'typelearn_admin_token',
  SYNC_CODE: 'typelearn_sync_code',
  SETTINGS: 'typelearn_settings',
  STATS: 'typelearn_stats',
  LAST_SESSION: 'typelearn_last_session'
};

function safeGet(key, fallback = null) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw !== null ? raw : fallback;
  } catch (_) {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch (_) {}
}

/**
 * Quản lý Theme (dark | light | system), mặc định 'dark'
 */
export function getThemeMode() {
  return safeGet(KEYS.THEME, 'dark');
}

export function applyThemeMode(mode = 'dark') {
  safeSet(KEYS.THEME, mode);
  if (typeof document === 'undefined') return;
  let resolved = mode;
  if (mode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
    resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', resolved);
}

/**
 * Quản lý ADMIN_TOKEN
 */
export function getAdminToken() {
  return safeGet(KEYS.ADMIN_TOKEN, '');
}

export function setAdminToken(token) {
  safeSet(KEYS.ADMIN_TOKEN, String(token || '').trim());
}

/**
 * Quản lý Personal Sync Code (Passkey đồng bộ tiến độ qua KV)
 */
export function getSyncCode() {
  return safeGet(KEYS.SYNC_CODE, '');
}

export function setSyncCode(code) {
  const clean = String(code || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  safeSet(KEYS.SYNC_CODE, clean);
  return clean;
}

/**
 * Cài đặt phiên luyện gõ & âm thanh
 */
const DEFAULT_SETTINGS = {
  forceCorrection: true,
  soundEnabled: true,
  ttsRate: 1.0,
  ignoreCase: false,
  ignorePunctuation: false,
  dictationMode: false
};

export function getSettings() {
  const raw = safeGet(KEYS.SETTINGS, null);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function updateSettings(partial) {
  const next = { ...getSettings(), ...partial };
  safeSet(KEYS.SETTINGS, JSON.stringify(next));
  return next;
}

/**
 * Lưu trữ & đọc tiến độ luyện tập từng bài
 */
export function getAllNoteStats() {
  const raw = safeGet(KEYS.STATS, null);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function getNoteStats(noteId) {
  const all = getAllNoteStats();
  return all[noteId] || null;
}

export function saveNoteSessionStats(noteId, sessionResult) {
  const all = getAllNoteStats();
  const prev = all[noteId] || {
    noteId,
    bestWpm: 0,
    lastWpm: 0,
    lastAccuracy: 100,
    completedSessions: 0,
    totalTimeMs: 0,
    mistypedWords: [],
    lastPracticedAt: null
  };

  // Gộp danh sách từ gõ sai
  const wordMap = new Map();
  for (const item of prev.mistypedWords || []) {
    if (item && item.word) wordMap.set(item.word, item.count || 1);
  }
  for (const item of sessionResult.mistypedWords || []) {
    if (item && item.word) {
      wordMap.set(item.word, (wordMap.get(item.word) || 0) + (item.count || 1));
    }
  }

  const mergedMistyped = Array.from(wordMap.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  const updated = {
    noteId,
    bestWpm: Math.max(prev.bestWpm || 0, sessionResult.wpm || 0),
    lastWpm: sessionResult.wpm || 0,
    lastAccuracy: sessionResult.accuracy ?? 100,
    completedSessions: (prev.completedSessions || 0) + 1,
    totalTimeMs: (prev.totalTimeMs || 0) + (sessionResult.elapsedMs || 0),
    blocksCompleted: sessionResult.blocksCompleted || 0,
    totalBlocks: sessionResult.totalBlocks || 0,
    mistypedWords: mergedMistyped,
    lastPracticedAt: new Date().toISOString()
  };

  all[noteId] = updated;
  safeSet(KEYS.STATS, JSON.stringify(all));
  safeSet(KEYS.LAST_SESSION, JSON.stringify({ noteId, ...sessionResult, completedAt: updated.lastPracticedAt }));
  return { updated, all };
}

export function mergeRemoteStats(remoteStatsObj) {
  if (!remoteStatsObj || typeof remoteStatsObj !== 'object') return getAllNoteStats();
  const local = getAllNoteStats();
  const merged = { ...local };

  for (const [noteId, remoteItem] of Object.entries(remoteStatsObj)) {
    if (!remoteItem || typeof remoteItem !== 'object') continue;
    const localItem = merged[noteId];
    if (!localItem) {
      merged[noteId] = remoteItem;
    } else {
      merged[noteId] = {
        ...localItem,
        ...remoteItem,
        bestWpm: Math.max(localItem.bestWpm || 0, remoteItem.bestWpm || 0),
        completedSessions: Math.max(localItem.completedSessions || 0, remoteItem.completedSessions || 0)
      };
    }
  }

  safeSet(KEYS.STATS, JSON.stringify(merged));
  return merged;
}

export function getLastSessionResult() {
  const raw = safeGet(KEYS.LAST_SESSION, null);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}
