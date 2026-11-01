import { describe, it, expect } from 'vitest';
import { parseNote, normalizeTextForTyping, renderInlineMarkdownSafe } from '../parseNote.js';
import { SEED_NOTES } from '../seedData.js';

describe('parseNote & normalizeTextForTyping', () => {
  it('tách chuẩn YAML front matter và phân loại đúng các khối (heading, text, list items, flow, code, note)', () => {
    const sagaNote = SEED_NOTES[0];
    const parsed = parseNote(sagaNote.md);

    expect(parsed.meta.title).toBe('Saga pattern trong Microservices');
    expect(parsed.meta.category).toBe('Backend');
    expect(parsed.meta.tags).toEqual(['microservices', 'distributed', 'saga']);
    expect(parsed.meta.lang).toBe('en-US');

    expect(parsed.counts.heading).toBe(2);
    expect(parsed.counts.flow).toBe(1);
    expect(parsed.counts.code).toBe(1);
    expect(parsed.counts.note).toBe(1);
    // 2 đoạn văn thường + 3 mục danh sách (-) = 5 khối text
    expect(parsed.counts.text).toBe(5);

    const listBlocks = parsed.blocks.filter((b) => b.type === 'text' && b.isListItem);
    expect(listBlocks.length).toBe(3);
    expect(listBlocks[0].text.startsWith('-')).toBe(false);
    expect(listBlocks[0].text).toContain('Choreography lets each service');
  });

  it('tách danh sách đánh số 1. 2. và danh sách gạch đầu dòng - trong bài tiếng Việt', () => {
    const viNote = SEED_NOTES[1];
    const parsed = parseNote(viNote.md);

    expect(parsed.meta.lang).toBe('vi-VN');
    expect(parsed.counts.text).toBe(6);
    expect(parsed.counts.flow).toBe(1);
    expect(parsed.counts.code).toBe(1);
    expect(parsed.counts.note).toBe(1);
  });

  it('chuẩn hoá inline markdown, dấu nháy thông minh, khoảng trắng và tuỳ chọn ignoreCase/ignorePunctuation', () => {
    const raw = '  - **Hello** *world* with `inlineCode` and [EdgeOne](https://edgeone.ai) — “smart’s”   quotes! ';
    const normDefault = normalizeTextForTyping(raw);
    expect(normDefault).toBe('Hello world with inlineCode and EdgeOne - "smart\'s" quotes!');

    const normNoCaseNoPunct = normalizeTextForTyping(raw, {
      ignoreCase: true,
      ignorePunctuation: true
    });
    expect(normNoCaseNoPunct).toBe('hello world with inlinecode and edgeone smarts quotes');
  });

  it('làm sạch XSS hoàn toàn khi render HTML inline', () => {
    const malicious = 'Hello <img src=x onerror=alert(1)> <script>alert("xss")</script> **bold**';
    const clean = renderInlineMarkdownSafe(malicious);
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('<script>');
    expect(clean).toContain('<strong>bold</strong>');
  });
});
