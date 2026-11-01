import { useEffect, useRef, useState } from 'preact/hooks';
import { createTypingSession } from '../lib/typingEngine.js';
import { playKeyClick, playErrorSound, playBlockCompleteSound } from '../lib/sound.js';
import {
  isSpeechRecognitionSupported,
  createSpeechRecognizer,
  evaluateSpokenMatch
} from '../lib/speech.js';

export function TypingBlock({
  text = '',
  lang = 'en-US',
  options = {},
  soundEnabled = true,
  dictationMode = false,
  onBlockComplete,
  onNextBlock,
  onStateChange,
  resetSignal = 0
}) {
  const inputRef = useRef(null);
  const cardRef = useRef(null);
  const sessionRef = useRef(null);

  if (!sessionRef.current) {
    sessionRef.current = createTypingSession(text, options);
  }

  const [state, setState] = useState(() => sessionRef.current.getState());
  const stateRef = useRef(state);
  stateRef.current = state;
  const [isFocused, setIsFocused] = useState(true);
  const [speakingActive, setSpeakingActive] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [speechEval, setSpeechEval] = useState(null);
  const recognizerRef = useRef(null);

  // Khởi tạo lại phiên chỉ khi đổi khối văn bản (text), đổi vị trí khối (blockIndex) hoặc bấm luyện lại (resetSignal)
  useEffect(() => {
    sessionRef.current = createTypingSession(text, options);
    const initial = sessionRef.current.getState();
    setState({ ...initial });
    stateRef.current = initial;
    setSpokenText('');
    setSpeechEval(null);
    if (onStateChangeRef.current) onStateChangeRef.current(initial);
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.setAttribute('autocomplete', 'off');
      inputRef.current.setAttribute('autocorrect', 'off');
      inputRef.current.setAttribute('autocapitalize', 'off');
      inputRef.current.setAttribute('spellcheck', 'false');
      inputRef.current.focus();
    }
  }, [text, resetSignal]);

  // Lắng nghe trực tiếp sự kiện IME compositionstart / compositionupdate / compositionend và input trên DOM
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    // Đảm bảo thuộc tính chống autocorrect/spellcheck chuẩn HTML trên mọi trình duyệt (kể cả Safari iOS)
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');

    const onCompStart = () => {
      if (!sessionRef.current) return;
      const nextState = sessionRef.current.handleCompositionStart();
      stateRef.current = nextState;
      setState({ ...nextState });
    };

    const onCompUpdate = (e) => {
      if (!sessionRef.current) return;
      const val = e.currentTarget ? e.currentTarget.value : el.value;
      const nextState = sessionRef.current.handleCompositionUpdate(val);
      stateRef.current = nextState;
      setState({ ...nextState });
    };

    const onCompEnd = (e) => {
      if (!sessionRef.current) return;
      const prevState = stateRef.current;
      const val = e.currentTarget ? e.currentTarget.value : el.value;
      const nextState = sessionRef.current.handleCompositionEnd(val);
      stateRef.current = nextState;
      syncAfterEngineUpdate(prevState, nextState, el);
    };

    el.addEventListener('compositionstart', onCompStart);
    el.addEventListener('compositionupdate', onCompUpdate);
    el.addEventListener('compositionend', onCompEnd);

    return () => {
      el.removeEventListener('compositionstart', onCompStart);
      el.removeEventListener('compositionupdate', onCompUpdate);
      el.removeEventListener('compositionend', onCompEnd);
    };
  }, []);

  // Cập nhật tuỳ chọn (Force Correction, Hoa/thường, Dấu câu) ngay trong phiên
  useEffect(() => {
    if (!sessionRef.current) return;
    const updated = sessionRef.current.updateOptions(options);
    stateRef.current = updated;
    setState(updated);
    if (inputRef.current && !updated.isComposing) {
      inputRef.current.value = updated.inputValue;
      inputRef.current.setAttribute('autocomplete', 'off');
      inputRef.current.setAttribute('autocorrect', 'off');
      inputRef.current.setAttribute('autocapitalize', 'off');
      inputRef.current.setAttribute('spellcheck', 'false');
    }
    if (onStateChange) onStateChange(updated);
  }, [options.forceCorrection, options.ignoreCase, options.ignorePunctuation]);

  // Bộ đếm thời gian cập nhật mỗi 250ms khi đang gõ
  useEffect(() => {
    if (!state.typedText.length || state.isCompleted) return;
    const timer = setInterval(() => {
      if (sessionRef.current) {
        const current = sessionRef.current.getState();
        setState(current);
        if (onStateChange) onStateChange(current);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [state.typedText.length, state.isCompleted]);

  // Giữ vùng gõ nổi trên bàn phím ảo Mobile qua window.visualViewport
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const handleViewportResize = () => {
      if (document.activeElement === inputRef.current && cardRef.current) {
        cardRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };
    window.visualViewport.addEventListener('resize', handleViewportResize);
    return () => window.visualViewport.removeEventListener('resize', handleViewportResize);
  }, []);

  const ensureInputAttributes = (el) => {
    if (!el) return;
    if (el.getAttribute('autocorrect') !== 'off') el.setAttribute('autocorrect', 'off');
    if (el.getAttribute('spellcheck') !== 'false') el.setAttribute('spellcheck', 'false');
    if (el.getAttribute('autocomplete') !== 'off') el.setAttribute('autocomplete', 'off');
    if (el.getAttribute('autocapitalize') !== 'off') el.setAttribute('autocapitalize', 'off');
  };

  useEffect(() => {
    ensureInputAttributes(inputRef.current);
  });

  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  const onBlockCompleteRef = useRef(onBlockComplete);
  onBlockCompleteRef.current = onBlockComplete;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const syncAfterEngineUpdate = (prevState, nextState, inputEl) => {
    if (!nextState.isComposing && inputEl && inputEl.value !== nextState.inputValue) {
      inputEl.value = nextState.inputValue;
    }

    if (!nextState.isComposing) {
      if (nextState.totalMistakes > prevState.totalMistakes || nextState.blockedByForceCorrection) {
        playErrorSound(soundEnabledRef.current);
      } else if (nextState.correctChars > prevState.correctChars) {
        playKeyClick(soundEnabledRef.current);
      }
    }

    if (!prevState.isCompleted && nextState.isCompleted) {
      playBlockCompleteSound(soundEnabledRef.current);
      if (onBlockCompleteRef.current) onBlockCompleteRef.current(nextState);
    }

    setState({ ...nextState });
    if (onStateChangeRef.current) onStateChangeRef.current(nextState);
  };

  const handleInput = (e) => {
    if (!sessionRef.current) return;
    const prevState = stateRef.current;
    const val = e.currentTarget.value;
    const nextState = sessionRef.current.handleInput(val, Boolean(e.isComposing));
    stateRef.current = nextState;
    syncAfterEngineUpdate(prevState, nextState, e.currentTarget);
  };

  const onNextBlockRef = useRef(onNextBlock);
  onNextBlockRef.current = onNextBlock;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && stateRef.current.isCompleted) {
      e.preventDefault();
      e.stopPropagation();
      if (onNextBlockRef.current) onNextBlockRef.current();
    }
  };

  const toggleSpeechRecognition = () => {
    if (speakingActive && recognizerRef.current) {
      recognizerRef.current.stop();
      setSpeakingActive(false);
      return;
    }
    setSpokenText('');
    setSpeechEval(null);
    setSpeakingActive(true);
    recognizerRef.current = createSpeechRecognizer({
      lang,
      onResult: (transcript) => {
        setSpokenText(transcript);
        setSpeechEval(evaluateSpokenMatch(state.targetText, transcript));
      },
      onEnd: () => setSpeakingActive(false),
      onError: () => setSpeakingActive(false)
    });
  };

  return (
    <div ref={cardRef}>
      <div
        class={`typing-box-card ${isFocused ? 'focused' : ''} ${state.hasError ? 'error-shake' : ''}`}
        onClick={focusInput}
        role="region"
        aria-label="Khung văn bản luyện gõ"
      >
        <input
          ref={(el) => {
            inputRef.current = el;
            ensureInputAttributes(el);
          }}
          type="text"
          class="typing-hidden-input"
          aria-label="Nhập văn bản luyện gõ"
          autocomplete="off"
          autocapitalize="off"
          inputmode="text"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        />

        <div
          class={`typing-text-display ${dictationMode ? 'dictation-masked' : ''}`}
          aria-live="polite"
        >
          {state.chars.map((ch) => {
            const isCursor = ch.index === state.cursorIndex && !state.isCompleted;
            let statusClass = 'char-untyped';
            if (ch.status === 'correct') statusClass = 'char-correct';
            else if (ch.status === 'incorrect') statusClass = 'char-incorrect';
            else if (ch.status === 'composing') statusClass = 'char-composing';

            // Hiển thị ký hiệu ␣ màu đỏ nếu gõ sai tại vị trí dấu cách
            const displayChar =
              ch.status === 'incorrect' && ch.expected === ' ' ? '␣' : ch.expected;

            return (
              <span
                key={`${text}-${ch.index}`}
                class={`t-char ${statusClass} ${isCursor ? 'char-cursor' : ''}`}
              >
                {displayChar}
              </span>
            );
          })}
        </div>

        <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          {state.hasError && options.forceCorrection ? (
            <div class="force-correction-banner" role="alert">
              <span>⚠️ Bấm <kbd>Backspace</kbd> để sửa ký tự gõ sai trước khi gõ tiếp</span>
            </div>
          ) : (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {state.isComposing
                ? 'Đang gõ tổ hợp dấu IME…'
                : isFocused
                ? 'Đang nhận phím — hãy gõ theo văn bản trên'
                : 'Chạm vào khung để tiếp tục gõ'}
            </span>
          )}

          {isSpeechRecognitionSupported() && (
            <button
              type="button"
              class={`btn btn-sm ${speakingActive ? 'btn-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleSpeechRecognition();
              }}
            >
              {speakingActive ? '🎙️ Đang nghe bạn đọc… (Dừng)' : '🎙️ Luyện đọc to (Nói)'}
            </button>
          )}
        </div>

        {speechEval && (
          <div
            style={{
              marginTop: '14px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--bg-subtle)',
              fontSize: '0.88rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <strong>Kết quả nhận dạng giọng nói ({lang}):</strong>
              <span class="tabular-nums" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                Khớp {speechEval.score}% ({speechEval.matchedCount}/{speechEval.totalWords} từ)
              </span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>“{spokenText}”</p>
          </div>
        )}
      </div>

      {state.isCompleted && (
        <div class="block-complete-prompt" style={{ marginTop: '16px' }}>
          <div>
            <strong style={{ color: 'var(--accent)' }}>✓ Hoàn thành khối!</strong>{' '}
            <span class="tabular-nums" style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              {state.wpm} WPM · Chính xác {state.accuracy}% · {state.formattedTime}
            </span>
          </div>
          <button type="button" class="btn btn-primary" onClick={onNextBlock}>
            Tiếp tục (<kbd>Enter</kbd>) →
          </button>
        </div>
      )}
    </div>
  );
}
