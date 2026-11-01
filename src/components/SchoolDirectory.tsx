import { FitText } from './FitText.tsx';
import { useState } from 'react';
import { ArrowRight, Lightbulb, Search, Users, X } from 'lucide-react';
import type { BaseMember } from './DashboardView.tsx';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import { CabinetContacts, CabinetPagination } from './CabinetUI.tsx';
import { InitiativeArt } from './InitiativeArt.tsx';
import { ModalDialog } from './ModalDialog.tsx';

const AREAS = ['Все', 'Мероприятия', 'Медиа', 'IT', 'Волонтёрство'];
const TONES: Record<string, string> = { 'Мероприятия': 'red', 'Медиа': 'blue', IT: 'yellow', 'Волонтёрство': 'green' };
const PAGE_SIZE = 9;
interface Props {
  initialSection: 'ideas' | 'people'; members: BaseMember[]; initiatives: PublicInitiative[];
  onTakeIdea: (id: string) => void; onCopy: (value: string, label: string) => void;
  loading: boolean; loadError: boolean; onRetry: () => void;
}

export function SchoolDirectory({ initialSection, members, initiatives, onTakeIdea, onCopy, loading, loadError, onRetry }: Props) {
  const [section, setSection] = useState(initialSection);
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('Все');
  const [requestedPage, setRequestedPage] = useState(1);
  const [personId, setPersonId] = useState('');
  const [ideaId, setIdeaId] = useState('');
  const people = members.filter(m => !m.isInitiative);
  const selectedPerson = people.find(m => m.id === personId);
  const selectedIdea = initiatives.find(i => i.id === ideaId);
  const needle = query.trim().toLocaleLowerCase('ru');
  const ideas = initiatives.filter(i => (area === 'Все' || i.area === area) && `${i.title} ${i.description} ${i.author}`.toLocaleLowerCase('ru').includes(needle));
  const filteredPeople = people.filter(p => (area === 'Все' || p.category === area || p.helpAreas?.includes(area)) && `${p.name} ${p.description || ''} ${p.branch || ''} ${p.organization || ''} ${p.roleInfo} ${p.phone} ${p.email}`.toLocaleLowerCase('ru').includes(needle));
  const total = section === 'ideas' ? ideas.length : filteredPeople.length;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / PAGE_SIZE)));
  function switchSection(value: typeof section) { setSection(value); setQuery(''); setArea('Все'); setRequestedPage(1); }
  function reset() { setQuery(''); setArea('Все'); setRequestedPage(1); }

  return <section className="school-directory">
    <div className="school-directory-switch" aria-label="Идеи или участники">
      <button type="button" aria-pressed={section === 'ideas'} onClick={() => switchSection('ideas')}><Lightbulb size={21} />Идеи для дела<span>{initiatives.length}</span></button>
      <button type="button" aria-pressed={section === 'people'} onClick={() => switchSection('people')}><Users size={21} />Твоя будущая команда<span>{people.length}</span></button>
    </div>
    <div className="school-directory-tools"><label className="school-search"><Search size={21} aria-hidden="true" /><input type="search" aria-label={section === 'ideas' ? 'Найти идею' : 'Найти участника'} placeholder={section === 'ideas' ? 'Какую идею ищем?' : 'Имя, школа или направление помощи'} value={query} onChange={e => { setQuery(e.target.value); setRequestedPage(1); }} />{query && <button type="button" aria-label="Очистить поиск" onClick={() => { setQuery(''); setRequestedPage(1); }}><X size={18} /></button>}</label>
      <div className="school-area-filters" aria-label="Направления">{AREAS.map(value => <button type="button" key={value} aria-pressed={value === area} data-tone={TONES[value] || 'neutral'} onClick={() => { setArea(value); setRequestedPage(1); }}>{value}</button>)}</div>
    </div>
    <div className="school-results-caption"><p>{section === 'ideas' ? 'Идеи, которые можно провести в школе' : 'Активисты, готовые помогать'}</p><span role="status">Найдено: {total}</span></div>
    {section === 'ideas' && loadError && <p className="school-connection" role="alert">Не удалось загрузить каталог. <button type="button" onClick={onRetry}>Попробовать ещё раз</button></p>}
    <div className={section === 'ideas' ? 'school-idea-grid' : 'school-people-grid'}>
      {section === 'ideas' ? ideas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(idea => <article className="school-idea-card" key={idea.id} data-tone={TONES[idea.area] || 'red'}><button type="button" className="school-idea-picture" onClick={() => setIdeaId(idea.id)} aria-label={`Подробнее об идее «${idea.title}»`}><InitiativeArt initiative={idea} /></button><div className="school-idea-card-body"><span className="school-area-label">{idea.area}</span><h2><button type="button" onClick={() => setIdeaId(idea.id)}>{idea.title}</button></h2><p>{idea.description}</p><div className="school-idea-card-actions"><button type="button" className="school-button school-button-red" onClick={() => onTakeIdea(idea.id)}>Взять в работу<ArrowRight size={18} /></button><button type="button" className="school-detail-button" onClick={() => setIdeaId(idea.id)}>Об идее</button></div></div></article>) : filteredPeople.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(person => <article className="school-person-card" key={person.id} data-tone={TONES[person.category] || 'red'}><div className="school-person-card-top"><span className="school-person-avatar" aria-hidden="true">{person.initials}</span><span className="school-area-label">{person.category}</span></div><h2><FitText text={person.name} name /></h2><p><FitText text={person.branch || person.organization || person.roleInfo} /></p><div className="school-person-areas">{(person.helpAreas?.length ? person.helpAreas : [person.category]).map(value => <span key={value}>{value}</span>)}</div><button type="button" className="school-person-open" onClick={() => setPersonId(person.id)}>Знакомство и контакты<ArrowRight size={18} /></button></article>)}
    </div>
    {!total && <div className="school-directory-empty"><Search size={35} aria-hidden="true" /><h2>{query || area !== 'Все' ? 'Пока ничего не нашлось' : section === 'ideas' ? (loading ? 'Загружаем идеи…' : 'Скоро здесь появятся идеи') : 'Команда ещё собирается'}</h2><p>{query || area !== 'Все' ? 'Попробуй другое слово или выбери все направления.' : 'После одобрения новые заявки появятся в каталоге.'}</p>{(query || area !== 'Все') && <button type="button" className="school-button school-button-red" onClick={reset}>Сбросить поиск</button>}</div>}
    <CabinetPagination total={total} page={page} size={PAGE_SIZE} onChange={setRequestedPage} />
    {selectedPerson && <ModalDialog className="cabinet-dialog school-person-dialog" labelledBy="school-person-title" onClose={() => setPersonId('')}><div className="workflow-dialog"><div className="workflow-dialog-heading"><h2 id="school-person-title"><FitText text={selectedPerson.name} name /></h2><button type="button" aria-label="Закрыть карточку участника" onClick={() => setPersonId('')}><X size={22} /></button></div><span className="school-area-label">{selectedPerson.helpAreas?.join(' · ') || selectedPerson.category}</span><p>{selectedPerson.branch || selectedPerson.organization || selectedPerson.roleInfo}</p><p className="school-detail-description">{selectedPerson.description || 'Участник готов помогать в указанном направлении. Обсудите вместе, какую задачу можно взять в проекте.'}</p>{selectedPerson.supportInitiativeTitle && <p>Помогает проекту «{selectedPerson.supportInitiativeTitle}»</p>}<h3>Давай знакомиться</h3><CabinetContacts phone={selectedPerson.phone} email={selectedPerson.email} vkUrl={selectedPerson.vkUrl} onCopy={onCopy} /><p className="school-help-note">Контакты видят только сотрудники в личном кабинете.</p></div></ModalDialog>}
    {selectedIdea && <ModalDialog className="cabinet-dialog school-idea-dialog" labelledBy="school-idea-title" onClose={() => setIdeaId('')}><div className="workflow-dialog"><div className="workflow-dialog-heading"><h2 id="school-idea-title">{selectedIdea.title}</h2><button type="button" aria-label="Закрыть карточку идеи" onClick={() => setIdeaId('')}><X size={22} /></button></div><InitiativeArt initiative={selectedIdea} /><span className="school-area-label">{selectedIdea.area}</span><p className="school-detail-description">{selectedIdea.description}</p><p>Автор идеи: {selectedIdea.author}</p><div className="school-idea-detail-actions"><button type="button" className="school-button school-button-red" onClick={() => onTakeIdea(selectedIdea.id)}>Провести эту идею<ArrowRight size={19} /></button><a href={`/?view=initiative&initiative=${encodeURIComponent(selectedIdea.id)}`}>Страница инициативы ↗</a></div></div></ModalDialog>}
  </section>;
}
