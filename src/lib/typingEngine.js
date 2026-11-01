import { normalizeTextForTyping } from './parseNote.js';

/**
 * Tìm từ trong văn bản gốc tại vị trí ký tự `charIndex`
 */
export function getWordAtCharIndex(text, charIndex) {
  if (!text || charIndex < 0 || charIndex >= text.length) return '';
  let start = charIndex;
  let end = charIndex;

  // Nếu bấm sai ngay tại khoảng trắng, lấy từ đứng ngay trước khoảng trắng đó
  if (text[charIndex] === ' ' && charIndex > 0) {
    start = charIndex - 1;
    end = charIndex - 1;
  }

  while (start > 0 && text[start - 1] !== ' ') {
    start -= 1;
  }
  while (end < text.length && text[end] !== ' ') {
    end += 1;
  }

  return text
    .slice(start, end)
    .replace(/^[.,/#!$%^&*;:{}=\-_~()?"'[\]\\<>@+|]+|[.,/#!$%^&*;:{}=\-_~()?"'[\]\\<>@+|]+$/g, '')
    .trim();
}

/**
 * So sánh 2 ký tự có tính đến tuỳ chọn ignoreCase
 */
export function compareChars(typedChar, expectedChar, ignoreCase = false) {
  if (typedChar === undefined || expectedChar === undefined) return false;
  if (ignoreCase) {
    return typedChar.toLowerCase() === expectedChar.toLowerCase();
  }
  return typedChar === expectedChar;
}

/**
 * Tính WPM chuẩn: (số ký tự đúng / 5) / số phút
 */
export function calculateWpm(correctChars, elapsedMs) {
  if (!elapsedMs || elapsedMs <= 0 || correctChars <= 0) return 0;
  // Tránh số WPM nhảy ảo khi mới gõ dưới 0.5 giây
  const effectiveMs = Math.max(elapsedMs, 500);
  const minutes = effectiveMs / 60000;
  return Math.round(correctChars / 5 / minutes);
}

/**
 * Định dạng thời gian mm:ss
 */
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Khởi tạo Engine quản lý phiên gõ cho 1 khối văn bản (hỗ trợ đầy đủ IME Tiếng Việt & Force Correction)
 */
export function createTypingSession(rawText, initialOptions = {}) {
  let options = {
    forceCorrection: true,
    ignoreCase: false,
    ignorePunctuation: false,
    ...initialOptions
  };

  // Văn bản hiển thị và đối chiếu (gỡ dấu câu nếu bật ignorePunctuation, giữ nguyên hoa/thường để hiển thị đẹp)
  let targetText = normalizeTextForTyping(rawText, {
    ignoreCase: false,
    ignorePunctuation: options.ignorePunctuation
  });

  let typedText = '';
  let isComposing = false;
  let composingPreview = '';
  let compositionBaseLength = 0;

  let startTime = null;
  let endTime = null;
  let totalCommittedChars = 0;
  let totalMistakes = 0;
  let blockedByForceCorrection = false;
  const mistypedWordsMap = new Map();

  function getFirstErrorIndex(str = typedText) {
    const len = Math.min(str.length, targetText.length);
    for (let i = 0; i < len; i++) {
      if (!compareChars(str[i], targetText[i], options.ignoreCase)) {
        return i;
      }
    }
    if (str.length > targetText.length) {
      return targetText.length;
    }
    return -1;
  }

  function recordMistakeAt(index) {
    totalMistakes += 1;
    const word = getWordAtCharIndex(targetText, Math.min(index, targetText.length - 1));
    if (word) {
      mistypedWordsMap.set(word, (mistypedWordsMap.get(word) || 0) + 1);
    }
  }

  function startTimerIfNeeded(now = Date.now()) {
    if (startTime === null) {
      startTime = now;
    }
  }

  /**
   * Bắt đầu phiên gõ tổ hợp phím IME (Telex / VNI)
   */
  function handleCompositionStart(now = Date.now()) {
    startTimerIfNeeded(now);
    isComposing = true;
    compositionBaseLength = typedText.length;
    composingPreview = typedText;
    blockedByForceCorrection = false;
    return getState(now);
  }

  /**
   * Cập nhật chuỗi tạm thời trong lúc người dùng đang bỏ dấu IME
   * Tuyệt đối KHÔNG chấm sai hoặc chặn phím khi isComposing === true
   */
  function handleCompositionUpdate(currentInputValue, now = Date.now()) {
    startTimerIfNeeded(now);
    isComposing = true;
    composingPreview = String(currentInputValue ?? '').normalize('NFC');
    blockedByForceCorrection = false;
    return getState(now);
  }

  /**
   * Kết thúc phiên gõ dấu IME -> chốt ký tự và chấm đúng/sai
   */
  function handleCompositionEnd(finalInputValue, now = Date.now()) {
    isComposing = false;
    const normalizedInput = String(finalInputValue ?? composingPreview ?? '').normalize('NFC');
    composingPreview = '';
    return applyCommittedInput(normalizedInput, now);
  }

  /**
   * Xử lý sự kiện input thông thường
   */
  function handleInput(nextInputValue, eventIsComposing = false, now = Date.now()) {
    if (eventIsComposing || isComposing) {
      return handleCompositionUpdate(nextInputValue, now);
    }
    const normalizedInput = String(nextInputValue ?? '').normalize('NFC');
    return applyCommittedInput(normalizedInput, now);
  }

  /**
   * Áp dụng chuỗi ký tự đã chốt (sau khi không còn ở trạng thái IME composition)
   */
  function applyCommittedInput(nextValue, now = Date.now()) {
    if (nextValue.length > 0) {
      startTimerIfNeeded(now);
    }

    blockedByForceCorrection = false;
    const prevValue = typedText;

    // Trường hợp xoá ký tự (Backspace)
    if (nextValue.length < prevValue.length) {
      typedText = nextValue;
      return getState(now);
    }

    // Không thay đổi
    if (nextValue === prevValue) {
      return getState(now);
    }

    // Kiểm tra chế độ Force Correction (bắt buộc sửa ký tự sai trước khi gõ tiếp)
    if (options.forceCorrection) {
      const existingErrorIdx = getFirstErrorIndex(prevValue);
      if (existingErrorIdx !== -1 && nextValue.length > existingErrorIdx + 1) {
        // Nếu người dùng sửa chính ký tự tại existingErrorIdx (ví dụ nhờ IME thay thế âm tiết)
        const fixedErrorNow = compareChars(
          nextValue[existingErrorIdx],
          targetText[existingErrorIdx],
          options.ignoreCase
        );

        if (!fixedErrorNow) {
          // Chặn không cho gõ vượt qua ký tự đang sai
          blockedByForceCorrection = true;
          typedText = prevValue.slice(0, existingErrorIdx + 1);
          return getState(now);
        }
      }
    }

    // Giới hạn không vượt quá độ dài targetText
    const clampedNext = nextValue.slice(0, targetText.length);

    // Tìm vị trí bắt đầu khác biệt giữa prevValue và clampedNext để chấm các ký tự mới
    let diffStart = 0;
    while (
      diffStart < prevValue.length &&
      diffStart < clampedNext.length &&
      prevValue[diffStart] === clampedNext[diffStart]
    ) {
      diffStart += 1;
    }

    let finalTyped = clampedNext.slice(0, diffStart);
    let stoppedByError = false;

    for (let i = diffStart; i < clampedNext.length; i++) {
      const ch = clampedNext[i];
      const expected = targetText[i];
      const isCorrect = compareChars(ch, expected, options.ignoreCase);
      totalCommittedChars += 1;

      if (!isCorrect) {
        recordMistakeAt(i);
        finalTyped += ch;
        if (options.forceCorrection) {
          // Cho phép hiển thị đúng 1 ký tự sai vừa gõ và dừng nhận thêm ký tự phía sau
          if (i < clampedNext.length - 1) {
            blockedByForceCorrection = true;
          }
          stoppedByError = true;
          break;
        }
      } else {
        finalTyped += ch;
      }
    }

    typedText = finalTyped;

    // Kiểm tra hoàn thành khối
    const firstErr = getFirstErrorIndex(typedText);
    const completed = options.forceCorrection
      ? typedText.length === targetText.length && firstErr === -1
      : typedText.length === targetText.length;

    if (completed && !endTime) {
      endTime = now;
    }

    return getState(now, stoppedByError);
  }

  /**
   * Trả về trạng thái chi tiết từng ký tự và chỉ số thống kê để UI render
   */
  function getState(now = Date.now()) {
    const activeBuffer = isComposing ? composingPreview : typedText;
    const firstErrorIndex = getFirstErrorIndex(typedText);

    let correctCharsCount = 0;
    let errorCharsCount = 0;

    const chars = [];
    for (let i = 0; i < targetText.length; i++) {
      const expectedChar = targetText[i];

      if (isComposing && i >= compositionBaseLength && i < activeBuffer.length) {
        chars.push({
          index: i,
          expected: expectedChar,
          typed: activeBuffer[i],
          status: 'composing',
          isSpaceError: false
        });
        continue;
      }

      if (i < typedText.length) {
        const typedChar = typedText[i];
        const ok = compareChars(typedChar, expectedChar, options.ignoreCase);
        if (ok) {
          correctCharsCount += 1;
          chars.push({
            index: i,
            expected: expectedChar,
            typed: typedChar,
            status: 'correct',
            isSpaceError: false
          });
        } else {
          errorCharsCount += 1;
          chars.push({
            index: i,
            expected: expectedChar,
            typed: typedChar,
            status: 'incorrect',
            isSpaceError: expectedChar === ' ' || typedChar === ' '
          });
        }
      } else {
        chars.push({
          index: i,
          expected: expectedChar,
          typed: null,
          status: 'untyped',
          isSpaceError: false
        });
      }
    }

    const cursorIndex = Math.min(activeBuffer.length, targetText.length);
    const isCompleted =
      !isComposing &&
      (options.forceCorrection
        ? typedText.length === targetText.length && firstErrorIndex === -1
        : typedText.length === targetText.length);

    const elapsedMs = startTime ? (endTime || now) - startTime : 0;
    const wpm = calculateWpm(correctCharsCount, elapsedMs);
    const accuracy =
      totalCommittedChars > 0
        ? Math.max(0, Math.round(((totalCommittedChars - totalMistakes) / totalCommittedChars) * 100))
        : 100;

    return {
      targetText,
      typedText,
      inputValue: activeBuffer,
      isComposing,
      cursorIndex,
      firstErrorIndex,
      hasError: firstErrorIndex !== -1,
      blockedByForceCorrection,
      isCompleted,
      correctChars: correctCharsCount,
      errorChars: errorCharsCount,
      totalCommittedChars,
      totalMistakes,
      wpm,
      accuracy,
      elapsedMs,
      formattedTime: formatDuration(elapsedMs),
      mistypedWords: Array.from(mistypedWordsMap.entries()).map(([word, count]) => ({ word, count })),
      chars,
      options: { ...options }
    };
  }

  function updateOptions(newOptions = {}, now = Date.now()) {
    const prevIgnorePunct = options.ignorePunctuation;
    options = { ...options, ...newOptions };
    if (newOptions.ignorePunctuation !== undefined && newOptions.ignorePunctuation !== prevIgnorePunct) {
      targetText = normalizeTextForTyping(rawText, {
        ignoreCase: false,
        ignorePunctuation: options.ignorePunctuation
      });
      reset();
    }
    return getState(now);
  }

  function reset() {
    typedText = '';
    isComposing = false;
    composingPreview = '';
    compositionBaseLength = 0;
    startTime = null;
    endTime = null;
    totalCommittedChars = 0;
    totalMistakes = 0;
    blockedByForceCorrection = false;
    mistypedWordsMap.clear();
    return getState();
  }

  return {
    handleInput,
    handleCompositionStart,
    handleCompositionUpdate,
    handleCompositionEnd,
    updateOptions,
    reset,
    getState
  };
}
