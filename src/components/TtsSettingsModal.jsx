import { useState, useEffect, useRef } from 'preact/hooks';
import {
  TTS_SETTINGS_EVENT,
  TTS_RATE_OPTIONS,
  getAvailableVoices,
  subscribeVoicesChanged,
  isTtsSupported,
  speakText
} from '../lib/speech.js';
import { getSettings, updateSettings } from '../lib/storage.js';

const SAMPLES = {
  vi: { lang: 'vi-VN', text: 'Xin chào, đây là giọng đọc tiếng Việt.' },
  en: { lang: 'en-US', text: 'Hello, this is the English voice.' }
};

function voicesFor(all, prefix) {
  return all.filter((v) => String(v.lang || '').toLowerCase().startsWith(prefix));
}

export function TtsSettingsModal() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(() => getSettings());
  const [voices, setVoices] = useState([]);
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    const show = () => {
      returnFocusRef.current = document.activeElement;
      setSettings(getSettings());
      setOpen(true);
    };
    const onKey = (e) => {
      if (e.altKey && e.code === 'KeyT') {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener(TTS_SETTINGS_EVENT, show);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(TTS_SETTINGS_EVENT, show);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    setVoices(getAvailableVoices());
    return subscribeVoicesChanged(() => setVoices(getAvailableVoices()));
  }, [open]);

  useEffect(() => {
    if (open && panelRef.current) {
      const first = panelRef.current.querySelector('select, input, button');
      if (first) first.focus();
    }
  }, [open]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    const el = returnFocusRef.current;
    if (el && typeof el.focus === 'function') setTimeout(() => el.focus(), 0);
  };

  const change = (partial) => setSettings(updateSettings(partial));

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Tab' && panelRef.current) {
      const items = [...panelRef.current.querySelectorAll('select, input, button')].filter((n) => !n.disabled);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const test = (key) => speakText(SAMPLES[key].text, { lang: SAMPLES[key].lang });

  const voiceField = (key, label, prefix, settingKey) => {
    const list = voicesFor(voices, prefix);
    return (
      <div class="form-group">
        <label class="form-label" htmlFor={`tts-voice-${key}`}>{label}</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            id={`tts-voice-${key}`}
            class="tts-select"
            style={{ flex: 1, minWidth: 0 }}
            value={settings[settingKey] || ''}
            onChange={(e) => change({ [settingKey]: e.currentTarget.value })}
          >
            <option value="">Tự động (khớp ngôn ngữ)</option>
            {list.map((v) => (
              <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
          <button type="button" class="btn btn-sm" onClick={() => test(key)}>
            Thử giọng
          </button>
        </div>
      </div>
    );
  };

  const slider = (id, label, settingKey, min, max, step, fmt) => (
    <div class="form-group">
      <label class="form-label" htmlFor={id}>
        {label}: <span class="tabular-nums">{fmt(Number(settings[settingKey]))}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(settings[settingKey])}
        style={{ width: '100%' }}
        onInput={(e) => change({ [settingKey]: parseFloat(e.currentTarget.value) })}
      />
    </div>
  );

  return (
    <div
      class="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tts-modal-title"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div class="modal-panel tts-modal" ref={panelRef}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 id="tts-modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>Giọng đọc (TTS)</h2>
          <button type="button" class="btn btn-sm btn-ghost" onClick={close}>Đóng (Esc)</button>
        </div>

        {!isTtsSupported() && (
          <p role="alert" style={{ color: 'var(--text-error)' }}>Trình duyệt không hỗ trợ đọc văn bản.</p>
        )}

        <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Ngôn ngữ được nhận diện theo từng đoạn: có dấu tiếng Việt → vi-VN, còn lại → en-US.
        </p>

        {voiceField('vi', 'Giọng tiếng Việt (vi-VN)', 'vi', 'ttsVoiceVi')}
        {voiceField('en', 'Giọng tiếng Anh (en)', 'en', 'ttsVoiceEn')}

        <div class="form-group">
          <label class="form-label" htmlFor="tts-rate">Tốc độ</label>
          <select
            id="tts-rate"
            class="tts-select tabular-nums"
            value={String(Number(settings.ttsRate || 1))}
            onChange={(e) => change({ ttsRate: parseFloat(e.currentTarget.value) || 1 })}
          >
            {TTS_RATE_OPTIONS.map((r) => (
              <option key={r} value={String(r)}>{r.toFixed(2).replace(/0$/, '')}x</option>
            ))}
          </select>
        </div>

        {slider('tts-pitch', 'Cao độ', 'ttsPitch', 0, 2, 0.1, (n) => n.toFixed(1))}
        {slider('tts-volume', 'Âm lượng', 'ttsVolume', 0, 1, 0.05, (n) => `${Math.round(n * 100)}%`)}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="button" class="btn btn-primary" onClick={close}>Xong</button>
        </div>
      </div>
    </div>
  );
}
