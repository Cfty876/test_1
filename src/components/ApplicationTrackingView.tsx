import { directionLabel, INITIATIVE_DIRECTIONS, type InitiativeDirection } from '../utils/initiativeDirections.ts';
import { useLiveRefresh } from '../utils/useLiveRefresh.ts';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { platformRequest } from '../utils/platformApi.ts';
import { APPLICATION_STATUS_LABELS, downloadReceipt, forgetReceipt, rememberReceipt, type ApplicationReceipt, type TrackedApplication } from '../utils/applicationJourney.ts';

interface Props { receipt: ApplicationReceipt | null; onGoHome: () => void; onClearReceipt: () => void }

export function ApplicationTrackingView({ receipt, onGoHome, onClearReceipt }: Props) {
  const [code, setCode] = useState(receipt?.code || '');
  const [application, setApplication] = useState<TrackedApplication | null>(null);
  const [activeCode, setActiveCode] = useState('');
  const [description, setDescription] = useState('');
  const [direction, setDirection] = useState<InitiativeDirection | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [draftVersion, setDraftVersion] = useState(1);
  const liveDraft = useRef({ code: activeCode, description, busy });
  liveDraft.current = { code: activeCode, description, busy };

  useEffect(() => {
    if (!receipt) return;
    let active = true;
    setBusy(true);
    void platformRequest<TrackedApplication>('/application-track', { code: receipt.code }).then((result) => {
      if (!active) return;
      setApplication(result); setActiveCode(receipt.code); setDescription(result.description); setDirection(result.direction || ''); setDraftVersion(result.version);
    }).catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : 'Не удалось проверить статус.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [receipt]);

  const trackingIssue = useLiveRefresh(async signal => {
    if (!activeCode || busy) return;
    const previousDescription = application?.description;
    const result = await platformRequest<TrackedApplication>('/application-track', { code: activeCode }, signal);
    if (signal.aborted || liveDraft.current.code !== activeCode || liveDraft.current.busy) return;
    // Only update an untouched draft. A concurrent edit keeps its original expected version.
    if (liveDraft.current.description === previousDescription) { setDescription(result.description); setDirection(result.direction || ''); setDraftVersion(result.version); }
    setApplication(result);
  }, Boolean(activeCode));

  async function load() {
    if (busy) return;
    setBusy(true); setError(''); setNotice(''); setConfirmWithdraw(false);
    setApplication(null); setActiveCode('');
    try {
      const normalized = code.trim().toLowerCase();
      const result = await platformRequest<TrackedApplication>('/application-track', { code: normalized });
      setApplication(result); setActiveCode(normalized); setDescription(result.description); setDirection(result.direction || ''); setDraftVersion(result.version);
      rememberReceipt({ id: result.id, code: normalized });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Не удалось проверить статус.'); }
    finally { setBusy(false); }
  }
  async function update(action: 'revise' | 'withdraw') {
    if (!application || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await platformRequest<TrackedApplication>('/application-track', { code: activeCode, action, version: action === 'revise' ? draftVersion : application.version, ...(action === 'revise' ? { description, ...(application.isInitiative ? { direction } : {}) } : {}) });
      setApplication(result); setDescription(result.description); setDirection(result.direction || ''); setDraftVersion(result.version); setConfirmWithdraw(false);
      setNotice(action === 'revise' ? 'Доработка отправлена. Команда получит обновлённую заявку.' : 'Заявка отозвана. Она не появится в каталоге.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Не удалось сохранить изменения. Текст остался в форме.'); }
    finally { setBusy(false); }
  }

  return <main className="journey-page">
    <div className="journey-heading"><button type="button" className="journey-back" onClick={onGoHome}><ArrowLeft size={16} /> На главную</button><span className="section-eyebrow">ТВОЯ ИДЕЯ В ДВИЖЕНИИ</span><h1>Моя заявка</h1><p>Проверь решение Совета и отправь доработку, если она нужна.</p></div>
    <section className="journey-card" aria-labelledby="tracking-code-title">
      <h2 id="tracking-code-title"><ShieldCheck size={20} /> <span className="desktop-copy">Проверить по личному коду</span><span className="mobile-copy">Личный код</span></h2>
      <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="journey-code-form">
        <label htmlFor="tracking-code">Код из подтверждения заявки</label>
        <textarea id="tracking-code" required minLength={64} maxLength={64} rows={2} autoComplete="off" autoCapitalize="none" spellCheck={false} value={code} disabled={busy} onChange={(event) => { setCode(event.target.value.replace(/\s/g, '')); setApplication(null); setConfirmWithdraw(false); }} className="pervik-input journey-code" placeholder="Вставь личный код из сохранённого файла" aria-describedby="tracking-code-hint" />
        <p id="tracking-code-hint" className="journey-hint"><span className="desktop-copy">Код открывает текст и управление заявкой. Храни его у себя. Телефон и почта для проверки не требуются.</span><span className="mobile-copy">Код даёт доступ к заявке. Не передавай его другим.</span></p>
        <div className="journey-actions"><button type="submit" disabled={busy} className="home-primary"><RefreshCw size={16} />{busy ? 'Загружаем…' : 'Проверить статус'}</button><button type="button" disabled={busy} className="journey-secondary" onClick={() => { forgetReceipt(); onClearReceipt(); setCode(''); setActiveCode(''); setApplication(null); setDescription(''); setError(''); setNotice(''); }}><span className="desktop-copy">Очистить на этом устройстве</span><span className="mobile-copy">Очистить код</span></button></div>
      </form>
      {!application && <details className="tracking-help"><summary>Не получается найти заявку?</summary><p className="journey-hint">Если код потерян или заявка отправлена до появления этой функции, напиши в <a href="https://vk.ru/mypervie96_ekb" target="_blank" rel="noreferrer">сообщество Совета</a>. Старые заявки остаются у команды.</p></details>}
    </section>
    {trackingIssue && <p role="status" className="journey-notice">{trackingIssue}</p>}
    {error && <p role="alert" className="inline-error">{error}</p>}
    {notice && <p role="status" className="journey-notice">{notice}</p>}
    {application && <>
      {!!application.updates?.length && <section className="journey-card" aria-labelledby="author-updates-title"><h2 id="author-updates-title">{application.isInitiative ? 'Новости твоей инициативы' : 'Обновления мероприятия'}</h2><p className="journey-hint">{application.isInitiative ? 'Предложения школ, запуск реализации и результаты от команды Совета.' : 'Важные изменения и результаты реализации, на которую ты откликнулся.'}</p><ol className="author-notifications">{application.updates.map((item) => <li key={item.id}><p>{item.message}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('ru-RU')}</time></li>)}</ol></section>}
      <section className="journey-card" aria-labelledby="application-status-title">
        <span className={`journey-badge status-${application.status}`}>{APPLICATION_STATUS_LABELS[application.status]}</span>
        <h2 id="application-status-title">{application.isInitiative ? 'Твоя инициатива' : application.category === 'Хочу быть активистом' ? 'Твоя анкета активиста' : 'Твой отклик'}</h2>
        <p className="journey-hint">{application.category} · {application.isInitiative ? directionLabel(application) : application.helpAreas?.join(' · ') || application.area}</p>
        <p className="journey-description">{application.description}</p>
        {application.status === 'accepted' && <p className="journey-notice">{application.isInitiative ? 'Инициатива опубликована в каталоге. Одобрение — первый шаг: сроки и поддержку команда согласует отдельно.' : 'Заявка передана команде Совета. Дальнейшее участие согласуют по указанным тобой контактам.'}</p>}
        <button type="button" className="journey-secondary" onClick={() => downloadReceipt({ id: application.id, code: activeCode })}><Download size={16} /> Скачать подтверждение</button>
      </section>
      <section className="journey-card" aria-labelledby="application-history-title"><h2 id="application-history-title">История заявки</h2><ol className="journey-timeline">{application.history.length ? application.history.map((event) => <li key={event.id}><span className="journey-timeline-dot" /><div><strong>{APPLICATION_STATUS_LABELS[event.status]}</strong><p>{event.message}</p><small>{event.actor === 'participant' ? 'Участник' : event.actor === 'organizer' ? 'Ответственный за реализацию' : 'Команда Совета'} · <time dateTime={event.at}>{new Date(event.at).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</time></small></div></li>) : <li>Заявка поступила до запуска истории решений. Текущий статус указан выше.</li>}</ol></section>
      {application.status === 'needs_changes' && draftVersion !== application.version && <p className="journey-notice" role="status">Заявка изменилась в другой вкладке. Ваш текст остался в форме. Скопируйте его при необходимости и проверьте статус заново перед отправкой.</p>}
      {application.status === 'needs_changes' && <section className="journey-card" aria-labelledby="revision-title"><h2 id="revision-title">Доработай описание</h2><p>Ответь на замечания команды из истории выше. После отправки заявка снова попадёт на рассмотрение.</p><form onSubmit={(event) => { event.preventDefault(); void update('revise'); }}>{application.isInitiative && <label>Направление инициативы<select className="pervik-input" required value={direction} disabled={busy} onChange={event => setDirection(event.target.value as InitiativeDirection)}><option value="">Выбери направление</option>{INITIATIVE_DIRECTIONS.map(item => <option key={item.id} value={item.id}>{item.label} · {item.description}</option>)}</select></label>}<label htmlFor="revision-description">Обновлённое описание</label><textarea id="revision-description" className="pervik-input" required minLength={10} maxLength={5000} rows={8} value={description} disabled={busy} onChange={(event) => setDescription(event.target.value)} /><span className="journey-hint">{description.length} / 5000</span><button type="submit" disabled={busy} className="home-primary"><Send size={16} />{busy ? 'Отправляем…' : 'Отправить доработку'}</button></form></section>}
      {(application.status === 'pending' || application.status === 'needs_changes') && <section className="journey-card journey-card-muted"><h2>Изменились планы?</h2>{confirmWithdraw ? <><p>Отозвать заявку? Она перестанет участвовать в рассмотрении. Для новой идеи можно будет отправить новую заявку.</p><div className="journey-actions"><button type="button" disabled={busy} className="journey-secondary" onClick={() => setConfirmWithdraw(false)}>Оставить заявку</button><button type="button" disabled={busy} className="journey-danger" onClick={() => void update('withdraw')}>Да, отозвать</button></div></> : <button type="button" disabled={busy} className="journey-secondary" onClick={() => setConfirmWithdraw(true)}>Отозвать заявку</button>}</section>}
    </>}
  </main>;
}
