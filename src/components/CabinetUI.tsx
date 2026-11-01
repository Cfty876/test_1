import { ChevronLeft, ChevronRight, Copy, Mail, Phone, Search, X, ExternalLink } from 'lucide-react';
import { normalizeVkUrl } from '../utils/contactFields.ts';
import type { ReactNode } from 'react';

export function CabinetSearch({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  return <label className="cabinet-search"><Search size={17} aria-hidden="true" /><input type="search" value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} aria-label={label} />{value && <button type="button" onClick={() => onChange('')} aria-label="Очистить поиск"><X size={15} /></button>}</label>;
}

export function CabinetPagination({ total, page, size, onChange }: { total: number; page: number; size: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <div className="cabinet-pagination"><span role="status">{total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} из ${total}` : 'Нет записей'}</span>{pages > 1 && <div><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Предыдущая страница"><ChevronLeft size={16} /></button><span>{page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Следующая страница"><ChevronRight size={16} /></button></div>}</div>;
}

export function CabinetEmpty({ title, children, onReset }: { title: string; children: ReactNode; onReset?: () => void }) {
  return <div className="cabinet-empty"><Search size={25} aria-hidden="true" /><h3>{title}</h3><p>{children}</p>{onReset && <button type="button" className="cabinet-button" onClick={onReset}>Сбросить фильтры</button>}</div>;
}

export function CabinetContacts({ phone, email, vkUrl, onCopy }: { phone: string; email: string; vkUrl?: string; onCopy?: (value: string, label: string) => void }) {
  const vk = normalizeVkUrl(vkUrl || '');
  return <div className="cabinet-contacts">{phone && <span><Phone size={13} aria-hidden="true" /><a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a>{onCopy && <button type="button" aria-label="Скопировать телефон" onClick={() => onCopy(phone, 'Телефон')}><Copy size={13} /></button>}</span>}{email && <span><Mail size={13} aria-hidden="true" /><a href={`mailto:${email}`}>{email}</a>{onCopy && <button type="button" aria-label="Скопировать почту" onClick={() => onCopy(email, 'Почта')}><Copy size={13} /></button>}</span>}{vk && <span><ExternalLink size={13} aria-hidden="true" /><a href={vk} target="_blank" rel="noopener noreferrer">ВКонтакте ↗</a>{onCopy && <button type="button" aria-label="Скопировать ссылку ВКонтакте" onClick={() => onCopy(vk, 'Ссылка ВКонтакте')}><Copy size={13} /></button>}</span>}</div>;
}
