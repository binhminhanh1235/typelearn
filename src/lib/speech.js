import { normalizeTextForTyping } from './parseNote.js';
import { getSettings } from './storage.js';

/**
 * Các mức tốc độ đọc TTS hỗ trợ chuẩn
 */
export const TTS_RATE_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

const VI_CHARS_RE =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/**
 * Nhận diện ngôn ngữ đọc theo từng đoạn: có ký tự tiếng Việt → vi-VN, còn lại → en-US.
 * Không có chữ cái nào thì dùng ngôn ngữ dự phòng (lang của bài).
 */
export function detectTextLang(text, fallback = 'en-US') {
  const str = String(text || '');
  if (VI_CHARS_RE.test(str)) return 'vi-VN';
  if (/[a-z]/i.test(str)) return 'en-US';
  return fallback || 'en-US';
}

/**
 * Hồ sơ TTS người dùng đã lưu (localStorage): giọng theo ngôn ngữ, tốc độ, cao độ, âm lượng.
 */
export function getTtsProfile() {
  const s = getSettings();
  const num = (v, d, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  return {
    voiceVi: s.ttsVoiceVi || '',
    voiceEn: s.ttsVoiceEn || '',
    rate: num(s.ttsRate, 1, 0.5, 2),
    pitch: num(s.ttsPitch, 1, 0, 2),
    volume: num(s.ttsVolume, 1, 0, 1)
  };
}

/**
 * Kiểm tra trình duyệt có hỗ trợ TTS (speechSynthesis) không
 */
export function isTtsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * Kiểm tra trình duyệt có hỗ trợ nhận dạng giọng nói (SpeechRecognition) không
 */
export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Lấy danh sách giọng đọc khả dụng từ trình duyệt, ưu tiên sắp xếp theo ngôn ngữ bài học
 */
export function getAvailableVoices(preferredLang = '') {
  if (!isTtsSupported()) return [];
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return [];

  const normalizedLang = String(preferredLang || '').trim().toLowerCase();
  const prefix = normalizedLang ? normalizedLang.split('-')[0] : '';

  const getRank = (voice) => {
    if (!normalizedLang) return 1;
    const vLang = String(voice?.lang || '').toLowerCase();
    if (vLang === normalizedLang) return 0;
    if (prefix && vLang.startsWith(prefix)) return 1;
    return 2;
  };

  return [...voices].sort((a, b) => {
    const rankDiff = getRank(a) - getRank(b);
    if (rankDiff !== 0) return rankDiff;
    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
}

/**
 * Đăng ký lắng nghe sự kiện voiceschanged khi trình duyệt tải xong danh sách giọng đọc
 */
export function subscribeVoicesChanged(callback) {
  if (!isTtsSupported() || typeof callback !== 'function') {
    return () => {};
  }

  const synth = window.speechSynthesis;
  const notify = () => {
    try {
      callback(synth.getVoices() || []);
    } catch (_) {}
  };

  notify();

  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', notify);
    return () => {
      try {
        synth.removeEventListener('voiceschanged', notify);
      } catch (_) {}
    };
  }

  const prevHandler = synth.onvoiceschanged;
  synth.onvoiceschanged = notify;
  return () => {
    if (synth.onvoiceschanged === notify) {
      synth.onvoiceschanged = prevHandler || null;
    }
  };
}

/**
 * Chọn giọng đọc phù hợp nhất cho ngôn ngữ bài viết (en-US hoặc vi-VN) hoặc theo voiceURI người dùng chỉ định
 */
export function selectBestVoice(lang = 'en-US', preferredVoiceURI = '') {
  if (!isTtsSupported()) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;

  const requested = String(preferredVoiceURI || '').trim();
  if (requested && requested !== 'auto') {
    const byUriOrName = voices.find(
      (v) => v.voiceURI === requested || v.name === requested
    );
    if (byUriOrName) return byUriOrName;
  }

  const normalizedLang = String(lang || 'en-US').toLowerCase();
  const prefix = normalizedLang.split('-')[0];

  // 1. Khớp chính xác mã ngôn ngữ (vd vi-vn, en-us)
  const exact = voices.find((v) => String(v.lang).toLowerCase() === normalizedLang);
  if (exact) return exact;

  // 2. Khớp theo tiền tố (vd vi, en)
  const prefixMatch = voices.find((v) => String(v.lang).toLowerCase().startsWith(prefix));
  if (prefixMatch) return prefixMatch;

  return null;
}

/**
 * Đọc to đoạn văn bản bằng Web Speech API (TTS).
 * Tự nhận diện ngôn ngữ theo văn bản (options.lang là ngôn ngữ dự phòng) và áp dụng hồ sơ TTS đã lưu.
 * Tuỳ chọn voiceURI/rate/pitch/volume truyền vào sẽ ghi đè hồ sơ.
 */
export function speakText(text, options = {}) {
  if (!isTtsSupported() || !text) {
    if (options.onEnd) options.onEnd();
    return null;
  }

  const { lang: fallbackLang = 'en-US', voiceURI = '', voiceName = '', onStart, onEnd, onError } = options;
  const profile = getTtsProfile();
  const lang = detectTextLang(text, fallbackLang);
  const savedVoice = lang.toLowerCase().startsWith('vi') ? profile.voiceVi : profile.voiceEn;

  const clamp = (v, d, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.min(hi, Math.max(lo, n)) : d;
  };

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = clamp(options.rate ?? profile.rate, 1.0, 0.5, 2.0);
    utterance.pitch = Number.isFinite(Number(options.pitch ?? profile.pitch))
      ? Math.min(2, Math.max(0, Number(options.pitch ?? profile.pitch)))
      : 1;
    utterance.volume = Number.isFinite(Number(options.volume ?? profile.volume))
      ? Math.min(1, Math.max(0, Number(options.volume ?? profile.volume)))
      : 1;

    const voice = selectBestVoice(lang, voiceURI || voiceName || savedVoice);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || lang;
    } else {
      utterance.lang = lang;
    }

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;
    if (onError) utterance.onerror = onError;

    window.speechSynthesis.speak(utterance);
    return utterance;
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}

/**
 * Dừng phát âm TTS hiện tại
 */
export function stopSpeaking() {
  if (!isTtsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch (_) {}
}

/**
 * Bắt đầu phiên nhận diện giọng nói (Chế độ Nói)
 */
export function createSpeechRecognizer({ lang = 'en-US', onResult, onEnd, onError } = {}) {
  if (!isSpeechRecognitionSupported()) return null;
  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

  try {
    const recognition = new SpeechRecognitionClass();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let transcript = '';
      let isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + ' ';
        if (event.results[i].isFinal) {
          isFinal = true;
        }
      }
      if (onResult) {
        onResult(transcript.trim(), isFinal);
      }
    };

    recognition.onend = () => {
      if (onEnd) onEnd();
    };

    recognition.onerror = (err) => {
      if (onError) onError(err);
    };

    recognition.start();
    return recognition;
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}

/**
 * Chấm độ khớp giữa văn bản mục tiêu và câu người học đã đọc (Chế độ Nói)
 */
export function evaluateSpokenMatch(targetText, spokenText) {
  const cleanTarget = normalizeTextForTyping(targetText, {
    ignoreCase: true,
    ignorePunctuation: true
  });
  const cleanSpoken = normalizeTextForTyping(spokenText, {
    ignoreCase: true,
    ignorePunctuation: true
  });

  if (!cleanTarget) return { score: 100, wordResults: [] };
  const targetWords = cleanTarget.split(' ').filter(Boolean);
  const spokenWords = cleanSpoken.split(' ').filter(Boolean);
  const spokenPool = [...spokenWords];

  let matchedCount = 0;
  const wordResults = targetWords.map((word) => {
    const idx = spokenPool.indexOf(word);
    if (idx !== -1) {
      matchedCount += 1;
      spokenPool.splice(idx, 1);
      return { word, matched: true };
    }
    return { word, matched: false };
  });

  const score = targetWords.length > 0 ? Math.round((matchedCount / targetWords.length) * 100) : 0;
  return {
    score,
    matchedCount,
    totalWords: targetWords.length,
    wordResults
  };
}

export const TTS_SETTINGS_EVENT = 'typelearn:open-tts-settings';

/**
 * Mở hộp thoại cài đặt giọng đọc (được render một lần ở main.jsx)
 */
export function openTtsSettings() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(TTS_SETTINGS_EVENT));
}
