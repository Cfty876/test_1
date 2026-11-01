import { ArrowRight, CalendarDays, ClipboardList, Flag, ShieldCheck, Trophy } from 'lucide-react';
import type { DashboardViewProps } from './DashboardView.tsx';
import type { CabinetSection } from '../utils/permissions.ts';
import { useMemberHub } from './MemberCommunity.tsx';

export function CuratorOverview({ applications, implementations, onNavigate }: Pick<DashboardViewProps, 'applications' | 'implementations'> & { onNavigate: (section: CabinetSection) => void }) {
  const { hub, error } = useMemberHub();
  const pending = applications.filter(item => item.status === 'pending');
  const claims = hub?.claims.filter(item => item.status === 'pending') || [];
  const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Yekaterinburg' });
  const upcoming = hub?.calendar.filter(item => item.endDate >= now).slice(0, 3) || [];
  const cards = [
    { label: 'Новые заявки', count: pending.length, description: 'Инициативы и анкеты, которым нужен ответ', section: 'applications' as const, icon: ClipboardList },
    { label: 'Проверка баллов', count: hub ? claims.length : null, description: 'Сверьте результат и подтверждающие материалы', section: 'ranking' as const, icon: Trophy },
    { label: 'Проекты в работе', count: implementations.filter(item => item.status === 'active').length, description: 'Площадки, команды и даты проведения', section: 'implementations' as const, icon: Flag },
  ];
  return <div className="curator-overview">
    <section className="curator-intro"><ShieldCheck size={28} aria-hidden="true" /><div><h2>Помогаем идеям двигаться дальше</h2><p>Рассматривайте заявки, проверяйте подтверждения и следите за событиями. Все решения сохраняются в системе.</p></div></section>
    <div className="curator-task-grid">{cards.map(item => <button type="button" key={item.section} onClick={() => onNavigate(item.section)}><span><item.icon size={20} aria-hidden="true" />{item.label}<ArrowRight size={18} aria-hidden="true" /></span><strong>{item.count === null ? '…' : item.count}</strong><p>{item.description}</p><small>{item.count === 0 ? 'Всё спокойно · открыть раздел' : 'Перейти к работе'}</small></button>)}</div>
    {error && <p className="inline-error" role="alert">Не удалось обновить рейтинг и события. {error}</p>}
    <div className="curator-work-grid"><section className="curator-section"><div className="curator-section-heading"><h2>Ждут вашего ответа</h2><button type="button" onClick={() => onNavigate('applications')}>Все заявки<ArrowRight size={16} /></button></div>{pending.length ? <ol className="curator-inbox-preview">{pending.slice(0, 4).map(item => <li key={item.id}><button type="button" onClick={() => onNavigate('applications')}><div><span>{item.isInitiative ? 'Инициатива' : 'Анкета участника'}</span><strong>{item.name}</strong><p>{item.description}</p></div><ArrowRight size={18} aria-hidden="true" /></button></li>)}</ol> : <div className="curator-quiet"><ClipboardList size={25} aria-hidden="true" /><p>Новых заявок пока нет. Когда участник отправит идею или анкету, она появится здесь.</p></div>}</section>
    <section className="curator-section"><div className="curator-section-heading"><h2>Ближайшие события</h2><CalendarDays size={20} aria-hidden="true" /></div>{!hub ? <p role="status">Загружаем календарь…</p> : upcoming.length ? <ol className="curator-events-preview">{upcoming.map(event => <li key={event.id}><time dateTime={event.startDate}>{new Date(`${event.startDate}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</time><div><strong>{event.title}</strong><p>{event.location || 'Место уточняется'}</p></div></li>)}</ol> : <p className="curator-quiet">Запланированные события и даты проектов появятся в календаре.</p>}<button type="button" className="curator-text-link" onClick={() => onNavigate('calendar')}>Открыть календарь<ArrowRight size={17} /></button></section></div>
  </div>;
}
