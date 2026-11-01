import { useEffect } from 'preact/hooks';
import { speakText } from '../lib/speech.js';
import { getSyncCode } from '../lib/storage.js';

export function Summary({
  summary,
  onRetry,
  onReadNote,
  onBackLibrary,
  onOpenSettings
}) {
  const syncCode = getSyncCode();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (onRetry) onRetry();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (onBackLibrary) onBackLibrary();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRetry, onBackLibrary]);

  if (!summary) return null;

  const mistyped = summary.mistypedWords || [];

  return (
    <main class="page-container">
      <section class="summary-card" aria-labelledby="summary-heading">
        <div style={{ textAlign: 'center' }}>
          <span class="badge badge-lang">{summary.lang || 'en-US'}</span>
          <h1 id="summary-heading" style={{ margin: '10px 0 4px', fontSize: '1.65rem' }}>
            Hoàn thành phiên luyện gõ!
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            {summary.noteTitle} · Đã hoàn thành {summary.blocksCompleted}/{summary.totalBlocks} khối
          </p>
        </div>

        <div class="summary-stats-grid">
          <div class="summary-stat-box">
            <div class="summary-stat-val tabular-nums">{summary.wpm}</div>
            <div class="count-label">Tốc độ (WPM)</div>
          </div>
          <div class="summary-stat-box">
            <div class="summary-stat-val tabular-nums">{summary.accuracy}%</div>
            <div class="count-label">Độ chính xác</div>
          </div>
          <div class="summary-stat-box">
            <div class="summary-stat-val tabular-nums">{summary.formattedTime}</div>
            <div class="count-label">Thời gian</div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '10px' }}>
            Từ cần ôn lại ({mistyped.length})
          </h2>
          {mistyped.length === 0 ? (
            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                background: 'var(--bg-subtle)',
                color: 'var(--success)',
                fontWeight: 500,
                fontSize: '0.92rem'
              }}
            >
              🎉 Tuyệt vời! Bạn không gõ sai từ nào trong phiên này.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {mistyped.map((item) => (
                <button
                  key={item.word}
                  type="button"
                  class="btn btn-sm"
                  style={{
                    background: 'var(--bg-error)',
                    borderColor: 'rgba(248, 113, 113, 0.35)'
                  }}
                  onClick={() => speakText(item.word, { lang: summary.lang || 'en-US' })}
                  title="Bấm để nghe phát âm từ này"
                >
                  <strong style={{ color: 'var(--text-error)', fontFamily: 'var(--font-mono)' }}>
                    {item.word}
                  </strong>
                  <span class="tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    ×{item.count} 🔊
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'var(--bg-subtle)',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            fontSize: '0.86rem'
          }}
        >
          {syncCode ? (
            <span>
              ☁️ Đã lưu trên thiết bị & đồng bộ KV theo mã <code>{syncCode}</code>
            </span>
          ) : (
            <span>
              💾 Đã lưu tiến độ trên trình duyệt này. Đặt Mã cá nhân để đồng bộ nhiều thiết bị.
            </span>
          )}
          <button type="button" class="btn btn-sm btn-ghost" onClick={onOpenSettings}>
            Cấu hình Đồng bộ
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            class="btn btn-primary"
            style={{ flex: 1 }}
            onClick={onRetry}
          >
            ↻ Luyện lại (<kbd>Enter</kbd>)
          </button>
          <button type="button" class="btn" onClick={onReadNote}>
            📖 Xem lại bài đọc
          </button>
          <button type="button" class="btn" onClick={onBackLibrary}>
            Về Kho (<kbd>Esc</kbd>)
          </button>
        </div>
      </section>
    </main>
  );
}
