import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  labelledBy: string;
  onClose: () => void;
  busy?: boolean;
  fullScreen?: boolean;
}

/** Native dialogs keep keyboard focus and screen readers inside the open window. */
export function ModalDialog({ children, labelledBy, onClose, busy = false, fullScreen = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previouslyFocused = document.activeElement;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-busy={busy} className={fullScreen ? 'login-screen modal-fullscreen' : 'modal-frame'} onKeyDown={(event) => {
    if (event.key !== 'Tab') return;
    const elements = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter((element) => element.getClientRects().length > 0);
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} onClick={(event) => { if (!fullScreen && event.target === event.currentTarget && !busy) onClose(); }}>{children}</dialog>;
}
