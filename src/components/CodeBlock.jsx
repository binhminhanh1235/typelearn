import { useState, useMemo } from 'preact/hooks';
import hljs from 'highlight.js/lib/core';
import java from 'highlight.js/lib/languages/java';
import sql from 'highlight.js/lib/languages/sql';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import python from 'highlight.js/lib/languages/python';
import 'highlight.js/styles/github-dark.css';
import { sanitizeHtml } from '../lib/parseNote.js';

hljs.registerLanguage('java', java);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);

export function CodeBlock({ code = '', lang = 'plaintext' }) {
  const [copied, setCopied] = useState(false);

  const highlightedHtml = useMemo(() => {
    const cleanLang = String(lang || '').toLowerCase().trim();
    try {
      if (cleanLang && hljs.getLanguage(cleanLang)) {
        const res = hljs.highlight(code, { language: cleanLang, ignoreIllegals: true });
        return sanitizeHtml(res.value);
      }
      const auto = hljs.highlightAuto(code);
      return sanitizeHtml(auto.value);
    } catch (_) {
      return sanitizeHtml(
        String(code)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      );
    }
  }, [code, lang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_) {}
  };

  return (
    <div class="code-block-wrap" role="region" aria-label={`Khối mã nguồn ${lang}`}>
      <div class="code-block-header">
        <span>{lang || 'code'} · Minh hoạ (không gõ)</span>
        <button type="button" class="btn btn-sm btn-ghost" onClick={handleCopy}>
          {copied ? 'Đã chép mã' : 'Chép mã'}
        </button>
      </div>
      <pre class="code-block-pre">
        <code class={`hljs language-${lang}`} dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    </div>
  );
}
