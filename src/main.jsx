import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import './styles/index.css';

import {
  fetchNotesIndex,
  fetchNoteById,
  pullStatsFromKV
} from './lib/api.js';
import {
  getThemeMode,
  applyThemeMode,
  getAllNoteStats,
  getSyncCode,
  getLastSessionResult
} from './lib/storage.js';

import { Library } from './pages/Library.jsx';
import { AddNote } from './pages/AddNote.jsx';
import { Note } from './pages/Note.jsx';
import { Typing } from './pages/Typing.jsx';
import { Summary } from './pages/Summary.jsx';
import { SettingsModal } from './components/SettingsModal.jsx';
import { TtsSettingsModal } from './components/TtsSettingsModal.jsx';
import { openTtsSettings } from './lib/speech.js';

function App() {
  const [view, setView] = useState('library'); // 'library' | 'add' | 'edit' | 'note' | 'typing' | 'summary'
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [activeNote, setActiveNote] = useState(null);
  const [initialTypingBlock, setInitialTypingBlock] = useState(0);
  const [summaryData, setSummaryData] = useState(() => getLastSessionResult());
  const [statsById, setStatsById] = useState(() => getAllNoteStats());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? '' : curr));
    }, 3200);
  };

  useEffect(() => {
    applyThemeMode(getThemeMode());
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoadingNotes(true);
    try {
      const list = await fetchNotesIndex();
      setNotes(list);
      if (getSyncCode()) {
        const syncRes = await pullStatsFromKV();
        if (syncRes.stats) {
          setStatsById(syncRes.stats);
        }
      }
    } finally {
      setLoadingNotes(false);
    }
  }

  const handleOpenNote = async (noteId) => {
    try {
      const detail = await fetchNoteById(noteId);
      setActiveNote(detail);
      setView('note');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showToast('Không thể tải bài học. Vui lòng kiểm tra kết nối.');
    }
  };

  const handleStartTyping = async (noteId, startBlockIdx = 0) => {
    try {
      const detail =
        activeNote && activeNote.id === noteId
          ? activeNote
          : await fetchNoteById(noteId);
      setActiveNote(detail);
      setInitialTypingBlock(startBlockIdx);
      setView('typing');
      window.scrollTo({ top: 0 });
    } catch (err) {
      showToast('Không thể mở chế độ luyện gõ cho bài học này.');
    }
  };

  const handleNoteSaved = async (savedNote) => {
    const updatedList = await fetchNotesIndex();
    setNotes([...updatedList]);
    setActiveNote(savedNote);
    setView('note');
    showToast('Đã lưu bài học vào kho');
  };

  const handleNoteDeleted = async () => {
    const updatedList = await fetchNotesIndex();
    setNotes([...updatedList]);
    setActiveNote(null);
    setView('library');
    showToast('Đã xoá bài học khỏi kho');
  };

  const handleFinishSession = (summary) => {
    setSummaryData(summary);
    setStatsById(getAllNoteStats());
    setView('summary');
    window.scrollTo({ top: 0 });
  };

  return (
    <div class="app-shell">
      {view !== 'typing' && (
        <header class="top-header">
          <button
            type="button"
            class="brand-btn"
            onClick={() => setView('library')}
            aria-label="Về trang chủ TypeLearn"
          >
            <span class="brand-badge">TL</span>
            <span>TypeLearn</span>
          </button>

          <nav class="header-actions" aria-label="Điều hướng chính">
            {view !== 'library' && (
              <button
                type="button"
                class="btn btn-sm btn-ghost"
                onClick={() => setView('library')}
              >
                Kho kiến thức
              </button>
            )}
            <button
              type="button"
              class="btn btn-sm"
              onClick={() => {
                setActiveNote(null);
                setView('add');
              }}
            >
              + Thêm bài mới
            </button>
            <button
              type="button"
              class="btn btn-sm"
              onClick={() => setSettingsOpen(true)}
              aria-label="Mở cài đặt giao diện và đồng bộ"
            >
              ⚙️ Cài đặt & Đồng bộ
            </button>
            <button
              type="button"
              class="btn btn-sm"
              onClick={openTtsSettings}
              aria-keyshortcuts="Alt+T"
              title="Cài đặt giọng đọc (Alt+T)"
            >
              🎙️ Giọng đọc
            </button>
          </nav>
        </header>
      )}

      {toastMsg && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--accent)',
            padding: '12px 18px',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-card)',
            zIndex: 90,
            fontSize: '0.9rem',
            fontWeight: 500
          }}
        >
          {toastMsg}
        </div>
      )}

      {view === 'library' && (
        <Library
          notes={notes}
          statsById={statsById}
          loading={loadingNotes}
          onOpenNote={handleOpenNote}
          onStartTyping={handleStartTyping}
          onAddNote={() => {
            setActiveNote(null);
            setView('add');
          }}
        />
      )}

      {view === 'add' && (
        <AddNote
          editNote={null}
          onSaved={handleNoteSaved}
          onCancel={() => setView('library')}
        />
      )}

      {view === 'edit' && activeNote && (
        <AddNote
          editNote={activeNote}
          onSaved={handleNoteSaved}
          onCancel={() => setView('note')}
        />
      )}

      {view === 'note' && activeNote && (
        <Note
          note={activeNote}
          onBack={() => setView('library')}
          onStartTyping={handleStartTyping}
          onEditNote={(n) => {
            setActiveNote(n);
            setView('edit');
          }}
          onDeleted={handleNoteDeleted}
        />
      )}

      {view === 'typing' && activeNote && (
        <Typing
          note={activeNote}
          initialBlockIndex={initialTypingBlock}
          onExit={() => setView('note')}
          onFinishSession={handleFinishSession}
        />
      )}

      {view === 'summary' && (
        <Summary
          summary={summaryData}
          onRetry={() => {
            if (activeNote) {
              setInitialTypingBlock(0);
              setView('typing');
            } else if (summaryData?.noteId) {
              handleStartTyping(summaryData.noteId, 0);
            }
          }}
          onReadNote={() => {
            if (activeNote) {
              setView('note');
            } else if (summaryData?.noteId) {
              handleOpenNote(summaryData.noteId);
            }
          }}
          onBackLibrary={() => setView('library')}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      <TtsSettingsModal />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onStatsSynced={(merged) => {
          setStatsById({ ...merged });
          showToast('Đã đồng bộ tiến độ với EdgeOne KV');
        }}
      />
    </div>
  );
}

render(<App />, document.getElementById('app'));
