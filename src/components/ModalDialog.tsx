import { useEffect, useRef, type ReactNode } from 'react';

// Dialogs can overlap while one view closes and the next opens. Only the last
// closing dialog may unlock the document, regardless of their cleanup order.
const openDialogs = new Set<HTMLDialogElement>();
let originalOverflow = { html: '', x: 0, y: 0 };

interface Props {
  children: ReactNode;
  labelledBy: string;
  onClose: () => void;
  busy?: boolean;
  fullScreen?: boolean;
  className?: string;
}

/** Native dialogs keep keyboard focus and screen readers inside the open window. */
export function ModalDialog({ children, labelledBy, onClose, busy = false, fullScreen = false, className = '' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previouslyFocused = document.activeElement;
    if (!dialog) return;
    const firstDialog = !openDialogs.size;
    if (firstDialog) {
      originalOverflow = { html: document.documentElement.style.overflow, x: window.scrollX, y: window.scrollY };
      // Lock the root only: overflow:hidden on body creates a new scroll container
      // and makes sticky navigation jump to its unscrolled position.
      document.documentElement.style.overflow = 'hidden';
    }
    dialog.showModal();
    openDialogs.add(dialog);
    if (firstDialog) window.scrollTo({ left: originalOverflow.x, top: originalOverflow.y, behavior: 'instant' });
    return () => {
      dialog.close();
      openDialogs.delete(dialog);
      if (!openDialogs.size) {
        document.documentElement.style.overflow = originalOverflow.html;
      }
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected &&
          (!openDialogs.size || [...openDialogs].some(open => open.contains(previouslyFocused)))) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-busy={busy} className={`${fullScreen ? 'modal-fullscreen' : 'modal-frame'} ${className}`} onKeyDown={(event) => {
    if (event.target instanceof Element && event.target.closest('dialog') !== event.currentTarget) return;
    if (event.key !== 'Tab') return;
    const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter((element) => element.getClientRects().length > 0);
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (!fullScreen && event.target === event.currentTarget && !busy) onClose(); }}>{children}</dialog>;
}
