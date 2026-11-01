import React, { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  text: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!toast || hovered || focused) return;

    const timer = setTimeout(() => {
      onClose();
    }, 8000);

    return () => clearTimeout(timer);
  }, [toast, onClose, hovered, focused]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      className="platform-toast fixed bottom-6 left-1/2 z-50 flex items-center gap-2.5 bg-[#0F1115] text-white px-4 py-3 rounded-[10px] shadow-lg toast-animate"
    >
      <span className="flex items-center justify-center w-4 h-4 flex-none text-white">
        <Info size={17} />
      </span>
      <span className="text-[14px] font-medium tracking-normal leading-tight">{toast.text}</span>
      <button type="button" onClick={onClose} aria-label="Закрыть уведомление"><X size={17} /></button>
    </div>
  );
};
