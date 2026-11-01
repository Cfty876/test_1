import { ArrowRight, Check, ClipboardList, Lightbulb, Users } from 'lucide-react';
import type { ApplicationItem } from './DashboardView.tsx';
import type { Implementation } from '../utils/implementations.ts';

export function AdminWorkQueue({ applications, implementations, onApplications, onProjects }: {
  applications: ApplicationItem[]; implementations: Implementation[];
  onApplications: (kind: 'initiative' | 'help') => void;
  onProjects: (filter: Implementation['status']) => void;
}) {
  const pending = applications.filter(item => item.status === 'pending');
  const tasks = [
    { title: 'Новые идеи', hint: 'Прочитать, выбрать обложку и решить, публиковать ли на сайте.', count: pending.filter(item => item.isInitiative).length, icon: Lightbulb, action: () => onApplications('initiative') },
    { title: 'Анкеты и отклики', hint: 'Принять человека в базу активистов или команду проекта.', count: pending.filter(item => !item.isInitiative).length, icon: Users, action: () => onApplications('help') },
    { title: 'Проекты ждут запуска', hint: 'Проверить план, площадку и набор команды.', count: implementations.filter(item => item.status === 'proposed').length, icon: Lightbulb, action: () => onProjects('proposed') },
    { title: 'Отчёты на проверке', hint: 'Посмотреть результаты и подтвердить завершение проекта.', count: implementations.filter(item => item.status === 'report_pending').length, icon: ClipboardList, action: () => onProjects('report_pending') },
  ];
  const total = tasks.reduce((sum, task) => sum + task.count, 0);
  return <section className="admin-work-queue" aria-labelledby="admin-queue-title">
    <div className="admin-queue-heading"><div><h2 id="admin-queue-title">Нужно ваше решение</h2><p>{total ? 'Выберите задачу. Откроется нужный список.' : 'Новых задач пока нет. Можно проверить текущие проекты.'}</p></div>{!total && <Check size={20} aria-label="Нет задач, ожидающих решения" />}</div>
    <div className="admin-task-list">{tasks.map(task => <button type="button" key={task.title} onClick={task.action} className="admin-task" data-pending={task.count > 0}><task.icon size={18} aria-hidden="true" /><span><strong>{task.title}</strong><small>{task.hint}</small></span><b aria-label={`Ожидают решения: ${task.count}`}>{task.count}</b><ArrowRight size={17} aria-hidden="true" /></button>)}</div>
  </section>;
}
