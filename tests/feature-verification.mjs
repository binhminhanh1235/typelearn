import { chromium } from 'playwright';

async function runFeatureVerification() {
  console.log('🚀 Bắt đầu kịch bản kiểm thử chuyên sâu cho 2 tính năng: Mermaid Flow & TTS Voice/Rate Options...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 820 },
    locale: 'vi-VN'
  });

  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
  });

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };

  function assert(condition, testName, extraInfo = '') {
    results.total += 1;
    if (condition) {
      results.passed += 1;
      results.details.push({ testName, status: 'PASS', extraInfo });
      console.log(`  ✓ PASS: ${testName} ${extraInfo ? `(${extraInfo})` : ''}`);
    } else {
      results.failed += 1;
      results.details.push({ testName, status: 'FAIL', extraInfo });
      console.error(`  ✗ FAIL: ${testName} ${extraInfo ? `(${extraInfo})` : ''}`);
    }
  }

  try {
    // =========================================================================
    // 1. TÍNH NĂNG 1: Sơ đồ Flow (Mermaid) phía trên TypingBlock
    // =========================================================================
    console.log('\n============================================================');
    console.log('🧪 PHẦN 1: Kiểm thử Sơ đồ Flow (Mermaid) phía trên TypingBlock');
    console.log('============================================================');

    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');

    // Mở bài học Saga (có sơ đồ mermaid ở khối 2)
    const sagaCard = page.locator('.note-card', { hasText: 'Saga pattern trong Microservices' });
    await sagaCard.waitFor({ timeout: 5000 });
    await sagaCard.locator('.btn:has-text("Luyện gõ")').click();

    // Chờ màn hình Typing xuất hiện
    await page.waitForSelector('.typing-viewport', { timeout: 5000 });
    await page.waitForSelector('.typing-box-card', { timeout: 5000 });

    // Kiểm tra .typing-flow-panel xuất hiện
    const flowPanel = page.locator('.typing-flow-panel');
    const flowPanelVisible = await flowPanel.isVisible();
    assert(flowPanelVisible, 'Khung .typing-flow-panel xuất hiện trên màn hình Typing khi bài học có sơ đồ Flow');

    // Kiểm tra Mermaid SVG được dựng thành công
    await page.waitForSelector('.typing-flow-panel .mermaid-canvas svg', { timeout: 8000 });
    const hasSvg = await page.locator('.typing-flow-panel .mermaid-canvas svg').isVisible();
    assert(hasSvg, 'Sơ đồ Mermaid được dựng thành công dưới dạng SVG trong panel');

    // Kiểm tra vị trí: boundingBox().y của .typing-flow-panel nhỏ hơn boundingBox().y của .typing-box-card
    const flowBox = await flowPanel.boundingBox();
    const typingBox = await page.locator('.typing-box-card').boundingBox();
    assert(
      flowBox && typingBox && flowBox.y < typingBox.y,
      'Vị trí panel sơ đồ nằm Ở PHÍA TRÊN vùng gõ typing-box-card',
      `flowBox.y=${flowBox?.y?.toFixed(1)}px < typingBox.y=${typingBox?.y?.toFixed(1)}px`
    );

    // Kiểm tra khoảng cách trực quan: flow bottom nằm trước hoặc liền kề typing box top
    const isDirectlyAbove = flowBox && typingBox && (flowBox.y + flowBox.height <= typingBox.y + 10);
    assert(isDirectlyAbove, 'Panel sơ đồ nằm ngay phía trên vùng gõ, không bị lệch hoặc chồng đè');

    // Focus vào input gõ trước
    await page.click('.typing-box-card');
    let isInputFocused = await page.evaluate(() =>
      document.activeElement?.classList.contains('typing-hidden-input')
    );
    assert(isInputFocused, 'Ô input .typing-hidden-input được focus ban đầu');

    // Kiểm tra nút Thu gọn sơ đồ
    const toggleBtn = page.locator('.typing-flow-toggle-btn');
    const initialBtnText = (await toggleBtn.innerText()).trim();
    assert(initialBtnText.includes('Thu gọn sơ đồ'), 'Nút toggle có nhãn mặc định "Thu gọn sơ đồ ▲"');

    // Click Thu gọn sơ đồ
    await toggleBtn.click();
    await page.waitForTimeout(300);

    const bodyHidden = await page.locator('.typing-flow-panel-body').count() === 0;
    const collapsedBtnText = (await toggleBtn.innerText()).trim();
    assert(bodyHidden, 'Nội dung sơ đồ Mermaid được thu gọn ẩn đi thành công');
    assert(collapsedBtnText.includes('Hiện sơ đồ'), 'Nhãn nút đổi thành "Hiện sơ đồ ▼"');

    // KIỂM TRA QUAN TRỌNG: Nút Thu gọn không làm mất focus của ô .typing-hidden-input
    isInputFocused = await page.evaluate(() =>
      document.activeElement?.classList.contains('typing-hidden-input')
    );
    assert(isInputFocused, 'Sau khi click "Thu gọn sơ đồ", focus vẫn giữ nguyên tại .typing-hidden-input');

    // Gõ phím ngay lập tức sau khi bấm thu gọn để xác nhận gõ bình thường không cần click lại
    const inputEl = page.locator('.typing-hidden-input');
    await inputEl.pressSequentially('A', { delay: 50 });
    await page.waitForTimeout(200);
    let correctCount = await page.locator('.char-correct').count();
    assert(correctCount >= 1, 'Người dùng gõ phím ngay sau khi bấm Thu gọn sơ đồ mà không cần click lại vào khung gõ');

    // Click Mở lại sơ đồ (Hiện sơ đồ)
    await toggleBtn.click();
    await page.waitForTimeout(300);

    const bodyRestored = await page.locator('.typing-flow-panel-body .mermaid-canvas svg').isVisible();
    const expandedBtnText = (await toggleBtn.innerText()).trim();
    assert(bodyRestored, 'Nội dung sơ đồ Mermaid được khôi phục hiển thị đầy đủ');
    assert(expandedBtnText.includes('Thu gọn sơ đồ'), 'Nhãn nút đổi lại thành "Thu gọn sơ đồ ▲"');

    // KIỂM TRA QUAN TRỌNG: Nút Mở sơ đồ cũng không làm mất focus của ô .typing-hidden-input
    isInputFocused = await page.evaluate(() =>
      document.activeElement?.classList.contains('typing-hidden-input')
    );
    assert(isInputFocused, 'Sau khi click "Hiện sơ đồ", focus vẫn giữ nguyên tại .typing-hidden-input');

    // Gõ thêm dấu cách ' '
    await inputEl.pressSequentially(' ', { delay: 50 });
    await page.waitForTimeout(200);
    correctCount = await page.locator('.char-correct').count();
    assert(correctCount >= 2, 'Tiếp tục gõ phím mượt mà sau khi mở lại sơ đồ');

    // =========================================================================
    // 2. TÍNH NĂNG 2: Tuỳ chọn Giọng đọc (Voice) và Tốc độ đọc (Rate) TTS
    // =========================================================================
    console.log('\n============================================================');
    console.log('🧪 PHẦN 2: Kiểm thử Dropdown Giọng đọc & Tốc độ đọc TTS');
    console.log('============================================================');

    const typingVoiceSelect = page.locator('select[aria-label="Chọn giọng đọc TTS"]');
    const typingRateSelect = page.locator('select[aria-label="Tốc độ đọc TTS"]');

    assert(await typingVoiceSelect.isVisible(), 'Dropdown chọn giọng đọc TTS xuất hiện trên màn hình Typing');
    assert(await typingRateSelect.isVisible(), 'Dropdown chọn tốc độ đọc TTS xuất hiện trên màn hình Typing');

    // Kiểm tra danh sách options trong tốc độ đọc TTS
    const rateOptions = await typingRateSelect.locator('option').allInnerTexts();
    console.log('  Available rate options:', rateOptions);
    assert(rateOptions.includes('1.25x') && rateOptions.includes('1.5x'), 'Dropdown tốc độ chứa các tuỳ chọn chuẩn (bao gồm 1.25x và 1.5x)');

    // Chọn tốc độ đọc 1.25x trên Typing
    await typingRateSelect.selectOption('1.25');
    await page.waitForTimeout(200);

    // Kiểm tra lưu vào localStorage
    let storedSettings = await page.evaluate(() => {
      const raw = localStorage.getItem('typelearn_settings');
      return raw ? JSON.parse(raw) : null;
    });
    assert(storedSettings && storedSettings.ttsRate === 1.25, 'Tốc độ 1.25x được lưu chính xác vào localStorage (typelearn_settings)');

    // KIỂM TRA QUAN TRỌNG: Focus tự động quay về .typing-hidden-input sau khi chọn tốc độ
    isInputFocused = await page.evaluate(() =>
      document.activeElement?.classList.contains('typing-hidden-input')
    );
    assert(isInputFocused, 'Sau khi chọn tốc độ đọc 1.25x, focus tự động quay về .typing-hidden-input (không bị kẹt ở select)');

    // Chọn tiếp tốc độ đọc 1.5x
    await typingRateSelect.selectOption('1.5');
    await page.waitForTimeout(200);

    storedSettings = await page.evaluate(() => {
      const raw = localStorage.getItem('typelearn_settings');
      return raw ? JSON.parse(raw) : null;
    });
    assert(storedSettings && storedSettings.ttsRate === 1.5, 'Tốc độ 1.5x được lưu chính xác vào localStorage (typelearn_settings)');

    isInputFocused = await page.evaluate(() =>
      document.activeElement?.classList.contains('typing-hidden-input')
    );
    assert(isInputFocused, 'Sau khi chọn tốc độ đọc 1.5x, focus tự động quay về .typing-hidden-input');

    // Thử chọn giọng đọc (voice) nếu có
    const voiceOptionsCount = await typingVoiceSelect.locator('option').count();
    console.log(`  Số lượng option giọng đọc TTS khả dụng: ${voiceOptionsCount}`);
    if (voiceOptionsCount > 1) {
      const secondVoiceVal = await typingVoiceSelect.locator('option').nth(1).getAttribute('value');
      await typingVoiceSelect.selectOption(secondVoiceVal);
      await page.waitForTimeout(200);

      storedSettings = await page.evaluate(() => {
        const raw = localStorage.getItem('typelearn_settings');
        return raw ? JSON.parse(raw) : null;
      });
      assert(
        storedSettings && storedSettings.ttsVoiceURI === secondVoiceVal,
        `Giọng đọc đã chọn ("${secondVoiceVal}") được lưu chính xác vào localStorage`
      );

      isInputFocused = await page.evaluate(() =>
        document.activeElement?.classList.contains('typing-hidden-input')
      );
      assert(isInputFocused, 'Sau khi chọn giọng đọc, focus tự động quay về .typing-hidden-input');
    } else {
      await typingVoiceSelect.selectOption('');
      await page.waitForTimeout(200);
      isInputFocused = await page.evaluate(() =>
        document.activeElement?.classList.contains('typing-hidden-input')
      );
      assert(isInputFocused, 'Focus tự động quay về .typing-hidden-input khi tương tác với dropdown Giọng đọc');
    }

    // =========================================================================
    // 3. KIỂM THỬ PHÍM TẮT CTRL+J & TTS PARAMETERS
    // =========================================================================
    console.log('\n============================================================');
    console.log('🧪 PHẦN 3: Kiểm thử phím tắt Ctrl+J kích hoạt TTS với rate & voice đã chọn');
    console.log('============================================================');

    // Cài đặt spy trên window.speechSynthesis.speak
    await page.evaluate(() => {
      window.__ttsSpy = {
        calls: [],
        lastUtterance: null
      };

      if (!window.speechSynthesis) {
        window.speechSynthesis = {
          speak: () => {},
          cancel: () => {},
          getVoices: () => []
        };
      }

      const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = function (utterance) {
        window.__ttsSpy.calls.push({
          text: utterance.text,
          rate: utterance.rate,
          lang: utterance.lang,
          voiceURI: utterance.voice?.voiceURI || utterance.voice?.name || ''
        });
        window.__ttsSpy.lastUtterance = utterance;
        try {
          origSpeak(utterance);
        } catch (_) {}
      };
    });

    // Kích hoạt phím tắt Ctrl+J (hoặc Cmd+J trên Mac)
    await page.keyboard.press('Control+j');
    await page.waitForTimeout(400);

    let ttsSpyResult = await page.evaluate(() => window.__ttsSpy);
    if (!ttsSpyResult || ttsSpyResult.calls.length === 0) {
      await page.keyboard.press('Meta+j');
      await page.waitForTimeout(400);
      ttsSpyResult = await page.evaluate(() => window.__ttsSpy);
    }

    assert(
      ttsSpyResult && ttsSpyResult.calls.length > 0,
      'Phím tắt Ctrl+J / Cmd+J kích hoạt gọi hàm speechSynthesis.speak'
    );

    if (ttsSpyResult && ttsSpyResult.calls.length > 0) {
      const lastCall = ttsSpyResult.calls[ttsSpyResult.calls.length - 1];
      console.log('  TTS Spy call detail:', lastCall);
      assert(
        lastCall.rate === 1.5,
        `TTS được gọi với đúng tốc độ 1.5x đã thiết lập (thực tế: ${lastCall.rate}x)`
      );
      assert(
        lastCall.text && lastCall.text.includes('A saga is a sequence'),
        `TTS được gọi với đúng nội dung văn bản khối hiện tại (bắt đầu bằng: "${lastCall.text.slice(0, 30)}...")`
      );
    }

    // =========================================================================
    // 4. KIỂM THỬ TRÊN TRANG ĐỌC (Note.jsx)
    // =========================================================================
    console.log('\n============================================================');
    console.log('🧪 PHẦN 4: Kiểm thử Dropdown TTS trên màn hình Đọc (Note.jsx)');
    console.log('============================================================');

    // Nhấn Esc từ màn hình Typing -> chuyển về màn hình Đọc (Note.jsx) theo thiết kế
    await page.keyboard.press('Escape');
    await page.waitForSelector('.note-layout', { timeout: 5000 });

    const noteVoiceSelect = page.locator('.note-layout select[aria-label="Chọn giọng đọc TTS"], header select[aria-label="Chọn giọng đọc TTS"], .page-container select[aria-label="Chọn giọng đọc TTS"]').first();
    const noteRateSelect = page.locator('.note-layout select[aria-label="Tốc độ đọc TTS"], header select[aria-label="Tốc độ đọc TTS"], .page-container select[aria-label="Tốc độ đọc TTS"]').first();

    assert(await noteVoiceSelect.isVisible(), 'Dropdown Giọng đọc TTS xuất hiện trên màn hình Note');
    assert(await noteRateSelect.isVisible(), 'Dropdown Tốc độ đọc TTS xuất hiện trên màn hình Note');

    // Kiểm tra giá trị đồng bộ từ localStorage (1.5x đã set từ trước)
    const currentNoteRateVal = await noteRateSelect.inputValue();
    assert(currentNoteRateVal === '1.5', `Dropdown Tốc độ trên màn hình Note giữ đồng bộ giá trị 1.5x từ cài đặt (giá trị: "${currentNoteRateVal}")`);

    // Đổi sang 1.75x trên màn hình Note
    await noteRateSelect.selectOption('1.75');
    await page.waitForTimeout(200);

    storedSettings = await page.evaluate(() => {
      const raw = localStorage.getItem('typelearn_settings');
      return raw ? JSON.parse(raw) : null;
    });
    assert(storedSettings && storedSettings.ttsRate === 1.75, 'Thay đổi tốc độ 1.75x trên màn hình Note được lưu vào localStorage');

    // =========================================================================
    // 5. AUDIT ACCESSIBILITY (A11y) & MOBILE RESPONSIVE
    // =========================================================================
    console.log('\n============================================================');
    console.log('🧪 PHẦN 5: Audit UI/UX, A11y (WCAG) & Mobile Responsive');
    console.log('============================================================');

    // Kiểm tra aria-label trên các dropdown
    const voiceAria = await noteVoiceSelect.getAttribute('aria-label');
    const rateAria = await noteRateSelect.getAttribute('aria-label');
    assert(voiceAria === 'Chọn giọng đọc TTS', `Select giọng đọc có aria-label trợ năng hợp lệ: "${voiceAria}"`);
    assert(rateAria === 'Tốc độ đọc TTS', `Select tốc độ đọc có aria-label trợ năng hợp lệ: "${rateAria}"`);

    // Kiểm tra touch target height >= 40px
    const selectHeights = await page.evaluate(() => {
      const v = document.querySelector('select[aria-label="Chọn giọng đọc TTS"]')?.getBoundingClientRect().height || 0;
      const r = document.querySelector('select[aria-label="Tốc độ đọc TTS"]')?.getBoundingClientRect().height || 0;
      return { v, r };
    });
    assert(
      selectHeights.v >= 40 && selectHeights.r >= 40,
      `Kích thước chiều cao dropdown đạt chuẩn Touch Target (>= 40-44px): voice=${selectHeights.v}px, rate=${selectHeights.r}px`
    );

    // Chuyển sang Mobile Viewport (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(400);

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert(!hasHorizontalOverflow, 'Giao diện trên Mobile Viewport (375x667) không bị tràn ngang');

    // Vào lại màn hình Typing trên Mobile
    await page.locator('.btn:has-text("⌨️ Luyện gõ ngay")').click();
    await page.waitForSelector('.typing-viewport', { timeout: 5000 });
    await page.waitForTimeout(400);

    const mobileTypingOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert(!mobileTypingOverflow, 'Màn hình Typing trên Mobile không bị tràn ngang với cả panel Flow và thanh TTS');

    // Kiểm tra Console / Page Errors
    console.log(`\nTổng số console.error ghi nhận: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.error('Console errors:', consoleErrors);
    }
    console.log(`Tổng số pageerror ghi nhận: ${pageErrors.length}`);
    if (pageErrors.length > 0) {
      console.error('Page errors:', pageErrors);
    }

    assert(consoleErrors.length === 0, 'Không có console.error nào trong toàn bộ phiên kiểm thử');
    assert(pageErrors.length === 0, 'Không có pageerror / ngoại lệ JS chưa bắt nào');

  } catch (err) {
    console.error('❌ Lỗi ngoại lệ trong quá trình kiểm thử:', err);
    results.failed += 1;
    results.details.push({ testName: `Lỗi ngoại lệ: ${err.message}`, status: 'FAIL' });
  } finally {
    console.log('\n============================================================');
    console.log(`📊 TỔNG KẾT KIỂM THỬ: ${results.passed}/${results.total} PASSED (${results.failed} FAILED)`);
    console.log('============================================================');
    await browser.close();
  }

  return results;
}

runFeatureVerification().then(res => {
  if (res.failed > 0) {
    process.exit(1);
  }
});
