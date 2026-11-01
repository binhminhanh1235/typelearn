import { useState } from 'preact/hooks';
import {
  getThemeMode,
  applyThemeMode,
  getAdminToken,
  setAdminToken,
  getSyncCode,
  setSyncCode
} from '../lib/storage.js';
import { pullStatsFromKV, pushStatsToKV } from '../lib/api.js';

export function SettingsModal({ isOpen, onClose, onStatsSynced }) {
  const [theme, setTheme] = useState(getThemeMode());
  const [token, setToken] = useState(getAdminToken());
  const [syncCodeInput, setSyncCodeInput] = useState(getSyncCode());
  const [syncStatus, setSyncStatus] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);

  if (!isOpen) return null;

  const handleThemeChange = (mode) => {
    setTheme(mode);
    applyThemeMode(mode);
  };

  const handleSave = () => {
    setAdminToken(token);
    const cleaned = setSyncCode(syncCodeInput);
    setSyncCodeInput(cleaned);
    onClose();
  };

  const handleSyncNow = async () => {
    const cleaned = setSyncCode(syncCodeInput);
    setSyncCodeInput(cleaned);
    if (!cleaned) {
      setSyncStatus('Vui lòng nhập Mã cá nhân (Sync Code) trước khi đồng bộ.');
      return;
    }
    setSyncBusy(true);
    setSyncStatus('Đang đồng bộ tiến độ với EdgeOne KV…');
    try {
      await pullStatsFromKV(cleaned);
      const pushRes = await pushStatsToKV(cleaned);
      if (pushRes.synced) {
        setSyncStatus('Đã đồng bộ tiến độ thành công với EdgeOne KV!');
        if (onStatsSynced) onStatsSynced(pushRes.stats);
      } else {
        setSyncStatus('Đã lưu cục bộ (chế độ ngoại tuyến).');
      }
    } catch (err) {
      setSyncStatus('Không thể đồng bộ lúc này. Đã giữ an toàn trên thiết bị.');
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <div
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="modal-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 id="settings-modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>
            Cài đặt & Đồng bộ
          </h2>
          <button type="button" class="btn btn-sm btn-ghost" onClick={onClose} aria-label="Đóng cài đặt">
            Đóng (Esc)
          </button>
        </div>

        <div class="form-group">
          <label class="form-label">Giao diện (Theme)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              class={`btn ${theme === 'dark' ? 'btn-active' : ''}`}
              onClick={() => handleThemeChange('dark')}
            >
              Tối (Zen Dark)
            </button>
            <button
              type="button"
              class={`btn ${theme === 'light' ? 'btn-active' : ''}`}
              onClick={() => handleThemeChange('light')}
            >
              Sáng (Light)
            </button>
            <button
              type="button"
              class={`btn ${theme === 'system' ? 'btn-active' : ''}`}
              onClick={() => handleThemeChange('system')}
            >
              Theo hệ thống
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" htmlFor="sync-code-input">
            Mã đồng bộ cá nhân (Personal Sync Code / Passkey)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="sync-code-input"
              type="text"
              class="form-input"
              placeholder="Ví dụ: thando-2026"
              value={syncCodeInput}
              onInput={(e) => setSyncCodeInput(e.currentTarget.value)}
            />
            <button
              type="button"
              class="btn btn-primary"
              disabled={syncBusy}
              onClick={handleSyncNow}
            >
              {syncBusy ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}
            </button>
          </div>
          <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            Lưu tiến độ vào key <code>stats:&#123;syncCode&#125;</code> trên EdgeOne KV để học tiếp trên mọi thiết bị.
          </small>
          {syncStatus && (
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--accent)' }}>{syncStatus}</p>
          )}
        </div>

        <div class="form-group">
          <label class="form-label" htmlFor="admin-token-input">
            Mã quản trị kho (ADMIN_TOKEN)
          </label>
          <input
            id="admin-token-input"
            type="password"
            class="form-input"
            placeholder="Nhập ADMIN_TOKEN để thêm/sửa/xoá bài học"
            value={token}
            onInput={(e) => setToken(e.currentTarget.value)}
          />
          <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            Chỉ cần thiết khi thêm/sửa/xoá bài viết (Mặc định local dev: <code>admin123</code>).
          </small>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" class="btn" onClick={onClose}>
            Huỷ
          </button>
          <button type="button" class="btn btn-primary" onClick={handleSave}>
            Lưu thiết lập
          </button>
        </div>
      </div>
    </div>
  );
}
