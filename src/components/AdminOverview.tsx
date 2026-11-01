import { ArrowRight, BookOpen, Plus } from 'lucide-react';
import type { ApplicationItem } from './DashboardView.tsx';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import type { Implementation } from '../utils/implementations.ts';
import { APPLICATION_STATUS_LABELS } from '../utils/applicationJourney.ts';
import type { CabinetSection } from '../utils/permissions.ts';
import { AdminWorkQueue } from './AdminWorkQueue.tsx';

export function AdminOverview({ applications, implementations, initiatives, onApplications, onProjects, onOpenApplication, onNavigate, onAddEmployee, onHelp }: {
  applications: ApplicationItem[]; implementations: Implementation[]; initiatives: PublicInitiative[];
  onApplications: (kind: 'initiative' | 'help') => void; onProjects: (filter: Implementation['status']) => void;
  onOpenApplication: (application: ApplicationItem) => void; onNavigate: (section: CabinetSection) => void; onAddEmployee: () => void; onHelp: () => void;
}) {
  const recent = [...applications].sort((a,b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)).slice(0,4);
  const active = implementations.filter(item => item.status === 'active').length;
  return <div className="admin-home">
    <div className="admin-home-main"><AdminWorkQueue applications={applications} implementations={implementations} onApplications={onApplications} onProjects={onProjects} />
      <section className="admin-recent"><div className="admin-section-heading"><h2>Последние заявки</h2><button type="button" className="cabinet-text-link" onClick={() => onNavigate('applications')}>Все заявки <ArrowRight size={15} /></button></div>
        {recent.length ? recent.map(application => <button type="button" className="admin-recent-row" key={application.id} onClick={() => onOpenApplication(application)}>
          <span className="admin-recent-copy"><span>{application.isInitiative ? 'Идея' : 'Участник'}{application.createdAt ? ` · ${new Date(application.createdAt).toLocaleDateString('ru-RU')}` : ''}</span><strong>{application.isInitiative ? initiatives.find(item => item.id === application.id)?.title || application.description.split(/[.!?\n]/,1)[0] : application.name}</strong><span>{application.isInitiative ? application.name : application.supportInitiativeTitle || application.helpAreas?.join(' · ') || application.area}</span></span>
          <span className={`journey-badge status-${application.status}`}>{APPLICATION_STATUS_LABELS[application.status]}</span><ArrowRight size={16} aria-hidden="true" />
        </button>) : <p className="admin-quiet-state">Когда человек отправит идею или анкету, она появится здесь. Новые заявки ищите в разделе «Заявки».</p>}
      </section>
    </div>
    <aside className="admin-home-side" aria-label="Быстрые действия и подсказки">
      <section className="admin-quick-links"><h2>Быстрые действия</h2><button type="button" onClick={() => onNavigate('base')}><span><strong>Найти участника</strong><small>Контакты и направления помощи</small></span><ArrowRight size={17} /></button><button type="button" onClick={onAddEmployee}><span><strong>Добавить сотрудника</strong><small>Выдать логин и выбрать права</small></span><Plus size={17} /></button><button type="button" onClick={() => onNavigate('homepage')}><span><strong>Обновить главную</strong><small>Выбрать идеи, которым нужна команда</small></span><ArrowRight size={17} /></button></section>
      <section className="admin-running"><h2>Сейчас в работе</h2><strong>{active}</strong><p>проектов с открытым набором или работой команды</p><button type="button" className="cabinet-text-link" onClick={() => onProjects('active')}>Открыть проекты <ArrowRight size={15} /></button></section>
      <section className="admin-start-guide"><BookOpen size={20} aria-hidden="true" /><h2>Впервые в кабинете?</h2><p>Начните с новых заявок. Мы объяснили, что делает каждый раздел и кто увидит ваши изменения.</p><button type="button" className="cabinet-button" onClick={onHelp}>Как здесь работать</button></section>
    </aside>
  </div>;
}
