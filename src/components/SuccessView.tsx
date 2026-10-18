import React from 'react';
import { CheckIcon } from './Icons.tsx';

interface SuccessViewProps {
  onGoHome: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({ onGoHome }) => {
  return (
    <div className="platform-success-wrap flex-1 flex flex-col justify-center items-center px-4 py-8 sm:py-12">
      <main className="platform-success-card w-full max-w-[440px] flex flex-col items-center text-center p-8 bg-[#FFFFFF] rounded-[16px] border border-[#E8EAEE] shadow-sm">
        {/* Circular checkmark (64x64, #E6F7EE bg, #059669 icon) */}
        <div className="w-16 h-16 rounded-full bg-[#E6F7EE] text-[#059669] flex items-center justify-center mb-5">
          <CheckIcon size={32} strokeWidth={2.8} />
        </div>

        {/* Title */}
        <h2 className="text-[24px] font-bold text-[#0F1115] tracking-tight mb-2">
          Заявка отправлена
        </h2>

        {/* Text */}
        <p className="text-[15px] text-[#6B7280] leading-relaxed mb-7 max-w-[340px]">
          Мы получили твою заявку и скоро свяжемся с тобой по указанным контактам
        </p>

        {/* Secondary button */}
        <button
          type="button"
          onClick={onGoHome}
          className="w-full max-w-[260px] h-11 rounded-[10px] bg-[#F7F8FA] hover:bg-[#EFF1F5] border border-[#E8EAEE] text-[#0F1115] font-semibold text-[14px] transition-colors cursor-pointer"
        >
          На главную
        </button>
      </main>
    </div>
  );
};
