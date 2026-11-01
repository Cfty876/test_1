import { directionLabel } from '../utils/initiativeDirections.ts';
import { ArrowDownLeft, ArrowRight, BookOpen, Plus } from 'lucide-react';
import type { ApplicationItem } from './DashboardView.tsx';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import type { Implementation } from '../utils/implementations.ts';
import { APPLICATION_STATUS_LABELS } from '../utils/applicationJourney.ts';
import type { CabinetSection } from '../utils/permissions.ts';
import { AdminWorkQueue } from './AdminWorkQueue.tsx';

export function AdminOverview({ canManage, canOversee, applications, implementations, initiatives, onApplications, onProjects, onOpenApplication, onNavigate, onAddEmployee, onHelp }: {
  canManage: boolean; canOversee: boolean;
  applications: ApplicationItem[]; implementations: Implementation[]; initiatives: PublicInitiative[];
  onApplications: (kind: 'initiative' | 'help') => void; onProjects: (filter: Implementation['status']) => void;
  onOpenApplication: (application: ApplicationItem) => void; onNavigate: (section: CabinetSection) => void; onAddEmployee: () => void; onHelp: () => void;
}) {
  const initiativeById = new Map(initiatives.map(item => [item.id, item]));
  const recent = [...applications].sort((a,b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)).slice(0,4);
  const active = implementations.filter(item => item.status === 'active').length;
  const pending = applications.filter(item => item.status === 'pending');
  return <div className="staff-home">
    <div className="school-home-lead">
      <section className="school-start"><div className="school-start-copy"><span className="school-overline">От идеи к действию</span><h2>Помогаем идеям стать делом</h2><p>{pending.length ? `Заявок ждут ответа: ${pending.length}. Откройте очередь и помогите команде сделать следующий шаг.` : 'Проверьте планы и результаты проектов. Все действия — в одном кабинете.'}</p><button type="button" className="school-button school-button-white" onClick={() => pending.length ? onApplications(pending.some(item => item.isInitiative) ? 'initiative' : 'help') : onNavigate('implementations')}>{pending.length ? 'Рассмотреть заявки' : 'Открыть проекты'}<ArrowRight size={20} /></button></div><div className="school-start-mark" aria-hidden="true"><ArrowDownLeft strokeWidth={1.25} /></div></section>
      <section className="school-score"><div className="school-score-label"><span>Проекты в работе</span></div><div className="school-score-number">{active}<span>проектов</span></div><p>Реализации в статусе «Идёт работа»</p><button type="button" onClick={() => onProjects('active')}>Посмотреть проекты<ArrowRight size={18} /></button></section>
    </div>
    <div className="admin-home">
    <div className="admin-home-main"><AdminWorkQueue canOversee={canOversee} applications={applications} implementations={implementations} onApplications={onApplications} onProjects={onProjects} />
      <section className="admin-recent school-panel"><div className="admin-section-heading school-block-heading"><h2>Последние заявки</h2><button type="button" className="cabinet-text-link" onClick={() => onNavigate('applications')}>Все заявки <ArrowRight size={15} /></button></div>
        {recent.length ? recent.map(application => <button type="button" className="admin-recent-row" key={application.id} onClick={() => onOpenApplication(application)}>
          <span className="admin-recent-copy"><span>{application.isInitiative ? 'Идея' : 'Участник'}{application.createdAt ? ` · ${new Date(application.createdAt).toLocaleDateString('ru-RU')}` : ''}</span><strong>{application.isInitiative ? initiativeById.get(application.id)?.title || application.description.split(/[.!?\n]/,1)[0] : application.name}</strong><span>{application.isInitiative ? `${application.name} · ${directionLabel(application)}` : (application.supportInitiativeTitle || application.helpAreas?.join(' · ') || application.area)}</span></span>
          <span className={`journey-badge status-${application.status}`}>{APPLICATION_STATUS_LABELS[application.status]}</span><ArrowRight size={16} aria-hidden="true" />
        </button>) : <p className="admin-quiet-state">Когда человек отправит идею или анкету, она появится здесь. Новые заявки ищите в разделе «Заявки».</p>}
      </section>
    </div>
    <aside className="admin-home-side" aria-label="Быстрые действия и подсказки">
      <section className="admin-quick-links school-agenda-preview"><h2>Быстрые действия</h2><button type="button" onClick={() => onNavigate('base')}><span><strong>Найти участника</strong><small>Контакты и направления помощи</small></span><ArrowRight size={17} /></button>{canManage && <button type="button" onClick={onAddEmployee}><span><strong>Добавить сотрудника</strong><small>Выдать логин и выбрать права</small></span><Plus size={17} /></button>}{canManage && <button type="button" onClick={() => onNavigate('homepage')}><span><strong>Обновить главную</strong><small>Выбрать идеи, которым нужна команда</small></span><ArrowRight size={17} /></button>}<button type="button" onClick={() => onNavigate('ranking')}><span><strong>Проверить баллы</strong><small>Заявки и подтверждающие материалы</small></span><ArrowRight size={17} /></button><button type="button" onClick={() => onNavigate('calendar')}><span><strong>Открыть календарь</strong><small>События и даты проектов</small></span><ArrowRight size={17} /></button></section>
      <section className="admin-start-guide school-panel"><BookOpen size={20} aria-hidden="true" /><h2>Впервые в кабинете?</h2><p>Подсказки объясняют каждый шаг и показывают, кто увидит изменения.</p><button type="button" className="school-button school-button-red" onClick={onHelp}>Как здесь работать<ArrowRight size={18} /></button></section>
    </aside>
    </div>
  </div>;
}
