import { ArrowRight, ArrowUpRight, HeartHandshake, Lightbulb, Send, Users } from 'lucide-react';
import type { FeaturedInitiative } from '../utils/homepage.ts';
import type { PublicInitiative } from '../utils/publicInitiatives.ts';

const steps = [
  { title: 'Предложи идею', description: 'Расскажи, что хочешь изменить и кому поможет твой проект.', icon: Lightbulb },
  { title: 'Дождись рассмотрения', description: 'Совет изучит заявку. Одобренная идея появится на общей доске.', icon: Send },
  { title: 'Найди поддержку', description: 'Пригласи единомышленников. Совет сможет направить проект партнёрам.', icon: Users },
  { title: 'Действуй вместе', description: 'Объединяйте усилия, распределяйте задачи и воплощайте задуманное.', icon: HeartHandshake },
];

export function HowItWorks({ onStart }: { onStart: () => void }) {
  return <section className="how-section" aria-labelledby="how-title">
    <div className="home-section-heading"><div><span className="section-eyebrow">ОТ ПЕРВОГО ШАГА ДО ОБЩЕГО ДЕЛА</span><h2 id="how-title">Как идея становится делом</h2></div><p>Большие перемены начинаются<br />с простого «у меня есть идея».</p></div>
    <ol className="how-steps">{steps.map((step, index) => <li key={step.title}><div className="how-step-top"><span className="how-step-number">0{index + 1}</span><step.icon size={22} strokeWidth={1.5} aria-hidden="true" /></div><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
    <button type="button" className="how-start" onClick={onStart}>Сделать первый шаг <ArrowRight size={18} /></button>
  </section>;
}

export function HelpWanted({ initiatives, onJoin, onDetails, loadError }: {
  initiatives: FeaturedInitiative[];
  onJoin: (initiative: PublicInitiative) => void;
  onDetails: (initiative: PublicInitiative) => void;
  loadError: boolean;
}) {
  return <section className="help-section" aria-labelledby="help-title">
    <div className="home-section-heading"><div><span className="section-eyebrow"><span className="home-kicker-dot" /> ВМЕСТЕ ПОЛУЧИТСЯ БОЛЬШЕ</span><h2 id="help-title">Нужны единомышленники</h2></div><p>Инициативы, выбранные командой Совета.<br />Твой опыт может пригодиться уже сейчас.</p></div>
    {initiatives.length ? <div className="help-grid">{initiatives.map((initiative, index) => <article key={initiative.id} className="help-card"><div className="help-card-top"><span>{initiative.area}</span><span>0{index + 1}</span></div><h3><button type="button" onClick={() => onDetails(initiative)}>{initiative.title}<ArrowUpRight size={19} aria-hidden="true" /></button></h3><p className="help-description">{initiative.description}</p><div className="help-request"><span>СЕЙЧАС НУЖНЫ</span><p>{initiative.helpNeeded}</p></div><div className="help-card-bottom"><span>{initiative.author}</span><button type="button" onClick={() => onJoin(initiative)}>Хочу помочь <ArrowRight size={17} /></button></div></article>)}</div>
      : <div className="help-empty"><HeartHandshake size={32} strokeWidth={1.4} /><div><h3>{loadError ? 'Не удалось загрузить подборку' : 'Здесь встретятся идеи и поддержка'}</h3><p>{loadError ? 'Попробуй обновить страницу немного позже.' : 'Команда Совета готовит подборку проектов, которым нужна помощь. А пока познакомься с инициативами на общей доске ниже.'}</p></div></div>}
  </section>;
}
