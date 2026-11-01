import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react';
import { formatRussianPhone, russianPhoneDigits } from '../utils/contactFields.ts';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & { value: string; onChange: (value: string) => void };

function caretAfterDigits(value: string, count: number): number {
  if (count <= 0) return Math.min(value.length, 4);
  let found = 0;
  for (let index = 2; index < value.length; index++) if (/\d/.test(value[index]) && ++found === count) return index + 1;
  return value.length;
}

export function PhoneInput({ value, onChange, onFocus, onBlur, onKeyDown, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current !== null && document.activeElement === ref.current) ref.current?.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [value]);
  function update(raw: string, nationalDigitsBeforeCaret: number) {
    const formatted = !props.required && !russianPhoneDigits(raw) ? '' : formatRussianPhone(raw);
    const position = caretAfterDigits(formatted, nationalDigitsBeforeCaret);
    caret.current = position;
    onChange(formatted);
    // Removing a separator can leave the formatted value unchanged.
    if (formatted === value) { ref.current?.setSelectionRange(position, position); caret.current = null; }
  }
  return <input {...props} ref={ref} type="tel" inputMode="tel" autoComplete="tel" maxLength={24}
    placeholder="+7 (000) 000-00-00" pattern={'\\+7 \\([0-9]{3}\\) [0-9]{3}-[0-9]{2}-[0-9]{2}'}
    data-validation-pattern="Введи номер полностью: +7 (999) 123-45-67."
    value={value} onFocus={event => { if (!value && props.required) onChange('+7'); onFocus?.(event); }}
    onBlur={event => { if (!russianPhoneDigits(value) && !props.required) onChange(''); onBlur?.(event); }}
    onChange={event => {
      const raw = event.target.value;
      const end = event.target.selectionStart ?? raw.length;
      const prefix = raw.slice(0, end).replace(/\D/g, '');
      const hasCountry = raw.startsWith('+7') || (raw.replace(/\D/g, '').length >= 11 && /^[78]/.test(raw.replace(/\D/g, '')));
      update(raw, Math.max(0, prefix.length - (hasCountry ? 1 : 0)));
    }}
    onKeyDown={event => {
      onKeyDown?.(event);
      if (event.defaultPrevented || !['Backspace', 'Delete'].includes(event.key) || !value.startsWith('+7')) return;
      const input = event.currentTarget;
      const start = input.selectionStart ?? 0;
      if (start !== input.selectionEnd) return;
      const backwards = event.key === 'Backspace';
      let index = backwards ? start - 1 : start;
      while (index >= 2 && index < value.length && !/\d/.test(value[index])) index += backwards ? -1 : 1;
      event.preventDefault();
      if (index < 2 || index >= value.length) return;
      const before = value.slice(2, index).replace(/\D/g, '').length;
      update(value.slice(0, index) + value.slice(index + 1), before);
    }} />;
}
