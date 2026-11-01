import { useState, useEffect, useMemo } from 'preact/hooks';
import { parseNote } from '../lib/parseNote.js';
import { CodeBlock } from '../components/CodeBlock.jsx';
import { MermaidBlock } from '../components/MermaidBlock.jsx';
import { speakText, stopSpeaking } from '../lib/speech.js';
import { getAdminToken, setAdminToken, getSettings } from '../lib/storage.js';
import { deleteNote } from '../lib/api.js';

export function Note({
  note,
  onBack,
  onStartTyping,
  onEditNote,
  onDeleted
}) {
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adminTokenInput, setAdminTokenInput] = useState(getAdminToken() || 'admin123');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const parsed = useMemo(() => parseNote(note?.md || ''), [note?.md]);
  const headings = useMemo(
    () => parsed.blocks.filter((b) => b.type === 'heading'),
    [parsed.blocks]
  );

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  // Phím tắt Ctrl/Cmd + J đọc toàn bộ các khối văn bản trong bài
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        const allText = parsed.blocks
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('. ');
        handleSpeakBlock('ALL', allText);
      } else if (e.key === 'Escape' && !confirmDelete) {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [parsed.blocks, confirmDelete]);

  const handleSpeakBlock = (idOrIdx, textContent) => {
    if (speakingIdx === idOrIdx) {
      stopSpeaking();
      setSpeakingIdx(null);
      return;
    }
    const settings = getSettings();
    setSpeakingIdx(idOrIdx);
    speakText(textContent, {
      lang: parsed.meta.lang || note?.lang || 'en-US',
      rate: settings.ttsRate || 1.0,
      onEnd: () => setSpeakingIdx(null),
      onError: () => setSpeakingIdx(null)
    });
  };

  const handleConfirmDelete = async () => {
    setDeleteError('');
    if (!adminTokenInput.trim()) {
      setDeleteError('Vui lòng nhập ADMIN_TOKEN để xoá bài.');
      return;
    }
    setDeleting(true);
    try {
      setAdminToken(adminTokenInput.trim());
      await deleteNote(note.id, adminTokenInput.trim());
      if (onDeleted) onDeleted(note.id);
    } catch (err) {
      setDeleteError(err.message || 'Không thể xoá bài học.');
    } finally {
      setDeleting(false);
    }
  };

  let typingBlockCounter = -1;

  return (
    <main class="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button type="button" class="btn" onClick={onBack}>
          ← Về Kho kiến thức
        </button>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            class={`btn ${speakingIdx === 'ALL' ? 'btn-active' : ''}`}
            onClick={() => {
              const allText = parsed.blocks
                .filter((b) => b.type === 'text')
                .map((b) => b.text)
                .join('. ');
              handleSpeakBlock('ALL', allText);
            }}
          >
            {speakingIdx === 'ALL' ? '⏹ Dừng đọc' : '🔊 Nghe toàn bài (Ctrl+J)'}
          </button>
          <button type="button" class="btn" onClick={() => onEditNote(note)}>
            ✎ Sửa bài
          </button>
          <button
            type="button"
            class="btn btn-danger"
            onClick={() => setConfirmDelete((v) => !v)}
          >
            🗑 Xoá bài
          </button>
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => onStartTyping(note.id, 0)}
          >
            ⌨️ Luyện gõ ngay ({parsed.counts.text} khối)
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div
          role="alertdialog"
          aria-labelledby="delete-confirm-title"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--text-error)',
            borderRadius: '14px',
            padding: '18px 20px',
            marginBottom: '20px'
          }}
        >
          <h3 id="delete-confirm-title" style={{ margin: '0 0 8px', color: 'var(--text-error)' }}>
            Xác nhận xoá bài học “{note.title}”?
          </h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="password"
              class="form-input"
              style={{ maxWidth: '280px' }}
              placeholder="Nhập ADMIN_TOKEN"
              value={adminTokenInput}
              onInput={(e) => setAdminTokenInput(e.currentTarget.value)}
            />
            <button
              type="button"
              class="btn btn-danger"
              disabled={deleting}
              onClick={handleConfirmDelete}
            >
              {deleting ? 'Đang xoá…' : 'Xác nhận xoá vĩnh viễn'}
            </button>
            <button type="button" class="btn" onClick={() => setConfirmDelete(false)}>
              Huỷ
            </button>
          </div>
          {deleteError && (
            <p style={{ margin: '8px 0 0', color: 'var(--text-error)', fontSize: '0.88rem' }}>
              {deleteError}
            </p>
          )}
        </div>
      )}

      <div class="note-layout">
        <aside class="toc-sidebar" aria-label="Mục lục bài học">
          <h2 class="toc-title">Mục lục</h2>
          {headings.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Không có tiêu đề phụ
            </p>
          ) : (
            <ul class="toc-list">
              {headings.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    class="toc-link"
                    style={{ paddingLeft: `${Math.max(1, h.depth - 1) * 10}px` }}
                    onClick={() => {
                      const el = document.getElementById(h.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    {h.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <article class="note-article">
          <header class="note-article-header">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
              <span class="badge">{parsed.meta.category}</span>
              <span class="badge badge-lang">{parsed.meta.lang}</span>
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: '1.85rem', lineHeight: 1.25 }}>
              {parsed.meta.title}
            </h1>
            {(parsed.meta.tags || []).length > 0 && (
              <div class="note-tags">
                {parsed.meta.tags.map((tag) => (
                  <span key={tag} class="tag-pill">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          <div>
            {parsed.blocks.map((block, idx) => {
              if (block.type === 'heading') {
                const Tag = block.depth === 1 ? 'h2' : block.depth === 2 ? 'h2' : 'h3';
                return (
                  <Tag
                    key={idx}
                    id={block.id}
                    style={{ marginTop: '28px', marginBottom: '12px', scrollMarginTop: '90px' }}
                    dangerouslySetInnerHTML={{ __html: block.html }}
                  />
                );
              }

              if (block.type === 'flow') {
                return <MermaidBlock key={idx} code={block.code} />;
              }

              if (block.type === 'code') {
                return <CodeBlock key={idx} code={block.code} lang={block.lang} />;
              }

              if (block.type === 'note') {
                return (
                  <blockquote
                    key={idx}
                    class="reading-blockquote"
                    dangerouslySetInnerHTML={{ __html: block.html }}
                  />
                );
              }

              if (block.type === 'text') {
                typingBlockCounter += 1;
                const currentTypingIndex = typingBlockCounter;
                const isSpeakingThis = speakingIdx === idx;

                return (
                  <div key={idx} class="reading-block-text">
                    <div
                      style={{ fontSize: '1.05rem', lineHeight: 1.75 }}
                      dangerouslySetInnerHTML={{ __html: block.html }}
                    />
                    <div class="reading-block-footer">
                      <span class="tabular-nums">Khối luyện gõ #{currentTypingIndex + 1}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          class={`btn btn-sm ${isSpeakingThis ? 'btn-active' : 'btn-ghost'}`}
                          onClick={() => handleSpeakBlock(idx, block.text)}
                        >
                          {isSpeakingThis ? '⏹ Dừng' : '🔊 Nghe'}
                        </button>
                        <button
                          type="button"
                          class="btn btn-sm btn-ghost"
                          onClick={() => onStartTyping(note.id, currentTypingIndex)}
                        >
                          ⌨️ Luyện từ khối này →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </article>
      </div>
    </main>
  );
}
