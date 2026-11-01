import { useLayoutEffect, useRef } from 'react';
import '../fit-text.css';

/** Display only: account names remain complete in storage, accessible labels and tooltips. */
export function FitText({ text, name = false, minSize = 12 }: { text: string; name?: boolean; minSize?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    let stopped = false;
    let frame = 0;
    let width = -1;
    function fit() {
      if (stopped || !node || !node.clientWidth) return;
      node.style.removeProperty('font-size');
      node.textContent = text;
      const base = parseFloat(getComputedStyle(node).fontSize);
      if (name && node.scrollWidth > node.clientWidth) {
        const parts = text.trim().split(/\s+/);
        if (parts.length >= 2) node.textContent = `${parts[0]} ${parts.slice(1).map(part => `${Array.from(part)[0]}.`).join(' ')}`;
      }
      if (node.scrollWidth > node.clientWidth) {
        let low = Math.min(minSize, base), high = base;
        for (let i = 0; i < 8; i++) {
          const mid = (low + high) / 2;
          node.style.fontSize = `${mid}px`;
          if (node.scrollWidth > node.clientWidth) high = mid; else low = mid;
        }
        node.style.fontSize = `${low}px`;
      }
    }
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(next - width) < .5) return;
      width = next;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(node);
    fit();
    void document.fonts.ready.then(() => { if (!stopped) fit(); });
    return () => { stopped = true; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [text, name, minSize]);
  return <span ref={ref} className="fit-text" title={text} aria-label={text}>{text}</span>;
}
