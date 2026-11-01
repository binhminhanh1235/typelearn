import { normalizeTextForTyping } from './parseNote.js';

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
 * Chọn giọng đọc phù hợp nhất cho ngôn ngữ bài viết (en-US hoặc vi-VN)
 */
export function selectBestVoice(lang = 'en-US') {
  if (!isTtsSupported()) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;

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
 * Đọc to đoạn văn bản bằng Web Speech API (TTS)
 */
export function speakText(text, options = {}) {
  if (!isTtsSupported() || !text) {
    if (options.onEnd) options.onEnd();
    return null;
  }

  const { lang = 'en-US', rate = 1.0, onStart, onEnd, onError } = options;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = Math.min(2.0, Math.max(0.5, Number(rate) || 1.0));

    const voice = selectBestVoice(lang);
    if (voice) {
      utterance.voice = voice;
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
