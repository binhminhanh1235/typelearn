import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TTS_RATE_OPTIONS,
  getAvailableVoices,
  selectBestVoice,
  speakText,
  subscribeVoicesChanged
} from '../speech.js';
import { getSettings, updateSettings } from '../storage.js';

describe('speech.js & TTS settings (Voice & Rate)', () => {
  const mockVoices = [
    { name: 'Samantha', lang: 'en-US', voiceURI: 'com.apple.voice.Samantha' },
    { name: 'Daniel', lang: 'en-GB', voiceURI: 'com.apple.voice.Daniel' },
    { name: 'Linh', lang: 'vi-VN', voiceURI: 'com.apple.voice.Linh' },
    { name: 'Thanh', lang: 'vi-VN', voiceURI: 'com.apple.voice.Thanh' }
  ];

  let originalSpeechSynthesis;
  let originalUtterance;
  let spokenUtterances = [];
  let voicesChangedListeners = [];

  beforeEach(() => {
    spokenUtterances = [];
    voicesChangedListeners = [];
    originalSpeechSynthesis = globalThis.window?.speechSynthesis;
    originalUtterance = globalThis.window?.SpeechSynthesisUtterance;

    if (typeof globalThis.window === 'undefined') {
      globalThis.window = {};
    }

    globalThis.window.SpeechSynthesisUtterance = class MockUtterance {
      constructor(text) {
        this.text = text;
        this.lang = '';
        this.rate = 1.0;
        this.voice = null;
      }
    };

    globalThis.window.speechSynthesis = {
      getVoices: () => mockVoices,
      cancel: vi.fn(),
      speak: vi.fn((u) => {
        spokenUtterances.push(u);
      }),
      addEventListener: vi.fn((evt, cb) => {
        if (evt === 'voiceschanged') voicesChangedListeners.push(cb);
      }),
      removeEventListener: vi.fn((evt, cb) => {
        if (evt === 'voiceschanged') {
          voicesChangedListeners = voicesChangedListeners.filter((fn) => fn !== cb);
        }
      })
    };
  });

  afterEach(() => {
    if (globalThis.window) {
      globalThis.window.speechSynthesis = originalSpeechSynthesis;
      globalThis.window.SpeechSynthesisUtterance = originalUtterance;
    }
  });

  it('cung cấp đầy đủ các mức tốc độ chuẩn TTS_RATE_OPTIONS từ 0.5x đến 2.0x', () => {
    expect(TTS_RATE_OPTIONS).toEqual([0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]);
  });

  it('getAvailableVoices ưu tiên sắp xếp giọng đọc khớp ngôn ngữ bài học lên đầu', () => {
    const viSorted = getAvailableVoices('vi-VN');
    expect(viSorted.length).toBe(4);
    expect(viSorted[0].lang).toBe('vi-VN');
    expect(viSorted[1].lang).toBe('vi-VN');

    const enSorted = getAvailableVoices('en-US');
    expect(enSorted[0].voiceURI).toBe('com.apple.voice.Samantha');
    expect(enSorted[1].voiceURI).toBe('com.apple.voice.Daniel');
  });

  it('selectBestVoice chọn đúng voiceURI được chỉ định hoặc fallback về ngôn ngữ bài học', () => {
    // Chọn cụ thể giọng Thanh (vi-VN)
    const explicitVoice = selectBestVoice('vi-VN', 'com.apple.voice.Thanh');
    expect(explicitVoice.name).toBe('Thanh');

    // Khi voiceURI không tồn tại hoặc rỗng -> fallback theo lang
    const fallbackVi = selectBestVoice('vi-VN', 'non-existent-uri');
    expect(fallbackVi.lang).toBe('vi-VN');

    const autoEn = selectBestVoice('en-US', '');
    expect(autoEn.voiceURI).toBe('com.apple.voice.Samantha');
  });

  it('speakText áp dụng đúng voiceURI và tốc độ đọc rate (giới hạn an toàn 0.5 - 2.0)', () => {
    const u1 = speakText('Xin chào Việt Nam', {
      lang: 'vi-VN',
      rate: 1.5,
      voiceURI: 'com.apple.voice.Thanh'
    });

    expect(u1).not.toBeNull();
    expect(u1.rate).toBe(1.5);
    expect(u1.voice.name).toBe('Thanh');
    expect(spokenUtterances.length).toBe(1);

    // Kiểm tra giới hạn rate quá cao hoặc quá thấp
    const u2 = speakText('Fast test', { lang: 'en-US', rate: 5.0 });
    expect(u2.rate).toBe(2.0);

    const u3 = speakText('Slow test', { lang: 'en-US', rate: 0.2 });
    expect(u3.rate).toBe(0.5);
  });

  it('subscribeVoicesChanged lắng nghe và huỷ đăng ký sự kiện voiceschanged chuẩn xác', () => {
    const spy = vi.fn();
    const unsubscribe = subscribeVoicesChanged(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    // Kích hoạt sự kiện voiceschanged giả lập
    voicesChangedListeners.forEach((cb) => cb());
    expect(spy).toHaveBeenCalledTimes(2);

    unsubscribe();
    expect(voicesChangedListeners.length).toBe(0);
  });

  it('storage.js lưu trữ và đọc cài đặt ttsRate và ttsVoiceURI', () => {
    const defaults = getSettings();
    expect(defaults.ttsRate).toBe(1.0);
    expect(defaults.ttsVoiceURI).toBe('');

    const updated = updateSettings({
      ttsRate: 1.25,
      ttsVoiceURI: 'com.apple.voice.Linh'
    });
    expect(updated.ttsRate).toBe(1.25);
    expect(updated.ttsVoiceURI).toBe('com.apple.voice.Linh');

    const reloaded = getSettings();
    expect(reloaded.ttsRate).toBe(1.25);
    expect(reloaded.ttsVoiceURI).toBe('com.apple.voice.Linh');

    // Khôi phục mặc định
    updateSettings({ ttsRate: 1.0, ttsVoiceURI: '' });
  });
});
