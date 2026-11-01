import { DirectionFilter, DirectionTags } from './DirectionControls.tsx';
import { countDirections, directionSearchText, matchesParticipantDirection, normalizeDirectionSearch } from '../utils/participantDirections.ts';
import { directionCover, INITIATIVE_DIRECTIONS, type InitiativeDirection } from '../utils/initiativeDirections.ts';
import { InitiativeCoverPicker } from './InitiativeCoverPicker.tsx';
import { initiativeCover } from '../utils/initiativeCovers.ts';
import { useMemo, useState } from 'react';
import { ArrowUpRight, Check, Clock, X, ChevronDown } from 'lucide-react';
import type { ApplicationItem } from './DashboardView.tsx';
import type { Implementation } from '../utils/implementations.ts';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import { ModalDialog } from './ModalDialog.tsx';
import { CabinetContacts, CabinetEmpty, CabinetPagination, CabinetSearch } from './CabinetUI.tsx';
import { authorInitials } from '../utils/initiativePresentation.ts';
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from '../utils/applicationJourney.ts';

type Decision = 'accepted' | 'rejected' | 'needs_changes';
interface Props {
  initialOpenedId?: string;
  initialKind?: 'all' | 'initiative' | 'help';
  applications: ApplicationItem[]; processing: string[];
  onReview: (id: string, status: Decision, reason: string, version?: number, coverId?: string, direction?: InitiativeDirection) => Promise<void>;
  implementations: Implementation[]; initiatives: PublicInitiative[]; ownOnly?: boolean; allProjects?: boolean;
  implementationId?: string; onClearImplementation?: () => void;
}
function kind(item: ApplicationItem): string { return item.isInitiative ? 'initiative' : item.supportImplementationId ? 'participation' : 'help'; }
function dateLabel(value?: string): string { return value ? new Date(value).toLocaleDateString('ru-RU') : 'Дата не указана'; }
const PAGE_SIZE = 12;

export function ApplicationInbox({ applications, processing, onReview, implementations, initiatives, ownOnly = false, allProjects = false, implementationId, onClearImplementation, initialKind = 'all', initialOpenedId = '' }: Props) {
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('pending');
  const [query, setQuery] = useState(''); const [type, setType] = useState<string>(initialKind); const [order, setOrder] = useState('oldest');
  const [directionFilter, setDirectionFilter] = useState('Все');
  const [expandedId, setExpandedId] = useState('');
  const [requestedPage, setRequestedPage] = useState(1); const [selectedId, setSelectedId] = useState(initialOpenedId);
  const [review, setReview] = useState<{ application: ApplicationItem; status: Decision } | null>(null);
  const [coverId, setCoverId] = useState('community');
  const [direction, setDirection] = useState<InitiativeDirection | ''>('');
  const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const implementationById = useMemo(() => {
    const index = new Map<string, Pick<Implementation, 'organization' | 'status' | 'activistSlots' | 'volunteerSlots'>>();
    for (const initiative of initiatives) for (const item of initiative.implementations || []) index.set(item.id, item);
    for (const item of implementations) index.set(item.id, item);
    return index;
  }, [implementations, initiatives]);
  const selected = applications.find(item => item.id === selectedId);
  const scopedApplications = useMemo(() => implementationId ? applications.filter(item => item.supportImplementationId === implementationId) : applications, [applications, implementationId]);
  const matchingApplications = useMemo(() => {
    const needle = normalizeDirectionSearch(query); const digits = needle.replace(/\D/g, '');
    return scopedApplications.filter(item => (filter === 'all' || item.status === filter) && (type === 'all' || (kind(item) === type || (type === 'help' && !item.isInitiative))) && (!needle || [item.name, item.email, item.phone, item.description, item.category, directionSearchText(item, item.isInitiative ? 'initiative' : 'activist'), item.supportInitiativeTitle || '', implementationById.get(item.supportImplementationId || '')?.organization || ''].some(value => normalizeDirectionSearch(value).includes(needle)) || (digits.length >= 3 && item.phone.replace(/\D/g, '').includes(digits)))).sort((left, right) => {
      const time = (Date.parse(left.createdAt || '') || 0) - (Date.parse(right.createdAt || '') || 0);
      return (order === 'oldest' ? time : -time) || left.id.localeCompare(right.id);
    });
  }, [scopedApplications, filter, type, order, query, implementationById]);
  const filtered = useMemo(() => matchingApplications.filter(item => matchesParticipantDirection(item, item.isInitiative ? 'initiative' : 'activist', directionFilter)), [matchingApplications,directionFilter]);
  const matchedIdeas = useMemo(() => matchingApplications.filter(item => item.isInitiative), [matchingApplications]);
  const matchedPeople = useMemo(() => matchingApplications.filter(item => !item.isInitiative), [matchingApplications]);
  const ideaCounts = useMemo(() => countDirections(matchedIdeas,'initiative'), [matchedIdeas]);
  const peopleCounts = useMemo(() => countDirections(matchedPeople,'activist'), [matchedPeople]);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  function reset() { setQuery(''); setFilter('pending'); setType('all'); setDirectionFilter('Все'); setRequestedPage(1); }
  function open(application: ApplicationItem, status: Decision) { setSelectedId(''); setReview({ application, status }); setReason(''); setError(''); setDirection(application.direction || ''); setCoverId(initiativeCover({ area: application.area || 'Мероприятия', coverId: directionCover(application.direction) }).id); }
  function initiativeTitle(application: ApplicationItem) { return initiatives.find(item => item.id === application.supportInitiativeId)?.title || implementations.find(item => item.id === application.supportImplementationId)?.initiativeTitle || application.supportInitiativeTitle; }
  function recruitment(application: ApplicationItem) {
    if (!application.supportImplementationId) return null;
    const implementation = implementationById.get(application.supportImplementationId);
    const accepted = applications.filter(item => item.supportImplementationId === application.supportImplementationId && item.participationRole === application.participationRole && item.status === 'accepted').length;
    const capacity = application.participationRole === 'activist' ? implementation?.activistSlots : implementation?.volunteerSlots;
    return { organization: implementation?.organization || 'Реализация недоступна', free: Math.max(0, (capacity || 0) - accepted), active: implementation?.status === 'active' };
  }
  async function submit() {
    if (!review || saving) return;
    if (reviewChanged) { setError('Заявка уже изменена другим сотрудником. Ваш комментарий сохранён. Закройте окно и откройте актуальную заявку.'); return; }
    setSaving(true); setError('');
    try { await onReview(review.application.id, review.status, reason, review.application.version || 1, review.status === 'accepted' && review.application.isInitiative ? coverId : undefined, review.status === 'accepted' && review.application.isInitiative && direction ? direction : undefined); setReview(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Не удалось сохранить решение.'); }
    finally { setSaving(false); }
  }
  function decisions(application: ApplicationItem) {
    const quota = recruitment(application); const closed = quota && (!quota.active || !quota.free);
    return application.status === 'pending' && <div className="cabinet-decision-actions"><button type="button" disabled={processing.includes(application.id) || Boolean(closed)} title={closed ? 'Набор закрыт или места заняты' : undefined} className="cabinet-button cabinet-button-primary" onClick={() => open(application, 'accepted')}><Check size={14} />{application.isInitiative ? 'Опубликовать' : application.supportInitiativeId ? 'Принять отклик' : 'Принять в базу'}</button><button type="button" disabled={processing.includes(application.id)} className="cabinet-button" onClick={() => open(application, 'needs_changes')}>Попросить дополнить</button><button type="button" disabled={processing.includes(application.id)} className="cabinet-button cabinet-button-muted" onClick={() => open(application, 'rejected')}>Отклонить</button></div>;
  }
  const reviewQuota = review ? recruitment(review.application) : null;
  const reviewCurrent = review ? applications.find(item => item.id === review.application.id) : undefined;
  const reviewChanged = Boolean(review && reviewCurrent && (reviewCurrent.version || 1) !== (review.application.version || 1));
  return <section className="cabinet-section application-inbox">
    <header className="cabinet-section-heading"><div><h2>{ownOnly ? allProjects ? 'Отклики на проекты города' : 'Отклики вашей команды' : 'Поступившие заявки'}</h2><p>{ownOnly ? allProjects ? 'Вы можете принимать участников в команды всех проектов. Общие идеи и анкеты рассматривают куратор и администратор.' : 'Принимайте активистов и волонтёров в свою команду. Общая очередь доступна куратору и администратору.' : 'Откройте заявку, прочитайте описание и выберите решение. Контакты участников не публикуются.'}</p></div></header>
    {implementationId && <div className="cabinet-context"><span>Отклики: {implementations.find(item => item.id === implementationId)?.initiativeTitle || 'Выбранная реализация'} · {implementationById.get(implementationId)?.organization}</span><button type="button" className="cabinet-icon-button" aria-label="Показать заявки по всем проектам" onClick={onClearImplementation}><X size={15} /></button></div>}
    {!ownOnly && <div className="cabinet-segments" aria-label="Формат заявки">{[{ value: 'all', label: 'Все заявки' }, { value: 'initiative', label: 'Идеи' }, { value: 'help', label: 'Участники' }].map(tab => <button type="button" key={tab.value} aria-pressed={type === tab.value} onClick={() => { setType(tab.value); setDirectionFilter('Все'); setRequestedPage(1); }}><span className="desktop-copy">{tab.label}</span><span className="mobile-copy">{tab.value === 'all' ? 'Все' : tab.value === 'initiative' ? 'Идеи' : 'Активисты'}</span><b>{scopedApplications.filter(item => tab.value === 'all' || (kind(item) === tab.value || (tab.value === 'help' && !item.isInitiative))).length}</b></button>)}</div>}
    <div className="cabinet-filter-bar" aria-label="Статус заявки">{(['pending', 'needs_changes', 'accepted', 'rejected', 'withdrawn', 'all'] as const).map(status => <button type="button" key={status} aria-pressed={filter === status} onClick={() => { setFilter(status); setRequestedPage(1); }}>{status === 'all' ? 'Все' : APPLICATION_STATUS_LABELS[status]}<span>{scopedApplications.filter(item => status === 'all' || item.status === status).length}</span></button>)}</div>
    <div className="cabinet-toolbar"><CabinetSearch value={query} onChange={value => { setQuery(value); setRequestedPage(1); }} placeholder="Имя, проект, контакт или направление" label="Поиск заявок" /><label className="cabinet-select"><span>Порядок</span><select value={order} onChange={event => { setOrder(event.target.value); setRequestedPage(1); }}><option value="oldest">Сначала ранние</option><option value="newest">Сначала новые</option></select></label></div>
    <details className="direction-filter-disclosure"><summary>Фильтр по направлениям <span>{directionFilter === 'Все' ? 'Все направления' : directionFilter === 'unspecified' ? 'Не указано' : INITIATIVE_DIRECTIONS.find(item => item.id === directionFilter)?.label || directionFilter}</span></summary>
      {!ownOnly && (type === 'all' || type === 'initiative') && <DirectionFilter kind="initiative" value={directionFilter} counts={ideaCounts} total={matchedIdeas.length} onChange={value => { setDirectionFilter(value); setType('initiative'); setRequestedPage(1); }} />}
      {(type === 'all' || type === 'help' || ownOnly) && <DirectionFilter kind="activist" value={directionFilter} counts={peopleCounts} total={matchedPeople.length} onChange={value => { setDirectionFilter(value); setType('help'); setRequestedPage(1); }} />}
    </details>
    <div className="cabinet-registry"><div className="cabinet-list-caption"><strong>{APPLICATION_STATUS_LABELS[filter as ApplicationStatus] || 'Все заявки'}</strong><span role="status">Найдено: {filtered.length}</span></div>
      {filtered.length ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(application => {
        const quota = recruitment(application);
        const expanded = expandedId === application.id;
        const title = application.isInitiative
          ? initiatives.find(item => item.id === application.id)?.title || application.description.split(/[.!?\n]/, 1)[0]?.slice(0, 100) || 'Новая инициатива'
          : initiativeTitle(application) || application.category;
        return <article className="cabinet-request" key={application.id}>
          <button type="button" className="cabinet-request-toggle" aria-expanded={expanded} aria-controls={`request-details-${application.id}`} onClick={() => setExpandedId(expanded ? '' : application.id)}>
            <span className="idea-avatar" aria-hidden="true">{authorInitials(application.name)}</span>
            <span className="cabinet-request-copy"><strong>{title}</strong><span>{application.name}</span></span>
            <span className={`journey-badge status-${application.status}`}>{APPLICATION_STATUS_LABELS[application.status]}</span>
            <ChevronDown size={18} className={expanded ? 'request-chevron is-expanded' : 'request-chevron'} aria-hidden="true" />
          </button>
          <div className="request-direction-summary"><DirectionTags record={application} kind={application.isInitiative ? 'initiative' : 'activist'} /></div>
          <div className="cabinet-request-details" hidden={!expanded} id={`request-details-${application.id}`}>
            <div className="cabinet-request-facts"><span>{application.category}</span><time>{dateLabel(application.createdAt)}</time></div>
            <p className="cabinet-detail-description">{application.description}</p>
            {application.supportInitiativeTitle && <p className="cabinet-support-caption">«{initiativeTitle(application)}»{quota ? ` · ${quota.organization} · ${application.participationRole === 'activist' ? 'Активист' : 'Волонтёр'} · ${quota.active ? `свободно мест: ${quota.free}` : 'набор закрыт'}` : ''}</p>}
            <CabinetContacts phone={application.phone} email={application.email} vkUrl={application.vkUrl} />
            <div className="cabinet-request-actions">{decisions(application)}<button type="button" className="cabinet-button cabinet-button-muted" onClick={() => setSelectedId(application.id)}>История и детали <ArrowUpRight size={14} /></button></div>
          </div>
        </article>;

      }) : <CabinetEmpty title="Заявок не найдено" onReset={query || type !== 'all' || filter !== 'pending' || directionFilter !== 'Все' ? reset : undefined}>{query || type !== 'all' ? 'Измените запрос или фильтры.' : 'Новые заявки появятся здесь после отправки участниками.'}</CabinetEmpty>}
      <CabinetPagination total={filtered.length} page={page} size={PAGE_SIZE} onChange={setRequestedPage} />
    </div>
    {selected && <ModalDialog className="cabinet-dialog" labelledBy="application-detail-title" onClose={() => setSelectedId('')}><div className="workflow-dialog cabinet-detail"><div className="workflow-dialog-heading"><h2 id="application-detail-title">{selected.name}</h2><button type="button" aria-label="Закрыть" onClick={() => setSelectedId('')}><X size={20} /></button></div><span className={`journey-badge status-${selected.status}`}>{APPLICATION_STATUS_LABELS[selected.status]}</span><p className="cabinet-meta">{selected.category} · {dateLabel(selected.createdAt)}</p><DirectionTags record={selected} kind={selected.isInitiative ? 'initiative' : 'activist'} /><p className="cabinet-detail-description">{selected.description}</p>{selected.supportInitiativeTitle && <p className="journey-notice">Отклик на «{initiativeTitle(selected)}»{selected.supportImplementationId && <> · {implementationById.get(selected.supportImplementationId)?.organization} · {selected.participationRole === 'activist' ? 'Активист' : 'Волонтёр'}</>}</p>}<CabinetContacts phone={selected.phone} email={selected.email} vkUrl={selected.vkUrl} />{decisions(selected)}{!!selected.history?.length && <div className="cabinet-history"><h3><Clock size={16} /> История заявки</h3><ol>{selected.history.map(event => <li key={event.id}><strong>{APPLICATION_STATUS_LABELS[event.status]}</strong><p>{event.message}</p><small>{new Date(event.at).toLocaleString('ru-RU')}{event.actorName ? ` · ${event.actorName}` : ''}</small></li>)}</ol></div>}</div></ModalDialog>}
    {review && applications.some(item => item.id === review.application.id) && <ModalDialog className="cabinet-dialog" onClose={() => setReview(null)} labelledBy="review-title" busy={saving}><form className="review-form" onSubmit={event => { event.preventDefault(); void submit(); }}><div className="workflow-dialog-heading"><h2 id="review-title">{review.status === 'accepted' ? review.application.isInitiative ? 'Опубликовать инициативу' : 'Принять участника' : review.status === 'needs_changes' ? 'Вернуть на доработку' : 'Объяснить решение'}</h2><button type="button" disabled={saving} aria-label="Закрыть" onClick={() => setReview(null)}><X size={20} /></button></div><p>{review.application.name} · {review.application.category}</p>
      {reviewChanged && <p className="journey-notice" role="status">Заявка уже изменилась в другом кабинете. Ваш комментарий сохранён; для решения откройте актуальную версию заявки.</p>}
      {review.status === 'accepted' && review.application.isInitiative && <div className="review-preview"><strong>После подтверждения идея появится на сайте</strong><p>{review.application.description}</p><small>Публикуются имя автора и описание. Контакты и история остаются в кабинете.</small></div>}
      {review.status === 'accepted' && review.application.isInitiative && <label>Направление инициативы<select className="pervik-input" required disabled={saving} value={direction} onChange={event => { const value = event.target.value as InitiativeDirection; setDirection(value); setCoverId(directionCover(value) || coverId); }}><option value="">Выберите направление</option>{INITIATIVE_DIRECTIONS.map(item => <option key={item.id} value={item.id}>{item.label} · {item.description}</option>)}</select></label>}
      {review.status === 'accepted' && review.application.isInitiative && <InitiativeCoverPicker value={coverId} onChange={setCoverId} disabled={saving} />}
      {review.status === 'accepted' && !review.application.isInitiative && !reviewQuota && <p className="journey-notice">Участник появится в закрытой базе. Команда получит его контакты для связи. Анкета не будет опубликована в каталоге.</p>}
      {review.status === 'accepted' && reviewQuota && <p className="journey-notice">{reviewQuota.organization} · {review.application.participationRole === 'activist' ? 'Активист' : 'Волонтёр'} · Свободных мест: {reviewQuota.free}. Контакты будут доступны ответственному.</p>}
      {review.status !== 'accepted' && <p className="journey-notice">{review.status === 'needs_changes' ? 'Заявка останется неопубликованной. Автор сможет дополнить её и отправить повторно по личному коду.' : 'Заявка не будет опубликована и останется в истории. Автор увидит ваше объяснение по личному коду.'}</p>}
      <label htmlFor="review-reason">{review.status === 'accepted' ? 'Сообщение автору (можно не заполнять)' : review.status === 'needs_changes' ? 'Что нужно дополнить?' : 'Почему заявка не поддержана?'}</label><textarea id="review-reason" className="pervik-input" disabled={saving} required={review.status !== 'accepted'} minLength={review.status === 'accepted' ? undefined : 10} maxLength={1000} rows={4} value={reason} onChange={event => setReason(event.target.value)} placeholder="Например: добавьте дату, место и план проведения. После этого отправьте заявку повторно." />{error && <p className="inline-error" role="alert">{error}</p>}<div className="journey-actions"><button type="button" disabled={saving} className="journey-secondary" onClick={() => setReview(null)}>Отмена</button><button type="submit" disabled={saving || reviewChanged || Boolean(review.status === 'accepted' && reviewQuota && (!reviewQuota.active || !reviewQuota.free))} className="home-primary">{saving ? 'Сохраняем…' : review.status === 'accepted' ? review.application.isInitiative ? 'Опубликовать инициативу' : 'Принять участника' : review.status === 'needs_changes' ? 'Отправить на доработку' : 'Отклонить заявку'}</button></div></form></ModalDialog>}
  </section>;
}
