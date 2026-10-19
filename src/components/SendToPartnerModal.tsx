import React, { useState } from 'react';
import { CrossIcon, SendIcon, BuildingIcon } from './Icons.tsx';
import type { ForwardedInitiative } from '../utils/auth.ts';
import { ModalDialog } from './ModalDialog.tsx';

interface SendToPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initiative: {
    id: string;
    title: string;
    authorName: string;
    authorPhone: string;
    authorEmail: string;
    area: string;
    description: string;
  } | null;
  onSend: (payload: {
    partnerName: string;
    senderNote: string;
    initiative: ForwardedInitiative;
  }) => Promise<void>;
  senderName: string;
  senderRole: string;
  partnerOptions: { name: string; specialization: string }[];
}

export const SendToPartnerModal: React.FC<SendToPartnerModalProps> = ({
  isOpen,
  onClose,
  initiative,
  onSend,
  senderName,
  senderRole,
  partnerOptions,
}) => {
  const [selectedPartner, setSelectedPartner] = useState('');
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !initiative) return null;

  const resolvedPartner = partnerOptions.some((partner) => partner.name === selectedPartner)
    ? selectedPartner
    : partnerOptions[0]?.name ?? '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending || !resolvedPartner) return;

    const forwarded: ForwardedInitiative = {
      id: `fwd-${Date.now()}`,
      title: initiative.title,
      authorName: initiative.authorName,
      authorPhone: initiative.authorPhone,
      authorEmail: initiative.authorEmail,
      area: initiative.area,
      description: initiative.description,
      senderName,
      senderRole,
      senderNote: note.trim() || undefined,
      sentDate: new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date()),
      status: 'new',
      partnerName: resolvedPartner,
    };

    setIsSending(true);
    setError('');
    try {
      await onSend({ partnerName: resolvedPartner, senderNote: note.trim(), initiative: forwarded });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось отправить инициативу');
    } finally { setIsSending(false); }
  };

  return (
    <ModalDialog labelledBy="send-partner-title" onClose={onClose} busy={isSending}>

      {/* Modal Card */}
      <div className="relative w-full max-w-[460px] bg-[#FFFFFF] rounded-[16px] border border-[#E8EAEE] p-6 sm:p-8 shadow-2xl modal-animate z-10">
        <button
          type="button"
          onClick={onClose}
          disabled={isSending}
          aria-label="Закрыть"
          className="absolute top-5 right-5 w-8 h-8 rounded-[8px] flex items-center justify-center text-[#6B7280] hover:text-[#0F1115] hover:bg-[#F7F8FA] cursor-pointer"
        >
          <CrossIcon size={18} strokeWidth={2} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-[8px] bg-[#FDE8EC] text-[#E60023] flex items-center justify-center">
            <SendIcon size={15} strokeWidth={2.4} />
          </div>
          <h3 id="send-partner-title" className="text-[19px] font-bold text-[#0F1115] tracking-tight">
            Отправить инициативу партнёру
          </h3>
        </div>
        <p className="text-[13px] text-[#6B7280] mb-5">
          Проект будет передан в личный кабинет выбранного партнёра с вашим комментарием
        </p>

        {/* Initiative Brief Card */}
        <div className="p-3.5 rounded-[12px] bg-[#F7F8FA] border border-[#E8EAEE] mb-4">
          <div className="text-[11px] font-semibold text-[#E60023] uppercase tracking-wider mb-0.5">
            Инициатива · {initiative.area}
          </div>
          <div className="text-[14px] font-bold text-[#0F1115] leading-snug">
            {initiative.title}
          </div>
          <div className="text-[12px] text-[#6B7280] mt-1">
            Автор: {initiative.authorName} ({initiative.authorPhone})
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={isSending} className="space-y-4"><legend className="sr-only">Передача инициативы партнёру</legend>
          <div>
            <label htmlFor="partner-select" className="block text-[13px] font-medium text-[#0F1115] mb-1.5">
              Выберите партнёра
            </label>
            <select
              id="partner-select"
              value={resolvedPartner}
              onChange={(e) => setSelectedPartner(e.target.value)}
              className="pervik-input pervik-select cursor-pointer font-medium"
            >
              {partnerOptions.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 text-[11px] text-[#6B7280] mt-1">
              <BuildingIcon size={12} strokeWidth={2} />
              <span>
                {partnerOptions.find((p) => p.name === resolvedPartner)?.specialization ?? 'Сначала администратор добавит учётную запись партнёра'}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="sender-note" className="block text-[13px] font-medium text-[#0F1115] mb-1.5">
              Комментарий куратора / председателя (необязательно)
            </label>
            <textarea
              id="sender-note"
              maxLength={1000}
              rows={2}
              placeholder="Например: Просим поддержать площадкой или провести консультацию для ребят"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="pervik-input resize-y min-h-[70px]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={partnerOptions.length === 0 || isSending}
              className="w-full h-11 rounded-[10px] bg-[#E60023] hover:bg-[#CC001F] text-white font-semibold text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
            >
              <SendIcon size={16} strokeWidth={2.4} />
              <span>{isSending ? 'Отправляем…' : 'Отправить партнёру'}</span>
            </button>
          </div>
          </fieldset>
          {error && <p className="inline-error" role="alert">{error}</p>}
        </form>
      </div>
    </ModalDialog>
  );
};
