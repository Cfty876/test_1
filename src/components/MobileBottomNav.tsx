import { useEffect, useState, type CSSProperties } from 'react';
import { subscribePagePosition } from '../utils/pagePosition.ts';
import { House, LayoutGrid, Plus, TicketCheck, UserRound } from 'lucide-react';

interface Props { view: string; signedIn: boolean; onHome: () => void; onIdeas: () => void; onStart: () => void; onTrack: () => void; onCabinet: () => void }
export function MobileBottomNav({ view, signedIn, onHome, onIdeas, onStart, onTrack, onCabinet }: Props) {
  const [editing, setEditing] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  useEffect(() => {
    const sync = () => setEditing(document.activeElement instanceof Element && document.activeElement.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]'));
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', sync);
    return () => { document.removeEventListener('focusin', sync); document.removeEventListener('focusout', sync); };
  }, []);
  useEffect(() => {
    if (view !== 'home') { setHasScrolled(false); return; }
    return subscribePagePosition(({ scrollY }) => {
      setHasScrolled(previous => scrollY > 96 ? true : scrollY < 32 ? false : previous);
    });
  }, [view]);
  const items = [
    { label: 'Главная', icon: House, action: onHome, active: view === 'home' },
    { label: 'Идеи', icon: LayoutGrid, action: onIdeas, active: view === 'initiatives' || view === 'initiative' },
    { label: 'Предложить', icon: Plus, action: onStart, active: false, create: true },
    { label: 'Заявка', icon: TicketCheck, action: onTrack, active: view === 'track' || view === 'success' },
    { label: 'Кабинет', icon: UserRound, action: onCabinet, active: view === 'cabinet' },
  ];
  const visible = !editing && (view !== 'home' || hasScrolled);
  return <nav className="mobile-bottom-nav" data-visible={visible} data-editing={editing} aria-hidden={!visible} inert={!visible} aria-label="Основная навигация">{items.map((item, index) => <button style={{ '--nav-index': index } as CSSProperties} key={item.label} type="button" onClick={item.action} aria-current={item.active ? 'page' : undefined} className={item.create ? 'mobile-nav-create' : ''} aria-label={item.label === 'Кабинет' && !signedIn ? 'Войти в кабинет' : item.label}><span><item.icon size={21} strokeWidth={1.8} /></span><span>{item.label}</span></button>)}</nav>;
}
