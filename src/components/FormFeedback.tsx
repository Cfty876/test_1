import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert } from 'lucide-react';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
interface Feedback { control: Control; host: HTMLDivElement; id: string; previousInvalid: string | null; message: string }
let nextId = 0;

function messageFor(field: Control): string {
  const validity = field.validity;
  if (validity.valueMissing) return field instanceof HTMLInputElement && field.type === 'checkbox' ? 'Поставь галочку, чтобы продолжить.' : field instanceof HTMLSelectElement ? 'Выбери один из вариантов.' : 'Заполни это поле.';
  if (validity.typeMismatch && field instanceof HTMLInputElement && field.type === 'email') return 'Проверь почту: например, name@example.com.';
  if (validity.typeMismatch && field instanceof HTMLInputElement && field.type === 'url') return 'Вставь полную ссылку, начиная с https://.';
  if (validity.patternMismatch) return field.dataset.validationPattern || 'Проверь формат: введённое значение не подходит.';
  if (validity.tooShort) return `Нужно не меньше ${field instanceof HTMLSelectElement ? 1 : field.minLength} символов.`;
  if (validity.tooLong) return 'Сократи текст: он превышает допустимую длину.';
  if (validity.rangeUnderflow) return `Укажи значение не меньше ${field.getAttribute('min')}.`;
  if (validity.rangeOverflow) return `Укажи значение не больше ${field.getAttribute('max')}.`;
  if (validity.badInput || validity.stepMismatch) return 'Проверь число: оно не подходит для этого поля.';
  return validity.customError ? field.validationMessage : 'Проверь это поле и попробуй ещё раз.';
}

/** Keep browser constraint validation, replacing its unstyleable bubbles with accessible inline feedback. */
export function FormFeedback() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  useEffect(() => {
    const records = new Map<Control, Feedback>();
    let focusFrame = 0;
    let focusTarget: Control | null = null;
    const publish = () => setFeedback([...records.values()]);
    function remove(field: Control) {
      const record = records.get(field);
      if (!record) return;
      const description = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== record.id).join(' ');
      if (description) field.setAttribute('aria-describedby', description); else field.removeAttribute('aria-describedby');
      if (record.previousInvalid === null) field.removeAttribute('aria-invalid'); else field.setAttribute('aria-invalid', record.previousInvalid);
      record.host.remove(); records.delete(field);
    }
    function isControl(value: EventTarget | null): value is Control {
      return (value instanceof HTMLInputElement || value instanceof HTMLSelectElement || value instanceof HTMLTextAreaElement) && Boolean(value.closest('.platform-shell'));
    }
    function invalid(event: Event) {
      const field = event.target;
      if (!isControl(field)) return;
      event.preventDefault();
      let record = records.get(field);
      if (!record) {
        const host = document.createElement('div');
        const id = `field-feedback-${++nextId}`;
        host.id = id; host.className = 'field-feedback-host';
        // Checkboxes and the profile's inputs are wrapped in labels; password toggles share a wrapper.
        const anchor = field.closest('label') || (field instanceof HTMLInputElement && field.autocomplete === 'current-password' && field.parentElement?.querySelector('button') ? field.parentElement : field);
        anchor.insertAdjacentElement('afterend', host);
        record = { control: field, host, id, previousInvalid: field.getAttribute('aria-invalid'), message: '' };
        records.set(field, record);
        field.setAttribute('aria-describedby', [...new Set([...(field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean), id])].join(' '));
        field.setAttribute('aria-invalid', 'true');
      }
      record.message = messageFor(field); publish();
      if (!focusTarget) focusTarget = field;
      if (!focusFrame) focusFrame = requestAnimationFrame(() => {
        focusFrame = 0;
        const target = focusTarget; focusTarget = null;
        if (!target?.isConnected) return;
        target.focus({ preventScroll: true });
        const rect = target.getBoundingClientRect();
        if (rect.top < 90 || rect.bottom > window.innerHeight - 80) target.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
    }
    function edited(event: Event) {
      const field = event.target;
      if (!isControl(field)) return;
      // React handlers may normalize a phone or clear custom validity in the same event.
      queueMicrotask(() => {
        const record = records.get(field);
        if (!record) return;
        if (field.validity.valid) remove(field); else record.message = messageFor(field);
        publish();
      });
    }
    function reset(event: Event) {
      if (!(event.target instanceof Element)) return;
      const clear = event.type === 'reset' ? event.target : event.target.closest('[data-clear-validation]')?.closest('[data-validation-scope]');
      if (!clear) return;
      for (const field of records.keys()) if (clear.contains(field)) { field.setCustomValidity(''); remove(field); }
      publish();
    }
    const observer = new MutationObserver(() => {
      let changed = false;
      for (const field of records.keys()) if (!field.isConnected) { remove(field); changed = true; }
      if (changed) publish();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('invalid', invalid, true);
    document.addEventListener('input', edited, true);
    document.addEventListener('change', edited, true);
    document.addEventListener('keyup', edited, true);
    document.addEventListener('focusout', edited, true);
    document.addEventListener('reset', reset, true);
    document.addEventListener('click', reset, true);
    return () => {
      observer.disconnect(); cancelAnimationFrame(focusFrame);
      document.removeEventListener('invalid', invalid, true);
      document.removeEventListener('input', edited, true);
      document.removeEventListener('change', edited, true);
      document.removeEventListener('keyup', edited, true);
      document.removeEventListener('focusout', edited, true);
      document.removeEventListener('reset', reset, true);
      document.removeEventListener('click', reset, true);
      for (const field of records.keys()) remove(field);
    };
  }, []);
  return <>{feedback.map(item => createPortal(<p className="field-feedback" role="alert"><CircleAlert size={16} aria-hidden="true" /><span>{item.message}</span></p>, item.host, item.id))}</>;
}
