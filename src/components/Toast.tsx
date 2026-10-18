import React, { useEffect } from 'react';
import { CheckIcon } from './Icons.tsx';

export interface ToastMessage {
  id: number;
  text: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      onClose();
    }, 2200);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 flex items-center gap-2.5 bg-[#0F1115] text-white px-5 py-3 rounded-[10px] shadow-lg pointer-events-none select-none toast-animate"
      style={{
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
      }}
    >
      <span className="flex items-center justify-center w-4 h-4 text-[#059669]">
        <CheckIcon size={16} strokeWidth={2.5} />
      </span>
      <span className="text-[14px] font-medium tracking-normal leading-tight">{toast.text}</span>
    </div>
  );
};
