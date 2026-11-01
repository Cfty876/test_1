import { COUNCIL_NAME } from '../utils/brand.ts';
import { useState, type ComponentType } from 'react';
import { ArrowUpRight, ChevronRight, CircleHelp, MoreHorizontal, X } from 'lucide-react';
import { ModalDialog } from './ModalDialog.tsx';

export interface CouncilNavItem { id: string; label: string; short?: string; icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>; count?: number | null }
export function CouncilNavigation({ items, active, onSelect, tone, primary, onHelp }: { items: CouncilNavItem[]; active: string; onSelect: (id: string) => void; tone: 'school' | 'curator'; primary?: string[]; onHelp: () => void }) {
  const [more, setMore] = useState(false);
  const primaryItems = primary ? primary.flatMap(id => items.filter(item => item.id === id)).slice(0, 4) : items.slice(0, 5);
  const overflow = items.some(item => !primaryItems.some(p => p.id === item.id));
  function select(id: string) { setMore(false); onSelect(id); }
  return <>
    <aside className="council-sidebar">
      <a className="council-wordmark" href="/"><strong>Первик<ArrowUpRight size={25} aria-hidden="true" /></strong><span>{tone === 'school' ? 'Кабинет школьного Совета' : COUNCIL_NAME}</span></a>
      <nav aria-label="Разделы кабинета">{items.map(item => <button id={`cabinet-nav-${item.id}`} key={item.id} type="button" aria-current={active === item.id ? 'page' : undefined} onClick={() => select(item.id)}><item.icon size={20} aria-hidden /><span>{item.label}</span>{Boolean(item.count && item.count > 0) && <b>{item.count}</b>}<ChevronRight size={15} aria-hidden /></button>)}</nav>
      <div className="council-sidebar-footer"><button type="button" onClick={onHelp}><CircleHelp size={18} />Помощь по кабинету</button><span>{COUNCIL_NAME}</span></div>
    </aside>
    <nav className="council-bottom-nav" aria-label="Основные разделы кабинета">{primaryItems.map(item => <button key={item.id} type="button" aria-current={active === item.id ? 'page' : undefined} onClick={() => select(item.id)}><span className="council-bottom-icon"><item.icon size={22} aria-hidden />{Boolean(item.count && item.count > 0) && <b aria-label={`${item.count} ожидают внимания`}>{item.count! > 99 ? '99+' : item.count}</b>}</span><span>{item.short || item.label}</span></button>)}{overflow && <button type="button" aria-current={!primaryItems.some(item => item.id === active) ? 'page' : undefined} aria-label="Все разделы кабинета" aria-expanded={more} onClick={() => setMore(true)}><MoreHorizontal size={22} aria-hidden /><span>Ещё</span></button>}</nav>
    {more && <ModalDialog labelledBy="council-menu-title" className="cabinet-dialog council-menu-dialog" onClose={() => setMore(false)}><div className="workflow-dialog"><div className="workflow-dialog-heading"><h2 id="council-menu-title">Разделы кабинета</h2><button type="button" aria-label="Закрыть меню" onClick={() => setMore(false)}><X size={22} /></button></div><nav aria-label="Все разделы">{items.map(item => <button type="button" key={item.id} aria-current={active === item.id ? 'page' : undefined} onClick={() => select(item.id)}><item.icon size={21} aria-hidden /><span>{item.label}</span>{Boolean(item.count && item.count > 0) && <b>{item.count}</b>}<ChevronRight size={17} aria-hidden /></button>)}</nav><button className="council-menu-help" type="button" onClick={() => { setMore(false); onHelp(); }}><CircleHelp size={19} />Помощь по кабинету</button></div></ModalDialog>}
  </>;
}
