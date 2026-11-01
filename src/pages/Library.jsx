import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { TagFilter } from '../components/TagFilter.jsx';

export function Library({
  notes = [],
  statsById = {},
  loading = false,
  onOpenNote,
  onStartTyping,
  onAddNote
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const searchInputRef = useRef(null);

  // Phím tắt Ctrl/Cmd + K để focus nhanh vào ô tìm kiếm
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => {
      if (n.category) set.add(n.category);
    });
    return Array.from(set);
  }, [notes]);

  const allTags = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => {
      (n.tags || []).forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes.filter((note) => {
      if (selectedCategory !== 'ALL' && note.category !== selectedCategory) {
        return false;
      }
      if (selectedTag !== 'ALL' && !(note.tags || []).includes(selectedTag)) {
        return false;
      }
      if (q) {
        const matchTitle = String(note.title || '').toLowerCase().includes(q);
        const matchCat = String(note.category || '').toLowerCase().includes(q);
        const matchTag = (note.tags || []).some((t) => String(t).toLowerCase().includes(q));
        return matchTitle || matchCat || matchTag;
      }
      return true;
    });
  }, [notes, searchQuery, selectedCategory, selectedTag]);

  return (
    <main class="page-container">
      <div class="library-hero">
        <div>
          <h1 class="library-title">Kho Kiến Thức Luyện Gõ</h1>
          <p class="library-subtitle">
            Đọc hiểu cấu trúc, nghe phát âm và ghi nhớ sâu kiến thức qua phản xạ gõ từng đoạn văn.
          </p>
        </div>
        <button type="button" class="btn btn-primary" onClick={onAddNote}>
          + Thêm bài mới
        </button>
      </div>

      <div class="search-toolbar">
        <div class="search-input-wrap">
          <input
            ref={searchInputRef}
            type="search"
            class="search-input"
            placeholder="Tìm theo tiêu đề, chuyên mục hoặc thẻ…"
            aria-label="Tìm kiếm bài học"
            value={searchQuery}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
          <span class="search-kbd-hint">⌘K / Ctrl+K</span>
        </div>
      </div>

      <TagFilter
        categories={categories}
        tags={allTags}
        selectedCategory={selectedCategory}
        selectedTag={selectedTag}
        onSelectCategory={setSelectedCategory}
        onSelectTag={setSelectedTag}
      />

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang tải kho kiến thức…
        </div>
      ) : filteredNotes.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            padding: '40px 24px',
            textAlign: 'center'
          }}
        >
          <p style={{ margin: '0 0 12px', fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
            Không tìm thấy bài học nào khớp với bộ lọc hiện tại.
          </p>
          <button
            type="button"
            class="btn"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('ALL');
              setSelectedTag('ALL');
            }}
          >
            Xoá bộ lọc
          </button>
        </div>
      ) : (
        <div class="notes-grid">
          {filteredNotes.map((note) => {
            const st = statsById[note.id];
            const blocks = note.blocks || {};
            return (
              <article key={note.id} class="note-card">
                <div>
                  <div class="note-card-header">
                    <span class="badge">{note.category || 'General'}</span>
                    <span class="badge badge-lang">{note.lang || 'en-US'}</span>
                  </div>

                  <h2 class="note-card-title">{note.title}</h2>

                  {(note.tags || []).length > 0 && (
                    <div class="note-tags">
                      {note.tags.map((tag) => (
                        <span key={tag} class="tag-pill">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div class="note-meta-stats tabular-nums">
                    <span>⌨️ {blocks.text ?? 0} khối gõ</span>
                    {blocks.flow > 0 && <span>🔀 {blocks.flow} sơ đồ</span>}
                    {blocks.code > 0 && <span>💻 {blocks.code} mã nguồn</span>}
                  </div>

                  {st ? (
                    <div
                      class="tabular-nums"
                      style={{
                        marginTop: '10px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'var(--bg-subtle)',
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>Kỷ lục: <strong style={{ color: 'var(--accent)' }}>{st.bestWpm} WPM</strong></span>
                      <span>Chính xác: <strong>{st.lastAccuracy}%</strong></span>
                      <span>Đã luyện: {st.completedSessions} lần</span>
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: '10px',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)'
                      }}
                    >
                      Chưa luyện gõ lần nào
                    </div>
                  )}
                </div>

                <div class="note-card-actions">
                  <button
                    type="button"
                    class="btn"
                    onClick={() => onOpenNote(note.id)}
                  >
                    Đọc bài
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={() => onStartTyping(note.id, 0)}
                  >
                    Luyện gõ
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
