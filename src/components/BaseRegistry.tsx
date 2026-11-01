import { useMemo, useState } from 'react';
import { ArrowRight, Lightbulb, Users, X } from 'lucide-react';
import type { BaseMember } from './DashboardView.tsx';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';
import { ModalDialog } from './ModalDialog.tsx';
import { CabinetContacts, CabinetEmpty, CabinetPagination, CabinetSearch } from './CabinetUI.tsx';

const CATEGORIES = ['Все направления', 'Мероприятия', 'Медиа', 'IT', 'Волонтёрство'];
const PAGE_SIZE = 12;
export function BaseRegistry({ members, initiatives, onCopy }: { members: BaseMember[]; initiatives: PublicInitiative[]; onCopy: (value: string, label: string) => void }) {
  const [section, setSection] = useState<'people' | 'ideas'>('people');
  const [query, setQuery] = useState(''); const [area, setArea] = useState(CATEGORIES[0]);
  const [requestedPage, setRequestedPage] = useState(1);
  const [selectedPersonId, setSelectedPersonId] = useState(''); const [selectedIdeaId, setSelectedIdeaId] = useState('');
  const people = useMemo(() => members.filter(item => !item.isInitiative), [members]);
  const selectedPerson = people.find(item => item.id === selectedPersonId);
  const selectedIdea = initiatives.find(item => item.id === selectedIdeaId);
  const author = selectedIdea ? members.find(item => item.isInitiative && item.id.replace(/^base-/, '') === selectedIdea.id) : undefined;
  const needle = query.trim().toLocaleLowerCase('ru');
  const filteredPeople = useMemo(() => people.filter(item => (area === CATEGORIES[0] || item.category === area || item.helpAreas?.includes(area)) && [item.name,item.description || '',item.phone,item.email,item.branch || '',item.roleInfo].some(value => value.toLocaleLowerCase('ru').includes(needle))), [people, area, needle]);
  const filteredIdeas = useMemo(() => initiatives.filter(item => (area === CATEGORIES[0] || item.area === area) && [item.title,item.description,item.author].some(value => value.toLocaleLowerCase('ru').includes(needle))), [initiatives, area, needle]);
  const count = section === 'people' ? filteredPeople.length : filteredIdeas.length;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(count / PAGE_SIZE)));
  function reset() { setQuery(''); setArea(CATEGORIES[0]); setRequestedPage(1); }
  return <section className="cabinet-section">
    <header className="cabinet-section-heading"><div><h2>Найдите человека или идею</h2><p>Участники — для связи и сбора команды. Идеи — все опубликованные проекты с автором и описанием.</p></div></header>
    <div className="cabinet-segments" aria-label="Что найти"><button type="button" aria-pressed={section === 'people'} onClick={() => { setSection('people'); reset(); }}><Users size={17} />Участники <b>{people.length}</b></button><button type="button" aria-pressed={section === 'ideas'} onClick={() => { setSection('ideas'); reset(); }}><Lightbulb size={17} />Идеи <b>{initiatives.length}</b></button></div>
    <div className="cabinet-toolbar"><CabinetSearch value={query} onChange={value => { setQuery(value); setRequestedPage(1); }} label={section === 'people' ? 'Поиск участников' : 'Поиск идей'} placeholder={section === 'people' ? 'Имя, телефон, почта или школа' : 'Название, описание или автор'} /><label className="cabinet-select"><span>Направление помощи</span><select value={area} onChange={event => { setArea(event.target.value); setRequestedPage(1); }}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label></div>
    <div className="cabinet-registry"><div className="cabinet-list-caption"><strong>{section === 'people' ? 'Одобренные участники' : 'Опубликованные идеи'}</strong><span role="status">Найдено: {count}</span></div>
      {section === 'people' ? filteredPeople.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(person => <article className="cabinet-record" key={person.id}><div className="cabinet-record-main"><div className="cabinet-record-title"><strong>{person.name}</strong><span className="cabinet-tag">{person.helpAreas?.join(' · ') || person.category}</span></div><p className="cabinet-meta">{person.branch || person.organization || person.roleInfo}</p><CabinetContacts phone={person.phone} email={person.email} vkUrl={person.vkUrl} onCopy={onCopy} /></div><button type="button" className="cabinet-button" onClick={() => setSelectedPersonId(person.id)}>Подробнее <ArrowRight size={15} /></button></article>) : filteredIdeas.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(idea => <article className="cabinet-record" key={idea.id}><div className="cabinet-record-main"><div className="cabinet-record-title"><strong>{idea.title}</strong><span className="cabinet-tag">{idea.area}</span></div><p className="cabinet-meta">Автор: {idea.author}</p></div><button type="button" className="cabinet-button" onClick={() => setSelectedIdeaId(idea.id)}>Подробнее <ArrowRight size={15} /></button></article>)}
      {!count && <CabinetEmpty title={query || area !== CATEGORIES[0] ? 'Ничего не найдено' : section === 'people' ? 'Участников пока нет' : 'Пока нет опубликованных идей'} onReset={query || area !== CATEGORIES[0] ? reset : undefined}>{query || area !== CATEGORIES[0] ? 'Измените запрос или выберите другое направление.' : 'После одобрения заявки появятся в этом разделе.'}</CabinetEmpty>}
      <CabinetPagination total={count} page={page} size={PAGE_SIZE} onChange={setRequestedPage} />
    </div>
    {selectedPerson && <ModalDialog className="cabinet-dialog" labelledBy="person-details-title" onClose={() => setSelectedPersonId('')}><div className="workflow-dialog cabinet-detail"><div className="workflow-dialog-heading"><h2 id="person-details-title">{selectedPerson.name}</h2><button type="button" aria-label="Закрыть" onClick={() => setSelectedPersonId('')}><X size={20} /></button></div><span className="cabinet-tag">{selectedPerson.helpAreas?.join(' · ') || selectedPerson.category}</span><p className="cabinet-detail-description">{selectedPerson.description || selectedPerson.roleInfo}</p>{(selectedPerson.branch || selectedPerson.organization) && <p>Школа или организация: {selectedPerson.branch || selectedPerson.organization}</p>}{selectedPerson.supportInitiativeTitle && <p>Помогает проекту «{selectedPerson.supportInitiativeTitle}»</p>}<h3>Связаться с участником</h3><CabinetContacts phone={selectedPerson.phone} email={selectedPerson.email} vkUrl={selectedPerson.vkUrl} onCopy={onCopy} /><p className="journey-hint">Контакты доступны только сотрудникам в кабинете.</p></div></ModalDialog>}
    {selectedIdea && <ModalDialog className="cabinet-dialog" labelledBy="idea-details-title" onClose={() => setSelectedIdeaId('')}><div className="workflow-dialog cabinet-detail"><div className="workflow-dialog-heading"><h2 id="idea-details-title">{selectedIdea.title}</h2><button type="button" aria-label="Закрыть" onClick={() => setSelectedIdeaId('')}><X size={20} /></button></div><span className="cabinet-tag">{selectedIdea.area}</span><p>Автор: {selectedIdea.author}</p><p className="cabinet-detail-description">{selectedIdea.description}</p>{author && <><h3>Связаться с автором</h3><CabinetContacts phone={author.phone} email={author.email} vkUrl={author.vkUrl} onCopy={onCopy} /></>}<a className="cabinet-button" href={`/?view=initiative&initiative=${encodeURIComponent(selectedIdea.id)}`}>Открыть страницу идеи <ArrowRight size={15} /></a></div></ModalDialog>}
  </section>;
}
