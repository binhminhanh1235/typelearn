import { useState, useMemo, useRef } from 'preact/hooks';
import { parseNote } from '../lib/parseNote.js';
import { createNote, updateNote } from '../lib/api.js';
import { getAdminToken, setAdminToken } from '../lib/storage.js';

const SAMPLE_MD_TEMPLATE = `---
title: Circuit Breaker trong Hệ thống Phân tán
category: Backend
tags: [resilience, microservices, fault-tolerance]
lang: vi-VN
---

## Nguyên lý hoạt động

Circuit Breaker giúp ngăn chặn lỗi dây chuyền khi một dịch vụ phụ thuộc bị quá tải hoặc ngừng phản hồi.

- Trạng thái Closed cho phép mọi yêu cầu đi qua bình thường và đếm số lỗi phát sinh.
- Trạng thái Open ngắt ngay lập tức các yêu cầu mới để dịch vụ đích có thời gian hồi phục.
- Trạng thái Half-Open cho phép một vài yêu cầu thăm dò đi qua để kiểm tra sức khoẻ hệ thống.

\`\`\`mermaid
stateDiagram-v2
  [*] --> Closed
  Closed --> Open: Tỷ lệ lỗi vượt ngưỡng
  Open --> HalfOpen: Hết thời gian chờ
  HalfOpen --> Closed: Thăm dò thành công
  HalfOpen --> Open: Thăm dò thất bại
\`\`\`

> Lưu ý: Nên kết hợp Circuit Breaker với Fallback và Timeout hợp lý để bảo vệ trải nghiệm người dùng.
`;

export function AddNote({ editNote = null, onSaved, onCancel }) {
  const [mdContent, setMdContent] = useState(editNote ? editNote.md : SAMPLE_MD_TEMPLATE);
  const [token, setToken] = useState(getAdminToken() || 'admin123');
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const parsed = useMemo(() => parseNote(mdContent), [mdContent]);

  const handleFileLoad = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = String(e.target?.result || '');
      if (content) {
        setMdContent(content);
        setErrorMsg('');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileLoad(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!mdContent.trim()) {
      setErrorMsg('Vui lòng nhập hoặc tải lên nội dung Markdown.');
      return;
    }
    if (parsed.counts.text === 0) {
      setErrorMsg('Bài học cần có ít nhất 1 đoạn văn hoặc danh sách để luyện gõ.');
      return;
    }
    if (!token.trim()) {
      setErrorMsg('Vui lòng nhập mã quản trị ADMIN_TOKEN để lưu bài.');
      return;
    }

    setSaving(true);
    try {
      setAdminToken(token.trim());
      const payload = {
        title: parsed.meta.title,
        category: parsed.meta.category,
        tags: parsed.meta.tags,
        lang: parsed.meta.lang,
        blocks: parsed.counts,
        md: mdContent
      };

      const savedNote = editNote
        ? await updateNote(editNote.id, payload, token.trim())
        : await createNote(payload, token.trim());

      if (onSaved) onSaved(savedNote);
    } catch (err) {
      setErrorMsg(err.message || 'Không thể lưu bài học. Vui lòng kiểm tra ADMIN_TOKEN.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main class="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 class="library-title" style={{ marginBottom: '4px' }}>
            {editNote ? `Chỉnh sửa: ${editNote.title}` : 'Thêm Bài Học Mới'}
          </h1>
          <p class="library-subtitle">
            Kéo thả file <code>.md</code> hoặc dán trực tiếp Markdown — hệ thống tự động tách khối luyện gõ.
          </p>
        </div>
        <button type="button" class="btn" onClick={onCancel}>
          ← Quay lại
        </button>
      </div>

      <form onSubmit={handleSave} class="editor-grid">
        <div class="editor-card">
          <div
            class={`dropzone-box ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.txt"
              style={{ display: 'none' }}
              onChange={(e) => handleFileLoad(e.currentTarget.files?.[0])}
            />
            <strong>📄 Kéo thả file .md vào đây</strong> hoặc bấm để chọn file từ máy tính
          </div>

          <div class="form-group">
            <label class="form-label" htmlFor="md-editor-textarea">
              Nội dung Markdown (kèm YAML Front Matter)
            </label>
            <textarea
              id="md-editor-textarea"
              class="md-textarea"
              value={mdContent}
              onInput={(e) => setMdContent(e.currentTarget.value)}
              placeholder="Dán nội dung Markdown vào đây…"
            />
          </div>

          <div class="form-group">
            <label class="form-label" htmlFor="addnote-admin-token">
              Mã quản trị (ADMIN_TOKEN)
            </label>
            <input
              id="addnote-admin-token"
              type="password"
              class="form-input"
              value={token}
              onInput={(e) => setToken(e.currentTarget.value)}
              placeholder="Nhập ADMIN_TOKEN (Mặc định local dev: admin123)"
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--bg-error)',
                color: 'var(--text-error)',
                marginBottom: '16px',
                fontSize: '0.9rem'
              }}
            >
              {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" class="btn" onClick={onCancel}>
              Huỷ
            </button>
            <button type="submit" class="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu bài học…' : 'Lưu bài'}
            </button>
          </div>
        </div>

        <div class="editor-card">
          <h2 style={{ margin: '0 0 12px', fontSize: '1.15rem' }}>
            Xem trước kết quả phân tích (Live Preview)
          </h2>

          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: 'var(--bg-subtle)',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
              <span class="badge">{parsed.meta.category}</span>
              <span class="badge badge-lang">{parsed.meta.lang}</span>
            </div>
            <h3 style={{ margin: '6px 0', fontSize: '1.15rem' }}>{parsed.meta.title}</h3>
            {(parsed.meta.tags || []).length > 0 && (
              <div class="note-tags" style={{ marginTop: '6px' }}>
                {parsed.meta.tags.map((t) => (
                  <span key={t} class="tag-pill">#{t}</span>
                ))}
              </div>
            )}
          </div>

          <div class="counts-grid">
            <div class="count-box">
              <div class="count-num">{parsed.counts.text}</div>
              <div class="count-label">Khối luyện gõ</div>
            </div>
            <div class="count-box">
              <div class="count-num">{parsed.counts.flow}</div>
              <div class="count-label">Sơ đồ Flow</div>
            </div>
            <div class="count-box">
              <div class="count-num">{parsed.counts.code}</div>
              <div class="count-label">Khối Code</div>
            </div>
            <div class="count-box">
              <div class="count-num">{parsed.counts.note}</div>
              <div class="count-label">Ghi chú phụ</div>
            </div>
          </div>

          <h3 style={{ fontSize: '0.92rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Danh sách các khối gõ sẽ tạo ({parsed.counts.text} khối):
          </h3>
          <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {parsed.blocks
              .filter((b) => b.type === 'text')
              .map((b, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.86rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <strong style={{ color: 'var(--accent)', marginRight: '6px' }}>#{idx + 1}</strong>
                  {b.text}
                </div>
              ))}
          </div>
        </div>
      </form>
    </main>
  );
}
