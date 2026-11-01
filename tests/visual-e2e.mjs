import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve('test-screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function logStep(stepNum, title) {
  console.log(`\n============================================================`);
  console.log(`👉 [BƯỚC ${stepNum}] ${title}`);
  console.log(`============================================================`);
}

async function runVisualE2ETests() {
  console.log('🚀 Khởi động Chromium trực tiếp trên màn hình macOS (headless: false, slowMo: 250ms)...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 250,
    args: ['--window-size=1280,860', '--window-position=50,50']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 820 },
    locale: 'vi-VN'
  });

  const page = await context.newPage();

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    steps: []
  };

  function assert(condition, description) {
    results.total += 1;
    if (condition) {
      results.passed += 1;
      results.steps.push({ description, status: 'PASS' });
      console.log(`  ✓ PASS: ${description}`);
    } else {
      results.failed += 1;
      results.steps.push({ description, status: 'FAIL' });
      console.error(`  ✗ FAIL: ${description}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // BƯỚC 1: Kho Kiến Thức (Library) & Seed Data
    // -------------------------------------------------------------
    logStep(1, 'Kiểm tra Kho Kiến thức (Library) & Seed Data');
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.notes-grid');

    const pageTitle = await page.title();
    assert(pageTitle.includes('TypeLearn'), `Tiêu đề trang chứa TypeLearn: "${pageTitle}"`);

    const noteCards = await page.locator('.note-card');
    const noteCount = await noteCards.count();
    assert(noteCount >= 2, `Hiển thị ít nhất 2 bài học khởi tạo (Seed data). Hiện có: ${noteCount}`);

    const sagaTitle = await page.locator('.note-card-title', { hasText: 'Saga pattern trong Microservices' }).isVisible();
    const v8Title = await page.locator('.note-card-title', { hasText: 'Kiến trúc V8 Runtime trên EdgeOne Pages' }).isVisible();
    assert(sagaTitle && v8Title, 'Cả 2 bài mẫu (Saga pattern và Kiến trúc V8) đều hiện diện đầy đủ');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-library-initial.png') });
    await page.waitForTimeout(1000);

    // -------------------------------------------------------------
    // BƯỚC 2: Phím tắt Ctrl+K, Tìm kiếm & Lọc Category/Tag
    // -------------------------------------------------------------
    logStep(2, 'Kiểm tra phím tắt Ctrl+K / Cmd+K, tìm kiếm và lọc danh mục & thẻ');
    
    // Thử phím tắt Ctrl/Cmd + K
    await page.keyboard.press('Meta+k');
    let isSearchFocused = await page.evaluate(() => document.activeElement.classList.contains('search-input'));
    if (!isSearchFocused) {
      await page.keyboard.press('Control+k');
      isSearchFocused = await page.evaluate(() => document.activeElement.classList.contains('search-input'));
    }
    assert(isSearchFocused, 'Phím tắt ⌘K / Ctrl+K kích hoạt focus ngay lập tức vào ô tìm kiếm');

    // Tìm kiếm bài V8
    await page.fill('.search-input', 'V8');
    await page.waitForTimeout(400);
    let visibleCards = await page.locator('.note-card:visible').count();
    let visibleTitle = await page.locator('.note-card:visible .note-card-title').innerText();
    assert(visibleCards === 1 && visibleTitle.includes('V8'), `Tìm kiếm "V8" chỉ hiển thị đúng 1 bài V8 (kết quả: "${visibleTitle}")`);

    // Xoá tìm kiếm
    await page.fill('.search-input', '');
    await page.waitForTimeout(400);

    // Lọc theo Category 'Backend'
    const backendCatBtn = page.locator('.chip-btn', { hasText: 'Backend' });
    await backendCatBtn.click();
    await page.waitForTimeout(400);
    visibleCards = await page.locator('.note-card:visible').count();
    visibleTitle = await page.locator('.note-card:visible .note-card-title').innerText();
    assert(visibleCards === 1 && visibleTitle.includes('Saga'), `Lọc Category "Backend" lọc đúng bài Saga`);

    // Xoá lọc category về Tất cả
    await page.locator('.chip-btn', { hasText: 'Tất cả' }).first().click();
    await page.waitForTimeout(300);

    // Lọc theo Tag '#edgeone'
    const edgeoneTagBtn = page.locator('.chip-btn', { hasText: '#edgeone' });
    await edgeoneTagBtn.click();
    await page.waitForTimeout(400);
    visibleCards = await page.locator('.note-card:visible').count();
    visibleTitle = await page.locator('.note-card:visible .note-card-title').innerText();
    assert(visibleCards === 1 && visibleTitle.includes('V8'), `Lọc Tag "#edgeone" lọc đúng bài V8`);

    // Trả về Tất cả tags ("Mọi thẻ")
    await page.locator('.chip-btn', { hasText: 'Mọi thẻ' }).click();
    await page.waitForTimeout(400);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-library-filtered.png') });

    // -------------------------------------------------------------
    // BƯỚC 3: Cài đặt Giao diện (Theme Dark / Light / System) & Mã đồng bộ
    // -------------------------------------------------------------
    logStep(3, 'Kiểm tra Chuyển đổi Theme Dark / Light / System & Sync Code');
    
    // Mở Modal Cài đặt
    await page.click('button[aria-label="Mở cài đặt giao diện và đồng bộ"]');
    await page.waitForSelector('.modal-panel');

    // Chuyển sang Light
    await page.click('button:has-text("Sáng (Light)")');
    await page.waitForTimeout(500);
    let currentTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert(currentTheme === 'light', `Chuyển sang Theme Light thành công: data-theme="${currentTheme}"`);

    // Chuyển sang Dark
    await page.click('button:has-text("Tối (Zen Dark)")');
    await page.waitForTimeout(500);
    currentTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    assert(currentTheme === 'dark', `Chuyển về Theme Dark thành công: data-theme="${currentTheme}"`);

    // Nhập Mã đồng bộ Sync Code
    await page.fill('#sync-code-input', 'thando-qa-2026');
    await page.fill('#admin-token-input', 'admin123');
    await page.click('button:has-text("Lưu thiết lập")');
    await page.waitForTimeout(400);

    const isModalClosed = await page.locator('.modal-panel').count() === 0;
    assert(isModalClosed, 'Modal Cài đặt đóng lại sau khi lưu thiết lập');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-settings-saved.png') });

    // -------------------------------------------------------------
    // BƯỚC 4: Thêm bài mới (AddNote) & Live Preview đếm khối
    // -------------------------------------------------------------
    logStep(4, 'Thêm bài mới (AddNote), kiểm tra Live Preview & lưu với ADMIN_TOKEN');
    
    await page.click('button:has-text("+ Thêm bài mới")');
    await page.waitForSelector('.editor-grid');

    const sampleMarkdown = `---
title: Thuật toán Raft Consensus
category: Phân tán
tags: [consensus, raft, distributed]
lang: vi-VN
---

## Cơ chế bầu chọn Leader

Thuật toán Raft chia thời gian thành các nhiệm kỳ để bầu chọn nút lãnh đạo duy nhất.

- Khi bắt đầu mọi nút đều ở trạng thái Follower và chờ tín hiệu heartbeat từ Leader.
- Nếu hết thời gian chờ mà không nhận được heartbeat nút chuyển sang Candidate để kêu gọi bỏ phiếu.

\`\`\`mermaid
stateDiagram-v2
  [*] --> Follower
  Follower --> Candidate: Timeout không có heartbeat
  Candidate --> Leader: Đạt đa số phiếu bầu
  Leader --> Follower: Phát hiện term lớn hơn
\`\`\`

> Ghi chú: Đa số phiếu bầu được tính theo công thức n / 2 + 1 để bảo đảm tính duy nhất.
`;

    await page.fill('#md-editor-textarea', sampleMarkdown);
    await page.waitForTimeout(600);

    // Kiểm tra Live Preview counts
    const countBoxes = await page.locator('.count-box .count-num').allInnerTexts();
    // text, flow, code, note
    console.log('  Live Preview counts:', countBoxes);
    assert(parseInt(countBoxes[0]) === 3, `Đếm đúng 3 khối luyện gõ (1 đoạn văn + 2 gạch đầu dòng): ${countBoxes[0]}`);
    assert(parseInt(countBoxes[1]) === 1, `Đếm đúng 1 sơ đồ Flow/Mermaid: ${countBoxes[1]}`);
    assert(parseInt(countBoxes[2]) === 0, `Đếm đúng 0 khối code: ${countBoxes[2]}`);
    assert(parseInt(countBoxes[3]) === 1, `Đếm đúng 1 ghi chú phụ: ${countBoxes[3]}`);

    // Thử nhập token sai để kiểm tra từ chối quyền
    await page.fill('#addnote-admin-token', 'wrong_token');
    await page.click('button[type="submit"]:has-text("Lưu bài")');
    await page.waitForTimeout(500);
    const hasErrorAlert = await page.locator('[role="alert"]').isVisible();
    assert(hasErrorAlert, 'Từ chối lưu bài và hiển thị thông báo lỗi khi ADMIN_TOKEN không hợp lệ');

    // Nhập token chuẩn và lưu
    await page.fill('#addnote-admin-token', 'admin123');
    await page.click('button[type="submit"]:has-text("Lưu bài")');
    await page.waitForSelector('.note-layout', { timeout: 5000 });
    await page.waitForTimeout(800);

    const noteHeading = await page.locator('.note-article h1').innerText();
    assert(noteHeading.includes('Thuật toán Raft Consensus'), `Lưu bài thành công và mở trang Đọc: "${noteHeading}"`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-note-saved-reading.png') });

    // -------------------------------------------------------------
    // BƯỚC 5: Trang Đọc (Note), Mục lục TOC & Sơ đồ Mermaid
    // -------------------------------------------------------------
    logStep(5, 'Trang Đọc (Note): Mục lục TOC, sơ đồ Mermaid và khối gõ');
    
    // Kiểm tra Mục lục TOC
    const tocLink = page.locator('.toc-link', { hasText: 'Cơ chế bầu chọn Leader' });
    assert(await tocLink.isVisible(), 'Mục lục TOC hiển thị tiêu đề phụ');
    await tocLink.click();
    await page.waitForTimeout(500);

    // Kiểm tra sơ đồ Mermaid SVG
    await page.waitForSelector('.mermaid-canvas svg', { timeout: 8000 });
    const hasMermaidSvg = await page.locator('.mermaid-canvas svg').isVisible();
    assert(hasMermaidSvg, 'Sơ đồ Mermaid được dựng thành công dưới dạng SVG sắc nét');

    // Kiểm tra các khối văn bản đọc có nút luyện gõ
    const blockTextItems = await page.locator('.reading-block-text').count();
    assert(blockTextItems === 3, `Hiển thị 3 khối văn bản đọc có nút luyện từng khối: ${blockTextItems}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-reading-mermaid-rendered.png') });

    // -------------------------------------------------------------
    // BƯỚC 6: Chế độ Luyện Gõ (Typing) & Các bài test chuyên sâu
    // -------------------------------------------------------------
    logStep(6, 'Vào chế độ Luyện gõ (Typing Mode) & Kiểm thử các tính năng gõ');

    await page.click('button:has-text("⌨️ Luyện gõ ngay")');
    await page.waitForSelector('.typing-box-card');
    await page.waitForTimeout(500);

    // Đảm bảo input được focus
    await page.click('.typing-box-card');
    const inputEl = page.locator('.typing-hidden-input');

    // 6.1 Gõ đúng một vài ký tự đầu
    console.log('  --- Test 6.1: Gõ ký tự đúng ---');
    // Khối 1: "Thuật toán Raft chia thời gian thành các nhiệm kỳ để bầu chọn nút lãnh đạo duy nhất."
    await inputEl.pressSequentially('Thuật', { delay: 150 });
    await page.waitForTimeout(300);

    let correctChars = await page.locator('.char-correct').count();
    assert(correctChars === 5, `Gõ đúng 5 ký tự "Thuật": hiện đúng ${correctChars} ký tự xanh`);

    // 6.2 Cố tình gõ sai dấu cách để kiểm tra ký hiệu ␣ màu đỏ và gạch chân lượn sóng
    console.log('  --- Test 6.2: Cố tình gõ sai dấu cách để hiện ký hiệu ␣ đỏ ---');
    // Ký tự tiếp theo là dấu cách ' '. Ta cố tình bấm phím 'x'
    await page.keyboard.press('x');
    await page.waitForTimeout(300);

    const spaceErrorChar = page.locator('.char-incorrect');
    const spaceErrorText = await spaceErrorChar.innerText();
    const hasErrorWavy = await spaceErrorChar.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.textDecorationLine.includes('underline') || style.textDecorationStyle.includes('wavy');
    });

    assert(spaceErrorText === '␣', `Ký tự dấu cách sai được hiển thị dưới dạng ký hiệu trực quan "␣": "${spaceErrorText}"`);
    assert(hasErrorWavy, 'Ký tự sai có gạch chân lượn sóng wavy (underline wavy)');

    // 6.3 Kiểm tra Force Correction (bị chặn không cho gõ tiếp khi chưa bấm Backspace)
    console.log('  --- Test 6.3: Kiểm tra cơ chế Force Correction ---');
    const forceBanner = await page.locator('.force-correction-banner').isVisible();
    assert(forceBanner, 'Banner cảnh báo "Bấm Backspace để sửa ký tự gõ sai" xuất hiện');

    // Thử gõ thêm khi đang bị lỗi
    await page.keyboard.press('y');
    await page.waitForTimeout(200);
    const charsAfterBlocked = await page.locator('.char-incorrect').count();
    assert(charsAfterBlocked === 1, 'Bị chặn không ghi nhận phím gõ tiếp theo khi đang có lỗi sai');

    // Bấm Backspace để sửa sai
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
    const errorsAfterBackspace = await page.locator('.char-incorrect').count();
    assert(errorsAfterBackspace === 0, 'Bấm Backspace xoá thành công ký tự sai và cho phép gõ tiếp');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-space-error-and-correction.png') });

    // 6.4 Thử chuyển đổi chế độ "Gõ tự do" và bật lại "Bắt buộc sửa sai"
    console.log('  --- Test 6.4: Thử toggle sang Gõ tự do ---');
    await page.click('button:has-text("Bắt buộc sửa sai (Bật)")');
    await page.waitForTimeout(300);
    const isFreeMode = await page.locator('button:has-text("⚡ Gõ tự do")').isVisible();
    assert(isFreeMode, 'Chuyển sang chế độ "⚡ Gõ tự do" thành công');

    // Gõ sai trong chế độ tự do rồi gõ tiếp
    await inputEl.pressSequentially(' yz', { delay: 100 });
    await page.waitForTimeout(300);
    const incorrectCountInFree = await page.locator('.char-incorrect').count();
    assert(incorrectCountInFree > 1, `Trong chế độ Gõ tự do, người dùng có thể gõ tiếp qua các ký tự sai (${incorrectCountInFree} ký tự sai)`);

    // Reset lại khối bằng phím tắt Tab / nút Gõ lại
    console.log('  --- Test 6.5: Phím tắt Tab gõ lại khối ---');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);
    correctChars = await page.locator('.char-correct').count();
    assert(correctChars === 0, 'Phím Tab khởi tạo lại khối gõ về trạng thái ban đầu');

    // Bật lại Bắt buộc sửa sai
    const forceBtn = page.locator('button:has-text("Gõ tự do")');
    if (await forceBtn.isVisible()) {
      await forceBtn.click();
      await page.waitForTimeout(300);
    }

    // 6.6 Mô phỏng bộ gõ Tiếng Việt (Vietnamese IME composition)
    console.log('  --- Test 6.6: Mô phỏng bộ gõ tiếng Việt IME ---');
    await page.click('.typing-box-card');

    // Gõ "Thuật " trước
    await inputEl.pressSequentially('Thuật ', { delay: 80 });
    await page.waitForTimeout(200);

    // Kế tiếp là từ "toán" -> mô phỏng chuỗi IME:
    // compositionstart -> compositionupdate ('toans') -> compositionend ('toán') + input
    await inputEl.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      el.value = el.value + 'toans';
      el.dispatchEvent(new CompositionEvent('compositionupdate', { data: 'toans', bubbles: true }));
    });
    await page.waitForTimeout(300);

    const isComposingNotice = await page.locator('.typing-box-card').innerText();
    const hasComposingNotice = isComposingNotice.includes('Đang gõ tổ hợp dấu IME');
    assert(hasComposingNotice, 'Giao diện hiển thị trạng thái "Đang gõ tổ hợp dấu IME" khi đang bỏ dấu');

    // Kết thúc IME: chốt từ "toán"
    await inputEl.evaluate((el) => {
      el.value = el.value.slice(0, -5) + 'toán';
      el.dispatchEvent(new CompositionEvent('compositionend', { data: 'toán', bubbles: true }));
      el.dispatchEvent(new InputEvent('input', { data: 'toán', inputType: 'insertCompositionText', bubbles: true }));
    });
    await page.waitForTimeout(300);

    const wordToanCorrect = await page.evaluate(() => {
      // Tìm xem các ký tự của "toán" có class char-correct không
      const correctSpans = Array.from(document.querySelectorAll('.char-correct')).map(s => s.innerText).join('');
      return correctSpans.includes('Thuật toán');
    });
    assert(wordToanCorrect, 'Bộ gõ Tiếng Việt IME chốt từ "toán" thành công không bị báo lỗi sai giả');

    // 6.7 Hoàn thành hết Khối 1
    console.log('  --- Test 6.7: Hoàn thành Khối 1 ---');
    await page.waitForTimeout(300);
    const remainingBlock1 = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.char-untyped')).map(s => s.innerText).join('')
    );
    console.log(`  Remaining Block 1: "${remainingBlock1}"`);
    await inputEl.evaluate(el => el.setSelectionRange(el.value.length, el.value.length));
    await inputEl.pressSequentially(remainingBlock1, { delay: 20 });
    await page.waitForTimeout(500);

    const block1CompletePrompt = await page.locator('.block-complete-prompt').isVisible();
    assert(block1CompletePrompt, 'Khối 1 hoàn thành! Hiển thị hộp thoại "Hoàn thành khối! Bấm Enter để tiếp tục"');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-block-1-completed.png') });

    // Bấm Enter để sang Khối 2
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);

    // Khối 2:
    console.log('  --- Test 6.8: Gõ Khối 2 ---');
    await page.waitForTimeout(400);
    const block2Target = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.t-char')).map(s => s.innerText).join('')
    );
    console.log(`  Target Khối 2: "${block2Target}"`);
    await inputEl.pressSequentially(block2Target, { delay: 20 });
    await page.waitForTimeout(500);

    const block2CompletePrompt = await page.locator('.block-complete-prompt').isVisible();
    assert(block2CompletePrompt, 'Khối 2 hoàn thành!');

    // Bấm Enter để sang Khối 3
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);

    // Khối 3:
    console.log('  --- Test 6.9: Gõ Khối 3 và vào màn hình Tổng kết ---');
    await page.waitForTimeout(400);
    const block3Target = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.t-char')).map(s => s.innerText).join('')
    );
    console.log(`  Target Khối 3: "${block3Target}"`);
    await inputEl.pressSequentially(block3Target, { delay: 20 });
    await page.waitForTimeout(500);

    // Bấm Enter để chốt phiên và sang màn hình Tổng kết
    await page.keyboard.press('Enter');
    await page.waitForSelector('.summary-card', { timeout: 6000 });
    await page.waitForTimeout(800);

    // -------------------------------------------------------------
    // BƯỚC 7: Màn hình Tổng kết (Summary) & Đồng bộ Sync Code
    // -------------------------------------------------------------
    logStep(7, 'Kiểm tra Màn hình Tổng kết (Summary) & Trạng thái đồng bộ');

    const summaryHeading = await page.locator('#summary-heading').innerText();
    assert(summaryHeading.includes('Hoàn thành phiên luyện gõ'), `Màn hình Tổng kết hiển thị tiêu đề: "${summaryHeading}"`);

    const summaryWpm = await page.locator('.summary-stat-val').first().innerText();
    const summaryAccuracy = await page.locator('.summary-stat-val').nth(1).innerText();
    console.log(`  Chỉ số kết quả phiên: ${summaryWpm} WPM · Chính xác ${summaryAccuracy}`);
    assert(parseInt(summaryWpm) > 0, `Tốc độ WPM hợp lệ (> 0): ${summaryWpm}`);
    assert(parseInt(summaryAccuracy) > 0, `Độ chính xác hợp lệ: ${summaryAccuracy}`);

    // Kiểm tra thông tin đồng bộ KV theo sync code
    const syncText = await page.locator('.summary-card').innerText();
    assert(syncText.includes('thando-qa-2026'), 'Hiển thị thông tin đã đồng bộ KV theo mã cá nhân "thando-qa-2026"');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-summary-screen.png') });

    // Nhấn phím Esc để quay về Kho
    await page.keyboard.press('Escape');
    await page.waitForSelector('.notes-grid');
    await page.waitForTimeout(500);

    const raftCard = page.locator('.note-card', { hasText: 'Thuật toán Raft Consensus' });
    const hasRecordStats = await raftCard.locator('.tabular-nums', { hasText: 'Kỷ lục:' }).isVisible();
    assert(hasRecordStats, 'Thẻ bài học trong Kho đã được cập nhật Kỷ lục WPM và số lần luyện');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-library-updated-stats.png') });

    // -------------------------------------------------------------
    // BƯỚC 8: Kiểm tra Responsive Mobile (375x667 - iPhone SE)
    // -------------------------------------------------------------
    logStep(8, 'Kiểm tra Chế độ Hiển thị Mobile (375x667) & Accessibility Touch Targets');

    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(600);

    // Kiểm tra không tràn ngang
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert(!hasHorizontalOverflow, 'Giao diện Mobile không bị tràn ngang (No horizontal scrollbar)');

    // Kiểm tra kích thước nút bấm chạm chuẩn Mobile Touch Target >= 44x44px
    const touchButtonHeights = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.top-header button, .note-card-actions .btn'));
      return buttons.map(b => b.getBoundingClientRect().height);
    });
    const allTouchAdequate = touchButtonHeights.every(h => h >= 40); // 40-44px
    assert(allTouchAdequate, 'Các nút bấm trên Mobile đạt kích thước touch target an toàn >= 40-44px');

    // Mở trang đọc trên mobile
    await page.locator('.note-card-actions .btn:has-text("Đọc bài")').first().click();
    await page.waitForSelector('.note-layout');
    await page.waitForTimeout(600);

    const mobileReadOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert(!mobileReadOverflow, 'Trang Đọc trên Mobile hiển thị gọn gàng, không bị tràn thanh cuộn ngang');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-mobile-reading-375x667.png') });

  } catch (err) {
    console.error('❌ Lỗi ngoại lệ trong quá trình chạy kiểm thử:', err);
    results.failed += 1;
    results.steps.push({ description: `Lỗi ngoại lệ: ${err.message}`, status: 'FAIL' });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error-exception.png') }).catch(() => {});
  } finally {
    console.log('\n============================================================');
    console.log(`📊 KẾT QUẢ KIỂM THỬ TRỰC QUAN: ${results.passed}/${results.total} kịch bản đạt (${results.failed} lỗi)`);
    console.log('============================================================');
    await page.waitForTimeout(2000);
    await browser.close();
  }

  return results;
}

runVisualE2ETests().then(res => {
  if (res.failed > 0) {
    process.exit(1);
  }
});
