import { describe, it, expect } from 'vitest';
import { createTypingSession } from '../typingEngine.js';

describe('typingEngine — IME Tiếng Việt & Force Correction', () => {
  it('xử lý luồng IME Tiếng Việt (compositionstart -> compositionupdate -> compositionend) không báo lỗi giả', () => {
    const session = createTypingSession('Kiến trúc V8', { forceCorrection: true });

    // Gõ chữ 'K'
    let state = session.handleInput('K', false, 1000);
    expect(state.hasError).toBe(false);
    expect(state.correctChars).toBe(1);

    // Gõ chữ 'i'
    state = session.handleInput('Ki', false, 1100);
    expect(state.hasError).toBe(false);

    // Bắt đầu tổ hợp phím IME cho chữ 'ế' (ví dụ gõ e -> ê -> ế)
    session.handleCompositionStart(1200);
    state = session.handleCompositionUpdate('Kie', 1250);
    // Trong khi isComposing === true, 'e' khác 'ế' nhưng tuyệt đối KHÔNG chấm là incorrect!
    expect(state.isComposing).toBe(true);
    expect(state.hasError).toBe(false);
    expect(state.chars[2].status).toBe('composing');

    state = session.handleCompositionUpdate('Kiê', 1300);
    expect(state.isComposing).toBe(true);
    expect(state.hasError).toBe(false);

    // Kết thúc composition khi hoàn thành âm tiết 'Kiến'
    state = session.handleCompositionEnd('Kiến', 1400);
    expect(state.isComposing).toBe(false);
    expect(state.hasError).toBe(false);
    expect(state.correctChars).toBe(4);
    expect(state.typedText).toBe('Kiến');
  });

  it('chế độ Force Correction bắt buộc bấm Backspace xoá ký tự sai trước khi gõ tiếp', () => {
    const session = createTypingSession('Saga pattern', { forceCorrection: true });

    session.handleInput('S', false, 1000);
    session.handleInput('Sa', false, 1100);

    // Gõ sai ở vị trí thứ 2 ('x' thay vì 'g')
    let state = session.handleInput('Sax', false, 1200);
    expect(state.hasError).toBe(true);
    expect(state.firstErrorIndex).toBe(2);
    expect(state.chars[2].status).toBe('incorrect');

    // Cố tình gõ tiếp 'a' mà không bấm Backspace -> bị chặn bởi Force Correction
    state = session.handleInput('Saxa', false, 1300);
    expect(state.blockedByForceCorrection).toBe(true);
    expect(state.typedText).toBe('Sax');

    // Bấm Backspace xoá 'x'
    state = session.handleInput('Sa', false, 1400);
    expect(state.hasError).toBe(false);

    // Gõ đúng 'Sag'
    state = session.handleInput('Sag', false, 1500);
    expect(state.hasError).toBe(false);
    expect(state.correctChars).toBe(3);
  });

  it('chế độ Gõ tự do (forceCorrection: false) cho phép gõ tiếp qua ký tự sai và ghi nhận từ gõ sai', () => {
    const session = createTypingSession('Saga pattern', { forceCorrection: false });

    // Gõ sai 'Sax' rồi gõ tiếp 'Saxa pattern'
    let state = session.handleInput('Saxa pattern', false, 2000);
    expect(state.isCompleted).toBe(true);
    expect(state.errorChars).toBe(1);
    expect(state.chars[2].status).toBe('incorrect');
    expect(state.mistypedWords.some((w) => w.word === 'Saga')).toBe(true);
  });

  it('đánh dấu isSpaceError khi gõ sai ở vị trí dấu cách để hiển thị ký hiệu ␣', () => {
    const session = createTypingSession('A B', { forceCorrection: true });
    session.handleInput('A', false, 1000);
    const state = session.handleInput('Ax', false, 1100);
    expect(state.chars[1].status).toBe('incorrect');
    expect(state.chars[1].isSpaceError).toBe(true);
  });
});
