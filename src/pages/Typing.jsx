import { useState, useEffect, useMemo } from 'preact/hooks';
import { parseNote } from '../lib/parseNote.js';
import { TypingBlock } from '../components/TypingBlock.jsx';
import { MermaidBlock } from '../components/MermaidBlock.jsx';
import {
  TTS_RATE_OPTIONS,
  getAvailableVoices,
  subscribeVoicesChanged,
  speakText,
  stopSpeaking,
  openTtsSettings
} from '../lib/speech.js';
import { getSettings, updateSettings, saveNoteSessionStats, getSyncCode } from '../lib/storage.js';
import { pushStatsToKV } from '../lib/api.js';
import { calculateWpm, formatDuration } from '../lib/typingEngine.js';

export function Typing({
  note,
  initialBlockIndex = 0,
  onExit,
  onFinishSession
}) {
  const parsed = useMemo(() => parseNote(note?.md || ''), [note?.md]);
  const textBlocks = useMemo(
    () => parsed.blocks.filter((b) => b.type === 'text'),
    [parsed.blocks]
  );

  const [blockIdx, setBlockIdx] = useState(
    Math.min(Math.max(0, initialBlockIndex), Math.max(0, textBlocks.length - 1))
  );
  const [settings, setSettings] = useState(() => getSettings());
  const [resetCounter, setResetCounter] = useState(0);
  const [liveState, setLiveState] = useState({
    wpm: 0,
    accuracy: 100,
    formattedTime: '00:00',
    isCompleted: false
  });
  const [completedHistory, setCompletedHistory] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showFlowDiagram, setShowFlowDiagram] = useState(true);

  const currentBlock = textBlocks[blockIdx] || { text: '', flowCode: null, flows: [] };
  const lang = parsed.meta.lang || note?.lang || 'en-US';
  const [voices, setVoices] = useState(() => getAvailableVoices(lang));

  useEffect(() => {
    setVoices(getAvailableVoices(lang));
    return subscribeVoicesChanged(() => {
      setVoices(getAvailableVoices(lang));
    });
  }, [lang]);

  const activeFlows = useMemo(() => {
    if (Array.isArray(currentBlock.flows) && currentBlock.flows.length > 0) {
      return currentBlock.flows;
    }
    if (currentBlock.flowCode) {
      return [currentBlock.flowCode];
    }
    return [];
  }, [currentBlock]);

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const refocusTypingInput = () => {
    if (typeof document !== 'undefined') {
      const inputEl = document.querySelector('.typing-hidden-input');
      if (inputEl && typeof inputEl.focus === 'function') {
        inputEl.focus();
      }
    }
  };

  const handleVoiceChange = (e) => {
    const nextVoice = e.currentTarget.value;
    const next = updateSettings({ ttsVoiceURI: nextVoice });
    setSettings(next);
    refocusTypingInput();
  };

  const handleRateChange = (e) => {
    const nextRate = parseFloat(e.currentTarget.value) || 1.0;
    const next = updateSettings({ ttsRate: nextRate });
    setSettings(next);
    refocusTypingInput();
  };

  // Tự động đọc TTS nếu đang bật chế độ Chép chính tả (Dictation) khi sang khối mới
  useEffect(() => {
    if (settings.dictationMode && currentBlock.text) {
      triggerTts(currentBlock.text);
    }
  }, [blockIdx, settings.dictationMode]);

  const triggerTts = (txt = currentBlock.text) => {
    if (!txt) return;
    setIsSpeaking(true);
    const latestSettings = getSettings();
    speakText(txt, {
      lang,
      rate: Number(settings.ttsRate || latestSettings.ttsRate || 1.0),
      voiceURI: settings.ttsVoiceURI || latestSettings.ttsVoiceURI || '',
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });
  };

  const handleToggleSetting = (key) => {
    const next = updateSettings({ [key]: !settings[key] });
    setSettings(next);
    refocusTypingInput();
  };

  const handleRetryBlock = () => {
    stopSpeaking();
    setResetCounter((c) => c + 1);
  };

  const finalizeSession = (historyList) => {
    stopSpeaking();
    const list = historyList.length > 0 ? historyList : [liveState];
    let totalCorrectChars = 0;
    let totalCommitted = 0;
    let totalMistakes = 0;
    let totalElapsedMs = 0;
    const wordsMap = new Map();

    list.forEach((item) => {
      totalCorrectChars += item.correctChars || 0;
      totalCommitted += item.totalCommittedChars || 0;
      totalMistakes += item.totalMistakes || 0;
      totalElapsedMs += item.elapsedMs || 0;
      (item.mistypedWords || []).forEach((w) => {
        if (w && w.word) {
          wordsMap.set(w.word, (wordsMap.get(w.word) || 0) + (w.count || 1));
        }
      });
    });

    const overallWpm = calculateWpm(totalCorrectChars, totalElapsedMs);
    const overallAcc =
      totalCommitted > 0
        ? Math.max(0, Math.round(((totalCommitted - totalMistakes) / totalCommitted) * 100))
        : 100;

    const mistypedWords = Array.from(wordsMap.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);

    const summary = {
      noteId: note.id,
      noteTitle: parsed.meta.title || note.title,
      lang,
      wpm: overallWpm,
      accuracy: overallAcc,
      elapsedMs: totalElapsedMs,
      formattedTime: formatDuration(totalElapsedMs),
      blocksCompleted: list.length,
      totalBlocks: textBlocks.length,
      mistypedWords
    };

    saveNoteSessionStats(note.id, summary);
    if (getSyncCode()) {
      pushStatsToKV().catch(() => {});
    }
    if (onFinishSession) onFinishSession(summary);
  };

  const handleNextBlock = () => {
    const updatedHistory = [...completedHistory, liveState];
    setCompletedHistory(updatedHistory);

    if (blockIdx + 1 < textBlocks.length) {
      setBlockIdx(blockIdx + 1);
    } else {
      finalizeSession(updatedHistory);
    }
  };

  // Phím tắt toàn cục trên màn hình Gõ: Enter (khi xong khối), Tab / Ctrl+R (gõ lại), Esc (thoát), Ctrl/Cmd+J (TTS)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.querySelector('.tts-modal')) return;
      if (e.altKey && e.key.toLowerCase() === 't') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        stopSpeaking();
        onExit();
        return;
      }
      if (e.key === 'Enter' && liveState.isCompleted) {
        e.preventDefault();
        handleNextBlock();
        return;
      }
      if (e.key === 'Tab' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        handleRetryBlock();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        triggerTts(currentBlock.text);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentBlock.text,
    blockIdx,
    liveState.isCompleted,
    completedHistory,
    settings.ttsRate,
    settings.ttsVoiceURI
  ]);

  const progressPercent =
    textBlocks.length > 0
      ? Math.round(((blockIdx + (liveState.isCompleted ? 1 : 0)) / textBlocks.length) * 100)
      : 0;

  return (
    <div class="typing-viewport">
      <header class="typing-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="button" class="btn btn-sm" onClick={onExit}>
            ✕ Thoát (<kbd>Esc</kbd>)
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>
              {parsed.meta.title || note?.title}
            </div>
            <div class="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Khối {blockIdx + 1} / {textBlocks.length} · {lang}
            </div>
          </div>
        </div>

        <div class="typing-metrics-bar" aria-label="Chỉ số luyện gõ trực tiếp">
          <div class="metric-item">
            <span class="metric-label">Tốc độ</span>
            <span class="metric-value tabular-nums">{liveState.wpm} WPM</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Chính xác</span>
            <span class="metric-value tabular-nums">{liveState.accuracy}%</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Thời gian</span>
            <span class="metric-value tabular-nums">{liveState.formattedTime}</span>
          </div>
        </div>
      </header>

      <main class="typing-center-stage">
        <div class="progress-track" aria-label={`Tiến độ bài học ${progressPercent}%`}>
          <div class="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div class="typing-controls-bar">
          <button
            type="button"
            class={`btn btn-sm ${settings.forceCorrection ? 'btn-active' : ''}`}
            onClick={() => handleToggleSetting('forceCorrection')}
            title="Chế độ bắt buộc bấm Backspace sửa ký tự sai trước khi gõ tiếp"
          >
            {settings.forceCorrection ? '🛡️ Bắt buộc sửa sai (Bật)' : '⚡ Gõ tự do'}
          </button>

          <button
            type="button"
            class={`btn btn-sm ${settings.soundEnabled ? 'btn-active' : ''}`}
            onClick={() => handleToggleSetting('soundEnabled')}
          >
            {settings.soundEnabled ? '🔔 Âm phím: Bật' : '🔕 Âm phím: Tắt'}
          </button>

          <div class="tts-controls-group" role="group" aria-label="Điều khiển giọng đọc và tốc độ TTS">
            <button
              type="button"
              class={`btn btn-sm ${isSpeaking ? 'btn-active' : ''}`}
              onClick={() => {
                triggerTts(currentBlock.text);
                refocusTypingInput();
              }}
            >
              🔊 Nghe TTS (<kbd>Ctrl+J</kbd>)
            </button>

            <select
              class="tts-select tts-voice-select"
              aria-label="Chọn giọng đọc TTS"
              title="Chọn giọng đọc TTS"
              value={settings.ttsVoiceURI || ''}
              onChange={handleVoiceChange}
            >
              <option value="">🎙️ Giọng: Tự động ({lang})</option>
              {voices.map((v) => (
                <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>

            <select
              class="tts-select tts-rate-select tabular-nums"
              aria-label="Tốc độ đọc TTS"
              title="Tốc độ đọc TTS"
              value={String(Number(settings.ttsRate || 1))}
              onChange={handleRateChange}
            >
              {TTS_RATE_OPTIONS.map((r) => (
                <option key={r} value={String(r)}>
                  {Number.isInteger(r) ? `${r.toFixed(1)}x` : `${r}x`}
                </option>
              ))}
            </select>

            <button
              type="button"
              class="btn btn-sm"
              onClick={openTtsSettings}
              title="Cài đặt giọng đọc (Alt+T)"
            >
              🎙️ Giọng đọc (<kbd>Alt+T</kbd>)
            </button>
          </div>

          <button
            type="button"
            class={`btn btn-sm ${settings.dictationMode ? 'btn-active' : ''}`}
            onClick={() => handleToggleSetting('dictationMode')}
          >
            {settings.dictationMode ? '🙈 Chép chính tả (Đang ẩn chữ)' : '👁️ Chép chính tả'}
          </button>

          <button
            type="button"
            class={`btn btn-sm ${settings.ignoreCase ? 'btn-active' : ''}`}
            onClick={() => handleToggleSetting('ignoreCase')}
          >
            Aa Hoa/thường: {settings.ignoreCase ? 'Bỏ qua' : 'Chuẩn'}
          </button>

          <button
            type="button"
            class={`btn btn-sm ${settings.ignorePunctuation ? 'btn-active' : ''}`}
            onClick={() => handleToggleSetting('ignorePunctuation')}
          >
            !? Dấu câu: {settings.ignorePunctuation ? 'Bỏ qua' : 'Chuẩn'}
          </button>

          <button
            type="button"
            class="btn btn-sm"
            onClick={handleRetryBlock}
          >
            ↻ Gõ lại khối (<kbd>Tab</kbd>)
          </button>
        </div>

        <div class={`typing-workspace ${activeFlows.length > 0 ? 'has-flow' : ''}`}>
        {activeFlows.length > 0 && (
          <section
            class="typing-flow-panel"
            aria-label="Sơ đồ luồng đi kèm đoạn văn đang gõ"
          >
            <div class="typing-flow-panel-header">
              <span class="typing-flow-panel-title">
                📊 Sơ đồ luồng minh hoạ
                {currentBlock.sectionHeading ? ` · ${currentBlock.sectionHeading}` : ''}
              </span>
              <button
                type="button"
                class="btn btn-sm btn-ghost typing-flow-toggle-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setShowFlowDiagram((prev) => !prev);
                  refocusTypingInput();
                }}
              >
                {showFlowDiagram ? 'Thu gọn sơ đồ ▲' : 'Hiện sơ đồ ▼'}
              </button>
            </div>
            {showFlowDiagram && (
              <div class="typing-flow-panel-body" onClick={refocusTypingInput}>
                {activeFlows.map((flowCode, idx) => (
                  <MermaidBlock key={`${idx}-${flowCode}`} code={flowCode} />
                ))}
              </div>
            )}
          </section>
        )}
        <div class="typing-main-col">
        <TypingBlock
          text={currentBlock.text}
          lang={lang}
          options={{
            forceCorrection: settings.forceCorrection,
            ignoreCase: settings.ignoreCase,
            ignorePunctuation: settings.ignorePunctuation
          }}
          soundEnabled={settings.soundEnabled}
          dictationMode={settings.dictationMode}
          resetSignal={resetCounter}
          onStateChange={setLiveState}
          onNextBlock={handleNextBlock}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              class="btn btn-sm btn-ghost"
              disabled={blockIdx === 0}
              onClick={() => setBlockIdx((i) => Math.max(0, i - 1))}
            >
              ← Khối trước
            </button>
            <button
              type="button"
              class="btn btn-sm btn-ghost"
              disabled={blockIdx + 1 >= textBlocks.length}
              onClick={() => setBlockIdx((i) => Math.min(textBlocks.length - 1, i + 1))}
            >
              Bỏ qua sang khối kế →
            </button>
          </div>

          <button
            type="button"
            class="btn btn-sm btn-ghost"
            onClick={() => finalizeSession([...completedHistory, liveState])}
          >
            Kết thúc & Xem tổng kết
          </button>
        </div>
        </div>
        </div>
      </main>

      <footer class="typing-footer-shortcuts">
        <span><kbd>Enter</kbd> Khối tiếp theo (khi xong)</span>
        <span><kbd>Tab</kbd> / <kbd>Ctrl+R</kbd> Luyện lại khối</span>
        <span><kbd>Ctrl+J</kbd> Nghe phát âm</span>
        <span><kbd>Esc</kbd> Thoát màn hình gõ</span>
      </footer>
    </div>
  );
}
