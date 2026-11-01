import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Làm sạch HTML bằng DOMPurify để chống XSS tuyệt đối
 */
export function sanitizeHtml(dirtyHtml) {
  if (!dirtyHtml) return '';
  if (typeof window !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
    return DOMPurify.sanitize(dirtyHtml, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
    });
  }
  // Fallback an toàn cho môi trường không có DOM
  return String(dirtyHtml)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]?).*?\1/gi, '');
}

/**
 * Render inline markdown sang HTML đã được làm sạch XSS (dùng ở chế độ Đọc)
 */
export function renderInlineMarkdownSafe(text) {
  if (!text) return '';
  // Khoá raw HTML trước khi đưa qua marked.parseInline bằng cách escape các thẻ HTML nguy hiểm
  const rawHtml = marked.parseInline(String(text));
  return sanitizeHtml(rawHtml);
}

/**
 * Chuẩn hoá văn bản trước khi đưa vào Typing Engine để so khớp ký tự
 * @param {string} rawText
 * @param {{ ignoreCase?: boolean, ignorePunctuation?: boolean }} options
 */
export function normalizeTextForTyping(rawText, options = {}) {
  if (!rawText) return '';
  const { ignoreCase = false, ignorePunctuation = false } = options;

  let text = String(rawText);

  // 1. Gọt bỏ tiền tố danh sách đầu dòng nếu còn sót (- , * , + , 1. )
  text = text.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '');

  // 2. Gỡ bỏ cú pháp Markdown inline nhưng giữ lại nội dung hiển thị
  // Ảnh ![alt](url) -> alt
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Link [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Inline code `code` -> code
  text = text.replace(/`([^`]+)`/g, '$1');
  // Bold + Italic ***text*** hoặc ___text___
  text = text.replace(/(\*\*\*|___)(.*?)\1/g, '$2');
  // Bold **text** hoặc __text__
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  // Italic *text* hoặc _text_
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  // Strikethrough ~~text~~
  text = text.replace(/~~(.*?)~~/g, '$1');
  // Loại bỏ thẻ HTML thô nếu có
  text = text.replace(/<[^>]+>/g, '');

  // 3. Chuẩn hoá dấu nháy thông minh và gạch ngang
  text = text
    .replace(/[’‘‛′`]/g, "'")
    .replace(/[“”„″«»]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');

  // 4. Chuẩn hoá Unicode NFC (quan trọng cho tiếng Việt có dấu để khớp với IME)
  text = text.normalize('NFC');

  // 5. Tuỳ chọn bỏ qua dấu câu
  if (ignorePunctuation) {
    text = text.replace(/[.,/#!$%^&*;:{}=\-_~()?"'[\]\\<>@+|]/g, '');
  }

  // 6. Tuỳ chọn bỏ phân biệt hoa/thường
  if (ignoreCase) {
    text = text.toLowerCase();
  }

  // 7. Gộp khoảng trắng liên tiếp thành 1 dấu cách và cắt 2 đầu
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Tách YAML Front Matter đơn giản ở đầu file Markdown
 */
export function parseFrontMatter(rawMd) {
  const defaultMeta = {
    title: 'Bài học mới',
    category: 'General',
    tags: [],
    lang: 'en-US'
  };

  if (!rawMd || typeof rawMd !== 'string') {
    return { meta: defaultMeta, body: '' };
  }

  const normalized = rawMd.replace(/\r\n/g, '\n');
  const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!fmMatch) {
    // Nếu không có front matter, thử lấy heading đầu tiên làm title
    const firstHeading = normalized.match(/^#+\s+(.+)$/m);
    return {
      meta: {
        ...defaultMeta,
        title: firstHeading ? firstHeading[1].trim() : defaultMeta.title
      },
      body: normalized
    };
  }

  const yamlStr = fmMatch[1];
  const body = fmMatch[2];
  const meta = { ...defaultMeta };

  const lines = yamlStr.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let val = trimmed.slice(colonIdx + 1).trim();

    // Bỏ dấu nháy bọc ngoài nếu có
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1).trim();
    }

    if (key === 'title' && val) {
      meta.title = val;
    } else if (key === 'category' && val) {
      meta.category = val;
    } else if (key === 'lang' && val) {
      meta.lang = val;
    } else if (key === 'tags') {
      if (val.startsWith('[') && val.endsWith(']')) {
        const inner = val.slice(1, -1);
        meta.tags = inner
          .split(',')
          .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      } else if (val) {
        meta.tags = val
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }
  }

  return { meta, body };
}

/**
 * Tạo slug cho heading để làm mục lục (TOC)
 */
function slugifyHeading(text, index) {
  const base = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base ? `section-${base}-${index}` : `section-${index}`;
}

/**
 * Phân tích toàn bộ nội dung Markdown thành { meta, blocks[], counts }
 * Quy tắc phân loại blocks[]:
 * - heading: `#`, `##`, ... (dùng làm TOC, không gõ)
 * - text: đoạn văn thường & từng mục danh sách `-` hoặc `1.` (khối luyện gõ)
 * - flow: khối ```mermaid (chỉ hiển thị sơ đồ, không gõ)
 * - code: khối code khác (chỉ hiển thị highlight, không gõ)
 * - note: blockquote `>` (ghi chú phụ hiển thị mờ, không gõ)
 */
export function parseNote(rawMd) {
  const { meta, body } = parseFrontMatter(rawMd);
  const tokens = marked.lexer(body || '');
  const blocks = [];
  let headingCounter = 0;

  for (const token of tokens) {
    if (token.type === 'space' || token.type === 'hr') {
      continue;
    }

    if (token.type === 'heading') {
      headingCounter += 1;
      const cleanHeading = normalizeTextForTyping(token.text);
      blocks.push({
        type: 'heading',
        depth: token.depth || 2,
        text: cleanHeading || token.text,
        raw: token.text,
        html: renderInlineMarkdownSafe(token.text),
        id: slugifyHeading(cleanHeading, headingCounter)
      });
      continue;
    }

    if (token.type === 'code') {
      const lang = (token.lang || '').trim().toLowerCase();
      if (lang === 'mermaid') {
        blocks.push({
          type: 'flow',
          code: token.text.trim()
        });
      } else {
        blocks.push({
          type: 'code',
          lang: lang || 'plaintext',
          code: token.text
        });
      }
      continue;
    }

    if (token.type === 'blockquote') {
      const quoteRaw = (token.text || '').trim();
      const cleanNote = normalizeTextForTyping(quoteRaw);
      blocks.push({
        type: 'note',
        text: cleanNote || quoteRaw,
        raw: quoteRaw,
        html: renderInlineMarkdownSafe(quoteRaw)
      });
      continue;
    }

    if (token.type === 'list') {
      // Mỗi mục trong danh sách (- hoặc 1.) là một khối luyện gõ độc lập
      for (const item of token.items || []) {
        // Lấy dòng nội dung chính của item, gọt bỏ tiền tố nếu có
        const rawItemText = String(item.text || '')
          .split('\n')[0]
          .replace(/^\s*(?:[-*+]|\d+\.)\s+/, '')
          .trim();
        const typingText = normalizeTextForTyping(rawItemText);
        if (typingText) {
          blocks.push({
            type: 'text',
            isListItem: true,
            text: typingText,
            raw: rawItemText,
            html: renderInlineMarkdownSafe(rawItemText)
          });
        }
      }
      continue;
    }

    if (token.type === 'paragraph' || token.type === 'text') {
      const rawParagraph = String(token.text || '').trim();
      // Kiểm tra nếu đoạn văn chỉ chứa duy nhất 1 ảnh ![alt](url)
      const imgOnlyMatch = rawParagraph.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgOnlyMatch) {
        blocks.push({
          type: 'note',
          text: imgOnlyMatch[1] || 'Hình minh hoạ',
          raw: rawParagraph,
          html: renderInlineMarkdownSafe(rawParagraph)
        });
        continue;
      }

      const typingText = normalizeTextForTyping(rawParagraph);
      if (typingText) {
        blocks.push({
          type: 'text',
          isListItem: false,
          text: typingText,
          raw: rawParagraph,
          html: renderInlineMarkdownSafe(rawParagraph)
        });
      }
      continue;
    }
  }

  // Gắn liên kết giữa khối text và khối flow (mermaid) trong cùng phân đoạn (section giữa các heading)
  const sections = [];
  let currentSection = { heading: null, blocks: [] };
  sections.push(currentSection);

  for (const block of blocks) {
    if (block.type === 'heading') {
      currentSection = { heading: block, blocks: [] };
      sections.push(currentSection);
    } else {
      currentSection.blocks.push(block);
    }
  }

  let pendingFlows = [];
  let lastTextSectionBlocks = [];

  for (const section of sections) {
    const sectionFlows = section.blocks
      .filter((b) => b.type === 'flow' && b.code)
      .map((b) => b.code);
    const activeFlows = [...pendingFlows, ...sectionFlows];
    const sectionTextBlocks = section.blocks.filter((b) => b.type === 'text');

    if (sectionTextBlocks.length > 0) {
      for (const tb of sectionTextBlocks) {
        if (section.heading) {
          tb.sectionHeading = section.heading.text;
        }
        if (activeFlows.length > 0) {
          // Tìm khối flow gần nhất trong cùng section nếu có nhiều flow
          const tbIdx = section.blocks.indexOf(tb);
          let nearestFlowCode = activeFlows[0];
          let minDistance = Infinity;
          section.blocks.forEach((b, idx) => {
            if (b.type === 'flow' && b.code) {
              const dist = Math.abs(idx - tbIdx);
              if (dist < minDistance) {
                minDistance = dist;
                nearestFlowCode = b.code;
              }
            }
          });
          tb.flowCode = nearestFlowCode;
          tb.flows = [...activeFlows];
        } else {
          tb.flowCode = null;
          tb.flows = [];
        }
      }
      lastTextSectionBlocks = sectionTextBlocks;
      pendingFlows = [];
    } else if (activeFlows.length > 0) {
      pendingFlows = activeFlows;
    }
  }

  // Nếu còn flow ở cuối bài chưa gắn vào section nào có text thì gắn vào các khối text cuối cùng
  if (pendingFlows.length > 0 && lastTextSectionBlocks.length > 0) {
    for (const tb of lastTextSectionBlocks) {
      const mergedFlows = [...(tb.flows || []), ...pendingFlows];
      tb.flows = mergedFlows;
      if (!tb.flowCode) {
        tb.flowCode = mergedFlows[0] || null;
      }
    }
  }

  const counts = {
    text: blocks.filter((b) => b.type === 'text').length,
    flow: blocks.filter((b) => b.type === 'flow').length,
    code: blocks.filter((b) => b.type === 'code').length,
    note: blocks.filter((b) => b.type === 'note').length,
    heading: blocks.filter((b) => b.type === 'heading').length
  };

  return {
    meta,
    blocks,
    counts
  };
}
