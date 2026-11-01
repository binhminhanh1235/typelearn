import { useEffect, useState, useRef } from 'preact/hooks';

let mermaidCounter = 0;

export function MermaidBlock({ code = '' }) {
  const [svgHtml, setSvgHtml] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    async function renderDiagram() {
      try {
        const mermaidMod = await import('mermaid');
        const mermaid = mermaidMod.default || mermaidMod;

        const isLight =
          typeof document !== 'undefined' &&
          document.documentElement.getAttribute('data-theme') === 'light';

        mermaid.initialize({
          startOnLoad: false,
          theme: isLight ? 'default' : 'dark',
          securityLevel: 'strict',
          fontFamily: 'Inter, system-ui, sans-serif'
        });

        mermaidCounter += 1;
        const id = `mermaid-svg-${Date.now()}-${mermaidCounter}`;
        const { svg } = await mermaid.render(id, code.trim());

        if (active) {
          setSvgHtml(svg);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError('Không thể dựng sơ đồ Mermaid. Hiển thị mã gốc bên dưới.');
          setLoading(false);
        }
      }
    }

    if (code && code.trim()) {
      renderDiagram();
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [code]);

  return (
    <div class="mermaid-block-wrap" role="region" aria-label="Sơ đồ luồng Mermaid (không gõ)">
      <div class="code-block-header">
        <span>mermaid · Sơ đồ luồng minh hoạ (không gõ)</span>
      </div>
      {loading && (
        <div class="mermaid-canvas" style={{ color: 'var(--text-muted)' }}>
          Đang tải sơ đồ minh hoạ…
        </div>
      )}
      {!loading && error && (
        <div style={{ padding: '16px' }}>
          <p style={{ color: 'var(--warning)', margin: '0 0 8px', fontSize: '0.85rem' }}>{error}</p>
          <pre class="code-block-pre">{code}</pre>
        </div>
      )}
      {!loading && !error && svgHtml && (
        <div
          ref={containerRef}
          class="mermaid-canvas"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      )}
    </div>
  );
}
