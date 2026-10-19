import { useEffect, useId, useRef, useState } from 'react';
import { Building2, Camera, Check, ChevronDown, HeartHandshake, Laptop, Lightbulb, Mic, PencilLine, Presentation, type LucideIcon } from 'lucide-react';

interface ParticipationOption {
  value: string;
  label: string;
  icon: LucideIcon;
}

// Keep stored values stable so existing applications and category rules still work.
export const PARTICIPATION_OPTIONS: ParticipationOption[] = [
  { value: 'Есть своя инициатива', label: 'Своя идея', icon: Lightbulb },
  { value: 'Хочу быть ведущим', label: 'Ведущий', icon: Mic },
  { value: 'Медиа, фото, видео', label: 'Медиа', icon: Camera },
  { value: 'IT и техническая поддержка', label: 'IT', icon: Laptop },
  { value: 'Мастер-класс', label: 'Мастер-класс', icon: Presentation },
  { value: 'Волонтёр', label: 'Волонтёр', icon: HeartHandshake },
  { value: 'Я — организация-партнёр', label: 'Партнёр', icon: Building2 },
  { value: 'Свой вариант (указать область)', label: 'Другое', icon: PencilLine },
];

const SUPPORT_OPTION: ParticipationOption = { value: 'Хочу помочь инициативе', label: 'Помочь проекту', icon: HeartHandshake };

interface Props {
  value: string;
  onChange: (value: string) => void;
  allowSupport: boolean;
  disabled: boolean;
}

export function ParticipationSelect({ value, onChange, allowSupport, disabled }: Props) {
  const id = useId();
  const listId = `${id}-options`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const typeahead = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const options = allowSupport ? [...PARTICIPATION_OPTIONS, SUPPORT_OPTION] : PARTICIPATION_OPTIONS;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex];
  const SelectedIcon = selected.icon;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, listId]);

  function choose(index: number) {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Escape') {
      if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(activeIndex);
      else { setActiveIndex(selectedIndex); setOpen(true); }
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const current = open ? activeIndex : selectedIndex;
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : Math.min(options.length - 1, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1)));
      setActiveIndex(next);
      setOpen(true);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const query = `${now - typeahead.current.time < 700 ? typeahead.current.text : ''}${event.key}`.toLocaleLowerCase('ru');
      typeahead.current = { text: query, time: now };
      const match = options.findIndex((option) => option.label.toLocaleLowerCase('ru').startsWith(query));
      if (match >= 0) { event.preventDefault(); setActiveIndex(match); setOpen(true); }
    }
  }

  return <div className="participation-select" ref={root}>
    <label id={`${id}-label`} htmlFor={`${id}-trigger`} className="participation-label">Чем поможешь?</label>
    <button ref={trigger} id={`${id}-trigger`} type="button" role="combobox" aria-labelledby={`${id}-label`} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined} disabled={disabled} className="participation-trigger" data-open={open} onKeyDown={onKeyDown} onClick={() => { setActiveIndex(selectedIndex); setOpen((current) => !current); }} onBlur={() => setOpen(false)}>
      <span className="participation-selected-icon"><SelectedIcon size={18} strokeWidth={1.8} aria-hidden="true" /></span><span>{selected.label}</span><ChevronDown className="participation-chevron" size={18} aria-hidden="true" />
    </button>
    {open && <ul id={listId} role="listbox" aria-labelledby={`${id}-label`} className="participation-options">
      {options.map((option, index) => {
        const Icon = option.icon;
        return <li id={`${listId}-${index}`} role="option" aria-selected={option.value === value} data-active={activeIndex === index} key={option.value} className="participation-option" onPointerMove={() => setActiveIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(index)}>
          <Icon size={17} strokeWidth={1.7} aria-hidden="true" /><span>{option.label}</span>{option.value === value && <Check className="participation-check" size={16} strokeWidth={2.2} aria-hidden="true" />}
        </li>;
      })}
    </ul>}
  </div>;
}
